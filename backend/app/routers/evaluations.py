"""开发者能力实测评估 API：触发、查询评估记录与 git 作者列表。"""
import os
import subprocess
import threading
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..access import TenantContext, require_permission
from ..db import SessionLocal, get_db
from ..evaluation import evaluate_developer


router = APIRouter(tags=["developer-evaluations"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _run_evaluation(evaluation_id: str) -> None:
    """为后台线程创建独立会话，避免复用 FastAPI 请求生命周期内的 Session。"""
    db = SessionLocal()
    try:
        evaluate_developer(db, evaluation_id)
    finally:
        db.close()


def _find_developer_or_404(did: str, db: Session) -> models.Developer:
    developer = db.query(models.Developer).filter_by(id=did).first()
    if not developer:
        raise HTTPException(status_code=404, detail="开发者不存在")
    return developer


def read_git_authors(repo_path: str) -> list[str]:
    """仅读取仓库作者列表；租户授权在路由层完成，便于复用和单元验证。"""
    if not os.path.isdir(repo_path):
        raise ValueError("repo_path 不是有效目录")
    try:
        result = subprocess.run(
            ["git", "-C", repo_path, "log", "--format=%an"],
            capture_output=True,
            text=True,
            check=False,
            timeout=15,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ValueError(f"无法读取 git 作者: {exc}") from exc
    if result.returncode != 0:
        raise ValueError("repo_path 不是有效 git 仓库")
    authors: list[str] = []
    seen: set[str] = set()
    for line in result.stdout.splitlines():
        author = line.strip()
        if author and author not in seen:
            seen.add(author)
            authors.append(author)
    return authors


@router.post(
    "/developers/{did}/evaluations",
    status_code=status.HTTP_202_ACCEPTED,
)
def trigger_evaluation(
    did: str,
    body: schemas.EvaluateRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("assessment:run")),
):
    """创建评估记录后异步执行；响应只返回可供前端轮询的 id。"""
    developer = (
        db.query(models.Developer)
        .filter_by(id=did, tenant_id=ctx.tenant_id)
        .first()
    )
    if not developer:
        raise HTTPException(status_code=404, detail="开发者不存在")
    project = (
        db.query(models.Project)
        .filter_by(id=body.project_id, tenant_id=ctx.tenant_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="评估目标项目不存在")
    repository = (
        db.query(models.Repository)
        .filter_by(project_id=body.project_id, tenant_id=ctx.tenant_id)
        .first()
    )
    if not repository or not repository.remote_url:
        raise HTTPException(
            status_code=422,
            detail="评估项目必须已接入远程仓库",
        )
    role_key = body.role_key or developer.role_type
    if not role_key:
        raise HTTPException(status_code=422, detail="开发者未配置角色，请提供 role_key")

    role = (
        db.query(models.CapabilityRole)
        .filter_by(key=role_key, tenant_id=ctx.tenant_id)
        .first()
    )
    skill_group_id = body.skill_group_id
    if skill_group_id is None and role:
        skill_group_id = role.skill_group_id
    if skill_group_id and not db.query(models.SkillGroup).filter_by(
        id=skill_group_id, tenant_id=ctx.tenant_id,
    ).first():
        raise HTTPException(status_code=422, detail="Skill Group 不存在")

    now = _now()
    evaluation = models.DeveloperEvaluation(
        id=f"deval-{uuid.uuid4().hex[:12]}",
        developer_id=developer.id,
        role_key=role_key,
        skill_group_id=skill_group_id,
        tenant_id=ctx.tenant_id,
        project_id=repository.project_id,
        repo_path="",
        git_author=body.git_author,
        branch=repository.branch,
        scores={},
        evidence=[],
        gaps=[],
        summary="",
        status="running",
        error="",
        created_at=now,
        updated_at=now,
    )
    db.add(evaluation)
    db.commit()

    threading.Thread(
        target=_run_evaluation,
        args=(evaluation.id,),
        daemon=True,
    ).start()
    return {"id": evaluation.id, "status": "queued"}


@router.get(
    "/developers/{did}/evaluations",
    response_model=list[schemas.DeveloperEvaluationM],
)
def list_evaluations(
    did: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("assessment:read")),
):
    developer = db.query(models.Developer).filter_by(id=did, tenant_id=ctx.tenant_id).first()
    if not developer:
        raise HTTPException(status_code=404, detail="开发者不存在")
    return (
        db.query(models.DeveloperEvaluation)
        .filter_by(developer_id=did, tenant_id=ctx.tenant_id)
        .order_by(models.DeveloperEvaluation.created_at.desc())
        .all()
    )


@router.get(
    "/developers/{did}/evaluations/latest",
    response_model=schemas.DeveloperEvaluationM | None,
)
def latest_evaluation(
    did: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("assessment:read")),
):
    developer = db.query(models.Developer).filter_by(id=did, tenant_id=ctx.tenant_id).first()
    if not developer:
        raise HTTPException(status_code=404, detail="开发者不存在")
    return (
        db.query(models.DeveloperEvaluation)
        .filter_by(developer_id=did, tenant_id=ctx.tenant_id)
        .order_by(models.DeveloperEvaluation.created_at.desc())
        .first()
    )


@router.get(
    "/developers/{did}/evaluations/{eid}",
    response_model=schemas.DeveloperEvaluationM,
)
def get_evaluation(
    did: str,
    eid: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("assessment:read")),
):
    developer = db.query(models.Developer).filter_by(id=did, tenant_id=ctx.tenant_id).first()
    if not developer:
        raise HTTPException(status_code=404, detail="开发者不存在")
    evaluation = (
        db.query(models.DeveloperEvaluation)
        .filter_by(id=eid, developer_id=did, tenant_id=ctx.tenant_id)
        .first()
    )
    if not evaluation:
        raise HTTPException(status_code=404, detail="评估记录不存在")
    return evaluation


def _project_repo_path(
    db: Session, tenant_id: str, project_id: str
) -> str:
    repository = (
        db.query(models.Repository)
        .filter_by(project_id=project_id, tenant_id=tenant_id)
        .first()
    )
    if not repository or not repository.remote_url:
        raise ValueError("项目未配置远程仓库")
    from ..vcs import ensure_remote_repo
    return ensure_remote_repo(
        repo_url=repository.remote_url,
        project_id=project_id,
        tenant_id=tenant_id,
        branch=repository.branch or "main",
        access_token_encrypted=repository.access_token_encrypted,
    )


@router.get("/git-authors", response_model=list[str])
def list_git_authors(
    project_id: str = Query(...),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("assessment:run")),
):
    """按最近提交顺序返回仓库中的唯一提交作者名。"""
    project = db.query(models.Project).filter_by(id=project_id, tenant_id=ctx.tenant_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    try:
        repo_path = _project_repo_path(db, ctx.tenant_id, project_id)
        return read_git_authors(repo_path)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
