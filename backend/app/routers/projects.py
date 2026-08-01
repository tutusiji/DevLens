"""项目路由：列表 / 详情 / 接入 / 分析运行"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db, SessionLocal
from .. import models, schemas
from ..analyzer import analyze_repository

router = APIRouter()


@router.get("/projects", response_model=list[schemas.Project])
def list_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).all()


def _build_detail(p: models.Project) -> schemas.ProjectDetail:
    base = {k: getattr(p, k) for k in [
        "id", "name", "group", "team_id", "language", "score", "quality",
        "security", "debt", "status", "commits", "contributors", "last_analyzed",
        "dimensions", "contributor_list", "debt_trend", "review_summary", "analysis_meta",
    ]}
    return schemas.ProjectDetail(
        **base,
        ai_insights=[schemas.AIReviewInsight.model_validate(i) for i in p.insights],
        module_risks=[schemas.ModuleRisk.model_validate(m) for m in p.module_risks],
        fix_priorities=[schemas.FixPriority.model_validate(f) for f in p.fix_priorities],
    )


@router.get("/projects/{pid}", response_model=schemas.ProjectDetail)
def get_project(pid: str, db: Session = Depends(get_db)):
    p = db.query(models.Project).filter_by(id=pid).first()
    if not p:
        raise HTTPException(status_code=404, detail="项目不存在")
    return _build_detail(p)


@router.post("/projects", response_model=schemas.RepositoryImportResult)
def create_project(body: schemas.ProjectCreateRequest, db: Session = Depends(get_db)):
    repository = body.repo_url or body.repo_path or ""
    project_id = f"p-{uuid.uuid4().hex[:6]}"
    run_id = f"run-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    # 创建项目（pending）
    project = models.Project(
        id=project_id, name=body.name, group="导入项目", team_id=body.team_id,
        language="unknown", status="pending", commits=0, contributors=0,
        last_analyzed="分析中",
    )
    db.add(project)
    db.flush()  # 确保 project 先入库，满足 repository/analysis_run 外键
    db.add(models.Repository(
        id=f"r-{uuid.uuid4().hex[:6]}", name=body.name,
        path=body.repo_path or f"/data/repos/{body.name}",
        source_type=body.repo_type, provider=body.provider,
        remote_url=body.repo_url, branch=body.branch, team_id=body.team_id,
        project_id=project_id, status="syncing", last_sync="同步中",
    ))
    db.add(models.AnalysisRun(
        id=run_id, project_id=project_id, status="queued", progress=0,
        stage="git_collect", message="已加入分析队列", updated_at=now,
        skill_group_id=body.skill_group_id,
    ))
    db.commit()

    # 同步触发分析（P0：阻塞跑；前端轮询 getAnalysisStatus）
    repo_target = body.repo_url or body.repo_path or ""
    analyze_repository(project_id, repo_target, body.name, body.branch, background=True, group_id=body.skill_group_id)

    return schemas.RepositoryImportResult(
        project_id=project_id, run_id=run_id, source_type=body.repo_type,
        provider=body.provider, repository=repository, branch=body.branch,
        status="queued",
    )


@router.get("/analysis-runs/{run_id}", response_model=schemas.AnalysisRun)
def get_analysis_status(run_id: str, db: Session = Depends(get_db)):
    run = db.query(models.AnalysisRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="分析运行不存在")
    return run


# ============ 治理闭环：洞察 / 修复状态变更 ============
@router.patch("/projects/{pid}/insights/{iid}", response_model=schemas.AIReviewInsight)
def update_insight(pid: str, iid: str, body: dict = Body(...), db: Session = Depends(get_db)):
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
def update_fix(pid: str, fid: str, body: dict = Body(...), db: Session = Depends(get_db)):
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
def get_assets(pid: str, db: Session = Depends(get_db)):
    p = db.query(models.Project).filter_by(id=pid).first()
    if not p:
        raise HTTPException(status_code=404, detail="项目不存在")
    return p.assets or {"frameworks": [], "dependencies": [], "configs": [], "deployments": []}


@router.get("/projects/{pid}/identity-matches", response_model=list[schemas.IdentityMatch])
def get_project_identity_matches(pid: str, db: Session = Depends(get_db)):
    return db.query(models.IdentityMatch).filter_by(project_id=pid).all()


@router.get("/projects/{pid}/search")
def search_code_api(pid: str, q: str):
    """RAG 语义检索代码 chunk"""
    from ..rag import search_code
    return search_code(pid, q)
