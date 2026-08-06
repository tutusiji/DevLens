"""首页概览路由"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..access import TenantContext, require_permission
from ..overview_service import (
    compute_data_sources,
    compute_health_trend,
    compute_risk_alerts,
    compute_trinity_matrix,
)

router = APIRouter()


@router.get("/overview", response_model=list[schemas.StatItem])
def get_overview(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    proj = db.query(models.Project).filter_by(tenant_id=ctx.tenant_id).count()
    dev = db.query(models.Developer).filter_by(tenant_id=ctx.tenant_id).count()
    team = db.query(models.Team).filter_by(tenant_id=ctx.tenant_id).count()
    avg = (
        db.query(func.avg(models.Project.score))
        .filter(models.Project.score.isnot(None), models.Project.tenant_id == ctx.tenant_id)
        .scalar()
        or 78.4
    )
    avg = round(float(avg), 1)
    return [
        {"label": "接入项目", "value": proj, "unit": "个", "delta": 2, "trend": [8, 9, 10, 11, proj], "icon": "folder-git-2"},
        {"label": "开发者", "value": dev, "unit": "人", "delta": 5, "trend": [38, 40, 42, 45, dev], "icon": "users"},
        {"label": "团队", "value": team, "unit": "个", "delta": 0, "trend": [6, 6, 6, 6, team], "icon": "network"},
        {"label": "平均健康度", "value": avg, "unit": "分", "delta": 3.2, "trend": [72, 74, 75, 77, avg], "icon": "heart-pulse"},
    ]


@router.get("/trinity-matrix", response_model=schemas.TrinityMatrix)
def get_trinity(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    return compute_trinity_matrix(db, ctx.tenant_id)


@router.get("/health-trend", response_model=list[schemas.HealthTrendPoint])
def get_health(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    return compute_health_trend(db, ctx.tenant_id)


@router.get("/risk-alerts", response_model=list[schemas.RiskAlert])
def get_alerts(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    return compute_risk_alerts(db, ctx.tenant_id)


@router.get("/data-sources", response_model=list[schemas.DataSource])
def get_sources(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    return compute_data_sources(db, ctx.tenant_id)


@router.get("/active-projects", response_model=list[schemas.ActiveProject])
def active_projects(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    items = db.query(models.Project).filter(
        models.Project.status != "failed",
        models.Project.tenant_id == ctx.tenant_id,
    ).all()
    items.sort(key=lambda p: p.commits + (p.contributors or 0) * 200, reverse=True)
    out = []
    for p in items[:5]:
        trend = "up" if p.status == "analyzing" else ("stable" if (p.score or 0) >= 80 else "down")
        out.append({"id": p.id, "name": p.name, "language": p.language or "", "commits": p.commits, "contributors": p.contributors, "trend": trend})
    return out


@router.get("/active-developers", response_model=list[schemas.ActiveDeveloper])
def active_developers(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("developer:read")),
):
    items = db.query(models.Developer).filter_by(tenant_id=ctx.tenant_id).all()
    items.sort(key=lambda d: d.commits + d.reviews * 3, reverse=True)
    out = []
    for d in items[:5]:
        trend = "up" if d.overall >= 85 else ("stable" if d.overall >= 70 else "down")
        out.append({"id": d.id, "name": d.name, "role": d.role, "team": d.team, "commits": d.commits, "reviews": d.reviews, "trend": trend})
    return out


@router.get("/active-teams", response_model=list[schemas.ActiveTeam])
def active_teams(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    items = db.query(models.Team).filter_by(tenant_id=ctx.tenant_id).all()
    items.sort(key=lambda t: (t.avg_score or 0) + (t.members or 0) * 2, reverse=True)
    out = []
    for t in items[:5]:
        score = t.avg_score or 0
        trend = "up" if score >= 85 else ("stable" if score >= 70 else "down")
        out.append({"id": t.id, "name": t.name, "members": t.members, "score": score, "trend": trend})
    return out
