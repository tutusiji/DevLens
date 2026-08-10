"""开发者路由：列表 / 详情 / 归属管理 / 身份合并 / 成长建议"""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..access import TenantContext, require_permission
from ..llm import chat

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/developers", response_model=list[schemas.Developer])
def list_developers(
    team_space_id: str | None = None,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("developer:read")),
):
    q = db.query(models.Developer).filter_by(tenant_id=ctx.tenant_id)
    if team_space_id:
        q = q.filter_by(team_space_id=team_space_id)
    return q.all()


@router.post("/developers/{did}/growth-advice")
def generate_growth_advice(
    did: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("assessment:run")),
):
    """基于最近一次实测评估生成个性化成长建议，并持久化到 ai_suggestion。"""
    dev = db.query(models.Developer).filter_by(id=did, tenant_id=ctx.tenant_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="开发者不存在")

    evaluation = (
        db.query(models.DeveloperEvaluation)
        .filter_by(developer_id=did, tenant_id=ctx.tenant_id)
        .order_by(models.DeveloperEvaluation.created_at.desc())
        .first()
    )
    if not evaluation or evaluation.status != "completed":
        raise HTTPException(status_code=400, detail="请先完成一次实测评估，再生成成长建议")

    scores = evaluation.scores or {}
    gaps = evaluation.gaps or []
    gap_lines = "\n".join(
        f"- {g.get('dimension')}: 当前 {g.get('current')}，目标 {g.get('target')}（差距 {g.get('gap')}）"
        for g in gaps[:5]
    ) or "- 各维度均达到当前职级标准"
    score_lines = "\n".join(f"- {k}: {v}" for k, v in list(scores.items())[:8])

    prompt = (
        "你是一名软件研发团队的技术负责人。请为一名开发者生成个性化的成长建议。\n"
        f"开发者：{dev.name}（职级 {dev.level or '未定'}，角色 {dev.role or dev.role_type or '未定'}）\n"
        f"最近一次能力实测评分：\n{score_lines}\n"
        f"与职级标准的差距：\n{gap_lines}\n"
        "请用中文输出，结构为：\n"
        "1. 一句话总评（当前能力定位）\n"
        "2. 最值得优先提升的 2-3 个维度，各给一条可执行行动（具体到做事的动作，而非口号）\n"
        "3. 建议的学习/实践路径（按周划分，最多 3 条）\n"
        "控制在 400 字以内，语气务实、不空泛。"
    )
    try:
        advice = chat([{"role": "user", "content": prompt}], max_tokens=1500)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"生成成长建议失败: {exc}") from exc

    dev.ai_suggestion = advice[:2000]
    db.commit()
    return {"developer_id": did, "advice": advice}


@router.patch("/developers/{did}", response_model=schemas.Developer)
def update_developer(
    did: str,
    body: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("developer:write")),
):
    d = db.query(models.Developer).filter_by(id=did, tenant_id=ctx.tenant_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="开发者不存在")

    allowed = {"name", "email", "employee_id", "team_space_id", "level", "role", "role_type", "department"}
    for key in allowed:
        if key in body:
            setattr(d, key, body[key])
    d.updated_at = _now()
    db.commit()
    db.refresh(d)
    return d


@router.post("/developers/{did}/merge-identities")
def merge_developer_identities(
    did: str,
    body: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("developer:write")),
):
    """将其他 Developer 记录合并到目标开发者。用于同一人员有多个 git 身份的场景。

    请求体：{"source_ids": ["dev-xxx", "dev-yyy"]}
    """
    target = db.query(models.Developer).filter_by(id=did, tenant_id=ctx.tenant_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="目标开发者不存在")

    source_ids = body.get("source_ids", [])
    if did in source_ids:
        raise HTTPException(status_code=400, detail="不能合并到自己")

    sources = db.query(models.Developer).filter(
        models.Developer.id.in_(source_ids),
        models.Developer.tenant_id == ctx.tenant_id,
    ).all()
    if len(sources) != len(source_ids):
        raise HTTPException(status_code=404, detail="部分源开发者不存在")

    # 合并：commits、project_contributions 等数值累加；tags/langs 取并集
    for s in sources:
        target.commits = (target.commits or 0) + (s.commits or 0)
        target.reviews = (target.reviews or 0) + (s.reviews or 0)
        target.overall = max(target.overall or 0, s.overall or 0)
        target.tags = list(set((target.tags or []) + (s.tags or [])))
        target.langs = list(set((target.langs or []) + (s.langs or [])))

        # 迁移评估记录
        db.query(models.DeveloperEvaluation).filter_by(
            developer_id=s.id, tenant_id=ctx.tenant_id,
        ).update({"developer_id": target.id})

        # 迁移身份匹配中的 person_name 到目标开发者
        db.query(models.IdentityMatch).filter_by(
            person_name=s.name, tenant_id=ctx.tenant_id,
        ).update({"person_name": target.name})

        db.delete(s)

    target.updated_at = _now()
    db.commit()
    return {"ok": True, "target_id": did, "merged_ids": source_ids}


