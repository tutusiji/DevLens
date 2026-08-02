"""可售化评估报告导出（HTML / PDF）。

HTML 是完整、可离线保存的审计报告；PDF 通过系统 Chrome 的 headless print
生成，避免将浏览器渲染或第三方 SaaS 作为报告数据的外发依赖。
"""
from datetime import datetime, timezone
from html import escape
import os
from pathlib import Path
import subprocess
import tempfile
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session

from .. import models, schemas
from ..access import TenantContext, require_permission
from ..db import get_db
from .portfolio import comparison_data


router = APIRouter(tags=["reports"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_filename(value: str) -> str:
    return "".join(char if char.isalnum() or char in "-_" else "-" for char in value).strip("-") or "report"


def _record_export(
    db: Session,
    *,
    tenant_id: str,
    report_type: str,
    output_format: str,
    subject_ids: list[str],
    user_id: str,
) -> None:
    db.add(models.ReportExport(
        id=f"rpt-{uuid.uuid4().hex[:12]}",
        tenant_id=tenant_id,
        report_type=report_type,
        format=output_format,
        subject_ids=subject_ids,
        requested_by=user_id,
        created_at=_now(),
    ))
    db.commit()


def _metric_row(label: str, value: int | str) -> str:
    return f"<div class='metric'><span>{escape(label)}</span><strong>{escape(str(value))}</strong></div>"


def render_project_comparison_html(title: str, items: list[dict]) -> str:
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    rows = "".join(
        "<tr>"
        f"<td>{escape(item['project_name'])}</td>"
        f"<td>{escape(item['language'] or '—')}</td>"
        f"<td><b>{item['score']}</b></td>"
        f"<td>{item['quality']}</td><td>{item['security']}</td><td>{item['debt']}</td>"
        f"<td>{item['contributors']}</td>"
        f"<td>{'—' if item['score_delta'] is None else ('+' if item['score_delta'] >= 0 else '') + str(item['score_delta'])}</td>"
        "</tr>"
        for item in items
    )
    average = round(sum(item["score"] for item in items) / len(items)) if items else 0
    highest = items[0] if items else None
    risk = max(items, key=lambda item: item["debt"], default=None)
    return f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>{escape(title)}</title>
<style>
@page {{ size: A4 landscape; margin: 13mm; }}
* {{ box-sizing: border-box; }} body {{ color:#172033; font-family:"Noto Sans CJK SC","Noto Serif CJK SC",Arial,sans-serif; font-size:12px; line-height:1.55; }}
h1 {{ font-size:26px; margin:0 0 4px; }} .meta {{ color:#687386; margin-bottom:22px; }}
.summary {{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin: 0 0 22px; }}
.metric {{ border:1px solid #d9e0eb; border-radius:8px; padding:12px 14px; display:flex; justify-content:space-between; }}
.metric span {{ color:#687386; }} .metric strong {{ font-size:20px; }}
table {{ border-collapse:collapse; width:100%; }} th {{ text-align:left; background:#182235; color:#fff; font-weight:600; }}
th,td {{ border:1px solid #d9e0eb; padding:9px 10px; }} tr:nth-child(even) {{ background:#f7f9fc; }}
.footer {{ border-top:1px solid #d9e0eb; color:#687386; margin-top:22px; padding-top:10px; font-size:10px; }}
</style></head><body>
<h1>{escape(title)}</h1><div class="meta">DevLens 项目组合评估报告 · 生成时间：{generated_at}</div>
<section class="summary">
{_metric_row("纳入项目", f"{len(items)} 个")}
{_metric_row("平均健康评分", average)}
{_metric_row("最佳项目", highest["project_name"] if highest else "—")}
</section>
<h2>横向评分对比</h2>
<table><thead><tr><th>项目</th><th>技术栈</th><th>健康评分</th><th>质量</th><th>安全</th><th>技术债</th><th>贡献者</th><th>较上一快照</th></tr></thead>
<tbody>{rows or '<tr><td colspan="8">当前条件下没有可导出的项目。</td></tr>'}</tbody></table>
<div class="footer">评估口径：健康评分、质量、安全、技术债来自最近一次已完成分析；趋势差值来自项目评分历史快照。此报告仅限授权租户内部使用。</div>
</body></html>"""


def render_developer_evaluation_html(developer: models.Developer, evaluation: models.DeveloperEvaluation) -> str:
    scores = evaluation.scores or {}
    score_rows = "".join(
        f"<tr><td>{escape(str(dimension))}</td><td>{score}</td></tr>"
        for dimension, score in scores.items()
    )
    gaps = evaluation.gaps or []
    gap_rows = "".join(
        f"<tr><td>{escape(str(gap.get('dimension', '')))}</td><td>{gap.get('current', 0)}</td>"
        f"<td>{gap.get('target', 0)}</td><td>{gap.get('gap', 0)}</td></tr>"
        for gap in gaps
    )
    return f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>开发者能力实测报告</title>
<style>@page {{ size:A4; margin:14mm; }} body {{ color:#172033; font-family:"Noto Sans CJK SC",Arial,sans-serif; font-size:12px; line-height:1.6; }}
h1 {{ font-size:25px; margin:0; }} h2 {{ margin-top:24px; font-size:16px; }} .meta {{ color:#687386; margin:5px 0 22px; }}
.hero {{ border:1px solid #d9e0eb; border-radius:8px; padding:14px; background:#f7f9fc; }} table {{ border-collapse:collapse; width:100%; }} th {{ background:#182235; color:white; text-align:left; }} td,th {{ padding:8px 10px; border:1px solid #d9e0eb; }}</style>
</head><body><h1>开发者能力实测评估报告</h1>
<div class="meta">DevLens · 评估时间：{escape(evaluation.created_at or '')}</div>
<div class="hero"><b>{escape(developer.name)}</b> · {escape(developer.role or evaluation.role_key)}<br>
数据源：{escape(evaluation.repo_path)} · Git 作者：{escape(evaluation.git_author)}<br>
达标职级：<b>{escape(evaluation.achieved_level or '暂未达标')}</b> · 参考职级：{escape(evaluation.best_level or '—')}</div>
<h2>维度实测分</h2><table><thead><tr><th>维度</th><th>得分</th></tr></thead><tbody>{score_rows}</tbody></table>
<h2>待提升差距</h2><table><thead><tr><th>维度</th><th>当前</th><th>目标</th><th>差距</th></tr></thead><tbody>{gap_rows or '<tr><td colspan="4">当前参考目标无待提升差距。</td></tr>'}</tbody></table>
<h2>整体评价</h2><p>{escape(evaluation.summary or '—')}</p>
<p style="color:#687386;font-size:10px;border-top:1px solid #d9e0eb;padding-top:10px">审计依据：本次评估冻结的 Skill Group 规则快照、代码样本及 LLM 评分结果。报告仅限授权租户内部使用。</p></body></html>"""


def _as_pdf(html: str, file_stem: str) -> bytes:
    chrome = os.getenv("DEVLENS_CHROME_BINARY", "/usr/bin/google-chrome")
    if not Path(chrome).exists():
        raise HTTPException(status_code=503, detail="未配置 Chrome，暂无法生成 PDF；请改用 HTML 导出")
    with tempfile.TemporaryDirectory(prefix="devlens-report-") as directory:
        input_path = Path(directory) / "report.html"
        output_path = Path(directory) / f"{_safe_filename(file_stem)}.pdf"
        input_path.write_text(html, encoding="utf-8")
        command = [
            chrome, "--headless=new", "--disable-gpu",
            "--no-pdf-header-footer", "--allow-file-access-from-files",
            f"--print-to-pdf={output_path}", input_path.as_uri(),
        ]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=45, check=False)
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(status_code=504, detail="PDF 渲染超时，请稍后重试或使用 HTML 导出") from exc
        if result.returncode != 0 or not output_path.exists():
            raise HTTPException(status_code=503, detail="PDF 渲染失败，请检查 Chrome headless 运行环境")
        return output_path.read_bytes()


def _download(html: str, output_format: str, file_stem: str) -> Response:
    if output_format == "html":
        return HTMLResponse(
            html,
            headers={"Content-Disposition": f'attachment; filename="{_safe_filename(file_stem)}.html"'},
        )
    if output_format == "pdf":
        pdf = _as_pdf(html, file_stem)
        return Response(
            pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{_safe_filename(file_stem)}.pdf"'},
        )
    raise HTTPException(status_code=422, detail="format 必须是 html 或 pdf")


@router.get("/reports/project-comparison")
def export_project_comparison(
    project_ids: str = Query(default=""),
    format: str = Query(default="html"),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("report:export")),
):
    if format not in {"html", "pdf"}:
        raise HTTPException(status_code=422, detail="format 必须是 html 或 pdf")
    ids = [project_id.strip() for project_id in project_ids.split(",") if project_id.strip()]
    items = comparison_data(db, ctx.tenant_id, ids or None)
    if ids and len(items) != len(set(ids)):
        raise HTTPException(status_code=404, detail="至少一个项目不存在或不属于当前租户")
    _record_export(
        db, tenant_id=ctx.tenant_id, report_type="project_comparison",
        output_format=format, subject_ids=[item["project_id"] for item in items], user_id=ctx.user_id,
    )
    return _download(render_project_comparison_html("项目组合评估报告", items), format, "devlens-project-comparison")


@router.get("/developers/{did}/evaluations/{eid}/report")
def export_developer_evaluation(
    did: str,
    eid: str,
    format: str = Query(default="html"),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("report:export")),
):
    if format not in {"html", "pdf"}:
        raise HTTPException(status_code=422, detail="format 必须是 html 或 pdf")
    developer = db.query(models.Developer).filter_by(id=did, tenant_id=ctx.tenant_id).first()
    evaluation = db.query(models.DeveloperEvaluation).filter_by(
        id=eid, developer_id=did, tenant_id=ctx.tenant_id,
    ).first()
    if not developer or not evaluation:
        raise HTTPException(status_code=404, detail="开发者或评估记录不存在")
    _record_export(
        db, tenant_id=ctx.tenant_id, report_type="developer_evaluation",
        output_format=format, subject_ids=[did, eid], user_id=ctx.user_id,
    )
    return _download(
        render_developer_evaluation_html(developer, evaluation),
        format,
        f"devlens-{_safe_filename(developer.name)}-{eid}",
    )


@router.get("/report-exports", response_model=list[schemas.ReportExportM])
def list_report_exports(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("report:export")),
):
    return (
        db.query(models.ReportExport)
        .filter_by(tenant_id=ctx.tenant_id)
        .order_by(models.ReportExport.created_at.desc())
        .limit(100)
        .all()
    )
