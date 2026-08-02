"""项目级代码图谱与组织级架构设计图谱 API。"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..access import TenantContext, require_permission
from ..architecture import (
    ARCHITECTURE_DESIGN_VERSION,
    build_project_code_graph,
    derive_architecture_design,
)
from ..db import get_db


router = APIRouter(tags=["architecture-design"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _project_or_404(pid: str, db: Session, tenant_id: str) -> models.Project:
    project = db.query(models.Project).filter_by(id=pid, tenant_id=tenant_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


def _architecture_design_for(project: models.Project) -> tuple[dict, bool]:
    """返回当前提取规则版本的方案；旧快照会在首次访问时无缝刷新。"""
    existing = project.architecture_design or {}
    if existing.get("extraction_version") == ARCHITECTURE_DESIGN_VERSION:
        return existing, False
    return derive_architecture_design(project), True


@router.get("/projects/{pid}/graph", response_model=schemas.GraphData)
def get_project_code_graph(
    pid: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    """模块/import 图谱：强制绑定单个项目，避免跨项目模块混合。"""
    return build_project_code_graph(_project_or_404(pid, db, ctx.tenant_id))


@router.get("/projects/{pid}/architecture-design", response_model=schemas.ArchitectureDesignM)
def get_project_architecture_design(
    pid: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    project = _project_or_404(pid, db, ctx.tenant_id)
    design, should_persist = _architecture_design_for(project)
    # 旧项目首次访问时补齐方案；提取规则升级时也会刷新历史脏快照。
    if should_persist:
        project.architecture_design = design
        db.commit()
    return design


@router.get("/architecture-designs", response_model=schemas.ArchitectureDesignListResponse)
def list_architecture_designs(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    """架构设计图谱中心：项目级设计方案列表，而非混合的全局代码依赖图。"""
    projects = (
        db.query(models.Project)
        .filter_by(tenant_id=ctx.tenant_id)
        .order_by(models.Project.score.desc(), models.Project.name.asc())
        .all()
    )
    designs = []
    changed = False
    for project in projects:
        design, should_persist = _architecture_design_for(project)
        if should_persist:
            project.architecture_design = design
            changed = True
        designs.append(design)
    if changed:
        db.commit()
    return {"designs": designs, "generated_at": _now()}
