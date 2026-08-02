"""项目组合评估：横向对比与评分历史趋势。"""
from datetime import datetime, timedelta, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..access import TenantContext, require_permission
from ..db import get_db


router = APIRouter(tags=["project-portfolio"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_project_baseline_snapshots(db: Session, tenant_id: str) -> int:
    """把既有项目的 debt_trend 转为标准快照，避免升级后趋势页只有一个点。"""
    created = 0
    projects = db.query(models.Project).filter_by(tenant_id=tenant_id).all()
    for project in projects:
        exists = (
            db.query(models.ProjectAssessmentSnapshot)
            .filter_by(project_id=project.id, tenant_id=tenant_id)
            .first()
        )
        if exists:
            continue
        points = project.debt_trend or []
        if points:
            total = len(points)
            for index, point in enumerate(points):
                debt = int(point.get("debt", project.debt or 0))
                # 旧 debt_trend 不含完整分数；以当期项目评分 + 债务差为
                # 基线估计，source 明确标记 legacy_baseline，报告中可审计。
                delta = (project.debt or debt) - debt
                db.add(models.ProjectAssessmentSnapshot(
                    id=f"psnap-{uuid.uuid4().hex[:12]}",
                    tenant_id=tenant_id,
                    project_id=project.id,
                    score=max(0, min(100, (project.score or 0) + delta)),
                    quality=max(0, min(100, (project.quality or 0) + delta)),
                    security=max(0, min(100, (project.security or 0) + delta // 2)),
                    debt=debt,
                    contributors=project.contributors or 0,
                    commits=project.commits or 0,
                    recorded_at=(datetime.now(timezone.utc) - timedelta(days=(total - index) * 30)).isoformat(),
                    source="legacy_baseline",
                ))
                created += 1
        else:
            db.add(models.ProjectAssessmentSnapshot(
                id=f"psnap-{uuid.uuid4().hex[:12]}",
                tenant_id=tenant_id,
                project_id=project.id,
                score=project.score or 0,
                quality=project.quality or 0,
                security=project.security or 0,
                debt=project.debt or 0,
                contributors=project.contributors or 0,
                commits=project.commits or 0,
                recorded_at=_now(),
                source="baseline",
            ))
            created += 1
    if created:
        db.commit()
    return created


def comparison_data(
    db: Session,
    tenant_id: str,
    project_ids: list[str] | None = None,
) -> list[dict]:
    """供 API 与报告复用的当前项目组合数据。"""
    ensure_project_baseline_snapshots(db, tenant_id)
    query = db.query(models.Project).filter_by(tenant_id=tenant_id)
    if project_ids:
        query = query.filter(models.Project.id.in_(project_ids))
    projects = query.all()
    by_project: list[dict] = []
    for project in projects:
        snapshots = (
            db.query(models.ProjectAssessmentSnapshot)
            .filter_by(project_id=project.id, tenant_id=tenant_id)
            .order_by(models.ProjectAssessmentSnapshot.recorded_at.desc())
            .limit(2)
            .all()
        )
        previous = snapshots[1] if len(snapshots) > 1 else None
        current_score = project.score or (snapshots[0].score if snapshots else 0)
        by_project.append({
            "project_id": project.id,
            "project_name": project.name,
            "language": project.language or "",
            "score": current_score,
            "quality": project.quality or 0,
            "security": project.security or 0,
            "debt": project.debt or 0,
            "contributors": project.contributors or 0,
            "commits": project.commits or 0,
            "last_analyzed": project.last_analyzed or "",
            "score_delta": current_score - previous.score if previous else None,
        })
    return sorted(by_project, key=lambda item: (-item["score"], item["project_name"]))


@router.get("/project-comparisons", response_model=schemas.ProjectComparisonResponse)
def get_project_comparison(
    project_ids: str = Query(default="", description="逗号分隔的项目 ID；为空时取当前租户全部项目"),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("comparison:read")),
):
    ids = [project_id.strip() for project_id in project_ids.split(",") if project_id.strip()]
    results = comparison_data(db, ctx.tenant_id, ids or None)
    if ids and len(results) != len(set(ids)):
        raise HTTPException(status_code=404, detail="至少一个项目不存在或不属于当前租户")
    return {"projects": results, "generated_at": _now()}


@router.get("/projects/{pid}/trend", response_model=schemas.ProjectTrendResponse)
def get_project_trend(
    pid: str,
    limit: int = Query(default=24, ge=2, le=120),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("comparison:read")),
):
    project = db.query(models.Project).filter_by(id=pid, tenant_id=ctx.tenant_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    ensure_project_baseline_snapshots(db, ctx.tenant_id)
    snapshots = (
        db.query(models.ProjectAssessmentSnapshot)
        .filter_by(project_id=pid, tenant_id=ctx.tenant_id)
        .order_by(models.ProjectAssessmentSnapshot.recorded_at.asc())
        .limit(limit)
        .all()
    )
    return {
        "project_id": project.id,
        "project_name": project.name,
        "snapshots": snapshots,
    }