@router.get("/developers/{did}", response_model=schemas.DeveloperDetail)
def get_developer(
    did: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("developer:read")),
):
    d = db.query(models.Developer).filter_by(id=did, tenant_id=ctx.tenant_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="开发者不存在")
    # 项目参与关系以项目 contributor_list 为事实来源；开发者画像不再孤立地
    # 展示“主导模块”，而是明确其所属项目。后续 Git 贡献聚合可直接写入
    # developer.project_contributions 覆盖/补充这份派生结果。
    projects = db.query(models.Project).filter_by(tenant_id=ctx.tenant_id).all()
    project_map = {project.id: project for project in projects}
    persisted = {
        str(item.get("project_id") or item.get("projectId")): dict(item)
        for item in (d.project_contributions or [])
        if isinstance(item, dict) and (item.get("project_id") or item.get("projectId"))
    }
    for project in projects:
        contributor = next(
            (
                item for item in (project.contributor_list or [])
                if str(item.get("username") or "").lower() == (d.username or "").lower()
            ),
            None,
        )
        if contributor:
            existing = persisted.get(project.id, {})
            persisted[project.id] = {
                **existing,
                "project_id": project.id,
                "commits": int(existing.get("commits", contributor.get("commits", 0)) or 0),
                "reviews": int(existing.get("reviews", contributor.get("reviews", 0)) or 0),
                "ownership": int(existing.get("ownership", contributor.get("ownership", 0)) or 0),
            }

    detail_payload = {
        column.name: getattr(d, column.name)
        for column in d.__table__.columns
    }
    detail_payload.update({
        "capability": d.capability or {},
        "team_capability_avg": d.team_capability_avg or {},
        "growth_curve": d.growth_curve or [],
        "behavior_evidence": d.behavior_evidence or [],
        "partners": d.partners or [],
        "modules": d.modules or [],
        "ai_suggestion": d.ai_suggestion or "",
    })
    detail = schemas.DeveloperDetail.model_validate(detail_payload)
    # 早期或仅列表导入的开发者可能没有完整画像 JSON。ORM 中的 NULL 会覆盖
    # Pydantic 的默认值，因此在派生模块和项目参与关系前统一归一化为空集合。
    detail.capability = detail.capability or {}
    detail.team_capability_avg = detail.team_capability_avg or {}
    detail.growth_curve = detail.growth_curve or []
    detail.behavior_evidence = detail.behavior_evidence or []
    detail.partners = detail.partners or []
    detail.modules = detail.modules or []
    detail.projects = detail.projects or []
    primary_project_id = (
        max(
            persisted.items(),
            key=lambda item: (
                int(item[1].get("commits", 0) or 0) + int(item[1].get("reviews", 0) or 0),
                int(item[1].get("ownership", 0) or 0),
            ),
        )[0]
        if persisted else ""
    )
    for module in detail.modules:
        # 旧数据没有 project_id 时归入该开发者当前贡献量最高的项目；不要仅凭
        # 同名模块跨项目猜测归属，避免“permission”等通用模块名串项目。
        project_id = module.project_id or primary_project_id
        project = project_map.get(project_id)
        module.project_id = project_id or None
        module.project_name = project.name if project else ""

    module_counts: dict[str, int] = {}
    for module in detail.modules:
        if module.project_id:
            module_counts[module.project_id] = module_counts.get(module.project_id, 0) + 1

    detail.projects = [
        schemas.DeveloperProjectContribution(
            project_id=project_id,
            project_name=project_map[project_id].name if project_id in project_map else str(item.get("project_name") or item.get("projectName") or "已归档项目"),
            project_score=int(project_map[project_id].score or 0) if project_id in project_map else 0,
            project_status=str(project_map[project_id].status or "") if project_id in project_map else "",
            role=str(item.get("role") or ("主导贡献" if int(item.get("ownership", 0) or 0) >= 60 else "核心贡献")),
            commits=int(item.get("commits", 0) or 0),
            reviews=int(item.get("reviews", 0) or 0),
            ownership=int(item.get("ownership", 0) or 0),
            module_count=module_counts.get(project_id, int(item.get("module_count", item.get("moduleCount", 0)) or 0)),
            last_active_at=str(item.get("last_active_at") or item.get("lastActiveAt") or ""),
        )
        for project_id, item in persisted.items()
    ]
    detail.projects.sort(key=lambda item: (item.commits + item.reviews, item.ownership), reverse=True)
    return detail
