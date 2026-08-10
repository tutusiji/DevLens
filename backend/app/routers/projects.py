"""项目路由：列表 / 详情 / 接入 / 分析运行 / 全局搜索"""
import os
import shutil
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db, SessionLocal
from .. import models, schemas
from ..access import TenantContext, require_permission
from ..analyzer import analyze_repository
from ..config import settings
from ..security import encrypt_value

router = APIRouter()


@router.get("/projects", response_model=list[schemas.Project])
def list_projects(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    return db.query(models.Project).filter_by(tenant_id=ctx.tenant_id).all()


@router.get("/search")
def global_search(
    q: str = Query("", min_length=1),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    """全局搜索：项目 / 开发者 / 团队空间 / 团队，供命令面板使用。"""
    keyword = f"%{q.strip()}%"

    project_hits = (
        db.query(models.Project)
        .filter(models.Project.tenant_id == ctx.tenant_id, models.Project.name.ilike(keyword))
        .order_by(models.Project.score.desc())
        .limit(8)
        .all()
    )
    dev_hits = (
        db.query(models.Developer)
        .filter(models.Developer.tenant_id == ctx.tenant_id, models.Developer.name.ilike(keyword))
        .order_by(models.Developer.overall.desc())
        .limit(8)
        .all()
    )
    space_hits = (
        db.query(models.TeamSpace)
        .filter(models.TeamSpace.tenant_id == ctx.tenant_id, models.TeamSpace.name.ilike(keyword))
        .limit(8)
        .all()
    )
    team_hits = (
        db.query(models.Team)
        .filter(models.Team.tenant_id == ctx.tenant_id, models.Team.name.ilike(keyword))
        .limit(8)
        .all()
    )

    return {
        "projects": [
            {"id": p.id, "name": p.name, "subtitle": f"{p.group} · {p.language} · 健康度 {p.score}", "href": f"/projects/{p.id}"}
            for p in project_hits
        ],
        "developers": [
            {"id": d.id, "name": d.name, "subtitle": f"{d.role} · {d.team} · 综合 {d.overall}", "href": f"/developers/{d.id}"}
            for d in dev_hits
        ],
        "teamSpaces": [
            {"id": s.id, "name": s.name, "subtitle": "组织团队", "href": "/team-spaces"}
            for s in space_hits
        ],
        "teams": [
            {"id": t.id, "name": t.name, "subtitle": f"{t.members} 人", "href": "/teams"}
            for t in team_hits
        ],
    }


def _build_detail(p: models.Project) -> schemas.ProjectDetail:
    base = {k: getattr(p, k) for k in [
        "id", "name", "group", "team_id", "language", "score", "quality",
        "security", "debt", "status", "commits", "contributors", "last_analyzed",
        "dimensions", "contributor_list", "debt_trend", "review_summary", "analysis_meta",
    ]}
    # 存量/导入中的 NULL 会覆盖 Pydantic 默认值，归一化为空集合，保证前端可空态消费。
    for list_key in ("dimensions", "contributor_list", "debt_trend"):
        if base.get(list_key) is None:
            base[list_key] = []
    if not base.get("review_summary"):
        base["review_summary"] = {
            "total": 0, "critical": 0, "open": 0,
            "new_since_last_scan": 0, "in_progress": 0, "resolved": 0,
        }
    if not base.get("analysis_meta"):
        base["analysis_meta"] = {
            "branch": "", "commit": "", "analysis_version": "legacy",
            "scanned_at": "", "coverage": 0, "files_scanned": 0, "confidence": 0,
        }
    return schemas.ProjectDetail(
        **base,
        ai_insights=[schemas.AIReviewInsight.model_validate(i) for i in (p.insights or [])],
        module_risks=[schemas.ModuleRisk.model_validate(m) for m in (p.module_risks or [])],
        fix_priorities=[schemas.FixPriority.model_validate(f) for f in (p.fix_priorities or [])],
    )


@router.get("/projects/{pid}", response_model=schemas.ProjectDetail)
def get_project(
    pid: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    p = db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="项目不存在")
    return _build_detail(p)


@router.post("/projects", response_model=schemas.RepositoryImportResult)
def create_project(
    body: schemas.ProjectCreateRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:write")),
):
    repo_url = (body.repo_url or "").strip()
    if not repo_url:
        raise HTTPException(status_code=400, detail="仓库地址不能为空")

    project_id = f"p-{uuid.uuid4().hex[:6]}"
    run_id = f"run-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    # 加密持久化 access_token
    encrypted_token = encrypt_value(body.access_token)

    # 创建项目（pending）
    project = models.Project(
        id=project_id, name=body.name, group="导入项目", team_id=body.team_id,
        language="unknown", status="pending", commits=0, contributors=0,
        last_analyzed="分析中", tenant_id=ctx.tenant_id,
    )
    db.add(project)
    db.flush()  # 确保 project 先入库，满足 repository/analysis_run 外键
    db.add(models.Repository(
        id=f"r-{uuid.uuid4().hex[:6]}", name=body.name,
        path="",
        source_type="remote", provider=body.provider,
        remote_url=repo_url, branch=body.branch,
        access_token_encrypted=encrypted_token,
        team_id=body.team_id,
        project_id=project_id, status="syncing", last_sync="同步中", tenant_id=ctx.tenant_id,
    ))
    db.add(models.AnalysisRun(
        id=run_id, project_id=project_id, status="queued", progress=0,
        stage="git_collect", message="已加入分析队列", updated_at=now,
        skill_group_id=body.skill_group_id,
    ))
    db.commit()

    # 后台触发分析
    analyze_repository(
        project_id=project_id,
        repo_url=repo_url,
        tenant_id=ctx.tenant_id,
        name=body.name,
        branch=body.branch,
        access_token_encrypted=encrypted_token,
        background=True,
        group_id=body.skill_group_id,
        run_id=run_id,
    )

    return schemas.RepositoryImportResult(
        project_id=project_id, run_id=run_id, source_type="remote",
        provider=body.provider, repository=repo_url, branch=body.branch,
        status="queued",
    )


@router.delete("/projects/{pid}")
def delete_project(
    pid: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:write")),
):
    p = db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 级联删除关联数据。注意顺序：ProjectAssessmentSnapshot 外键引用
    # analysis_runs.id，必须先删 snapshot 再删 analysis_run。
    db.query(models.Insight).filter_by(project_id=pid).delete(synchronize_session=False)
    db.query(models.ModuleRisk).filter_by(project_id=pid).delete(synchronize_session=False)
    db.query(models.FixPriority).filter_by(project_id=pid).delete(synchronize_session=False)
    db.query(models.SkillGroupRun).filter_by(project_id=pid).delete(synchronize_session=False)
    db.query(models.ProjectAssessmentSnapshot).filter_by(project_id=pid).delete(synchronize_session=False)
    db.query(models.EnvInventoryScan).filter_by(project_id=pid).delete(synchronize_session=False)
    db.query(models.EnvInventoryEntry).filter_by(project_id=pid).delete(synchronize_session=False)
    # subject_ids 是 JSON 数组，PG 上不能用 LIKE；记录量小，直接内存过滤删除。
    report_exports = db.query(models.ReportExport).filter_by(tenant_id=ctx.tenant_id).all()
    for export in report_exports:
        if pid in (export.subject_ids or []):
            db.delete(export)
    db.query(models.IdentityMatch).filter_by(project_id=pid).delete(synchronize_session=False)
    db.query(models.Repository).filter_by(project_id=pid).delete(synchronize_session=False)
    db.query(models.DeveloperEvaluation).filter_by(project_id=pid).delete(synchronize_session=False)
    db.query(models.AnalysisRun).filter_by(project_id=pid).delete(synchronize_session=False)

    # 删除本地缓存目录
    cache_dir = os.path.join(settings.repos_cache, ctx.tenant_id, pid)
    shutil.rmtree(cache_dir, ignore_errors=True)

    db.delete(p)
    db.commit()
    return {"ok": True, "id": pid}


@router.post("/projects/{pid}/reanalyze", response_model=schemas.RepositoryImportResult)
def reanalyze_project(
    pid: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:write")),
):
    p = db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="项目不存在")

    repo = db.query(models.Repository).filter_by(project_id=pid, tenant_id=ctx.tenant_id).first()
    if not repo or not repo.remote_url:
        raise HTTPException(status_code=400, detail="项目没有关联的远程仓库，无法重新分析")

    run_id = f"run-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    p.status = "pending"
    p.last_analyzed = "分析中"
    db.add(models.AnalysisRun(
        id=run_id, project_id=pid, status="queued", progress=0,
        stage="git_collect", message="已加入重新分析队列", updated_at=now,
        skill_group_id=repo.skill_group_id if hasattr(repo, "skill_group_id") else None,
    ))
    db.commit()

    analyze_repository(
        project_id=pid,
        repo_url=repo.remote_url,
        tenant_id=ctx.tenant_id,
        name=p.name,
        branch=repo.branch or "main",
        access_token_encrypted=repo.access_token_encrypted,
        background=True,
        run_id=run_id,
    )

    return schemas.RepositoryImportResult(
        project_id=pid, run_id=run_id, source_type="remote",
        provider=repo.provider, repository=repo.remote_url, branch=repo.branch or "main",
        status="queued",
    )


@router.get("/analysis-runs/{run_id}", response_model=schemas.AnalysisRun)
def get_analysis_status(
    run_id: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    run = db.query(models.AnalysisRun).filter_by(id=run_id).first()
    if not run or not db.query(models.Project).filter_by(
        id=run.project_id, tenant_id=ctx.tenant_id,
    ).first():
        raise HTTPException(status_code=404, detail="分析运行不存在")
    return run


# ============ 治理闭环：洞察 / 修复状态变更 ============
@router.patch("/projects/{pid}/insights/{iid}", response_model=schemas.AIReviewInsight)
def update_insight(
    pid: str, iid: str, body: dict = Body(...), db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:write")),
):
    if not db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first():
        raise HTTPException(status_code=404, detail="项目不存在")
    ins = db.query(models.Insight).filter_by(id=iid, project_id=pid).first()
    if not ins:
        raise HTTPException(status_code=404, detail="洞察不存在")
    if "status" in body:
        ins.status = body["status"]
    if "assignee" in body:
        ins.assignee = body["assignee"]
    db.commit()
    db.refresh(ins)
    return ins


@router.patch("/projects/{pid}/fixes/{fid}", response_model=schemas.FixPriority)
def update_fix(
    pid: str, fid: str, body: dict = Body(...), db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:write")),
):
    if not db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first():
        raise HTTPException(status_code=404, detail="项目不存在")
    fix = db.query(models.FixPriority).filter_by(id=fid, project_id=pid).first()
    if not fix:
        raise HTTPException(status_code=404, detail="修复项不存在")
    if "status" in body:
        fix.status = body["status"]
    if "assignee" in body:
        fix.assignee = body["assignee"]
    db.commit()
    db.refresh(fix)
    return fix


# ============ 技术资产 + 身份匹配 ============
@router.get("/projects/{pid}/assets")
def get_assets(
    pid: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    p = db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="项目不存在")
    return p.assets or {"frameworks": [], "dependencies": [], "configs": [], "deployments": []}


@router.get("/projects/{pid}/identity-matches", response_model=list[schemas.IdentityMatch])
def get_project_identity_matches(
    pid: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    if not db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first():
        raise HTTPException(status_code=404, detail="项目不存在")
    return db.query(models.IdentityMatch).filter_by(project_id=pid).all()


@router.get("/projects/{pid}/search")
def search_code_api(
    pid: str,
    q: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    """RAG 语义检索代码 chunk"""
    from ..rag import search_code
    if not db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first():
        raise HTTPException(status_code=404, detail="项目不存在")
    return search_code(pid, q)
