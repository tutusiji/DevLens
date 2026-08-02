"""首页概览路由"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..access import TenantContext, require_permission

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
def get_trinity(ctx: TenantContext = Depends(require_permission("project:read"))):
    return {
        "rows": ["平台架构组", "业务中台组", "前端体验组", "数据智能组", "基础架构组"],
        "cols": ["用户中心", "订单系统", "数据网关", "支付平台", "内容引擎"],
        "cells": [
            [{"score": 88, "members": 4, "owner": "陈思"}, {"score": 72, "members": 2, "owner": "陈思"}, None, {"score": 65, "members": 1}, None],
            [{"score": 81, "members": 5, "owner": "林涛"}, {"score": 90, "members": 6, "owner": "林涛"}, {"score": 76, "members": 3}, None, {"score": 68, "members": 2}],
            [None, {"score": 74, "members": 2}, {"score": 85, "members": 4, "owner": "王琳"}, None, {"score": 92, "members": 5, "owner": "王琳"}],
            [{"score": 69, "members": 1}, {"score": 77, "members": 3}, {"score": 94, "members": 7, "owner": "赵磊"}, {"score": 82, "members": 4, "owner": "赵磊"}, None],
            [{"score": 58, "members": 1}, None, {"score": 71, "members": 2}, {"score": 79, "members": 3}, {"score": 84, "members": 4}],
        ],
    }


@router.get("/health-trend", response_model=list[schemas.HealthTrendPoint])
def get_health(ctx: TenantContext = Depends(require_permission("project:read"))):
    return [
        {"month": "2月", "quality": 72, "security": 68, "health": 70},
        {"month": "3月", "quality": 74, "security": 71, "health": 72},
        {"month": "4月", "quality": 73, "security": 75, "health": 74},
        {"month": "5月", "quality": 78, "security": 76, "health": 76},
        {"month": "6月", "quality": 80, "security": 78, "health": 77},
        {"month": "7月", "quality": 82, "security": 79, "health": 78},
    ]


@router.get("/risk-alerts", response_model=list[schemas.RiskAlert])
def get_alerts(ctx: TenantContext = Depends(require_permission("project:read"))):
    return [
        {"id": "r1", "type": "skill_gap", "level": "high", "title": "数据智能组「安全意识」覆盖率仅 18%", "description": "7 名成员中仅 1 人安全维度 >=60，支付平台存在单点风险", "time": "2小时前", "action": "安排安全培训 + 代码审查配对"},
        {"id": "r2", "type": "bus_factor", "level": "high", "title": "内容引擎 Bus Factor = 1", "description": "王琳独占 92 分模块知识，离职将导致项目停摆", "time": "5小时前", "action": "识别备份负责人 + 文档沉淀"},
        {"id": "r3", "type": "high_variance", "level": "medium", "title": "基础架构组能力差异过大", "description": "架构能力维度标准差 24，新人难以承接核心模块", "time": "1天前", "action": "拆分任务粒度 + 结对编程"},
        {"id": "r4", "type": "tech_debt", "level": "medium", "title": "用户中心技术债持续上升", "description": "近 3 月技术债评分从 78 降至 65，复杂度集中在认证模块", "time": "1天前", "action": "排期重构认证流程"},
        {"id": "r5", "type": "skill_gap", "level": "low", "title": "前端体验组测试覆盖偏低", "description": "团队测试维度均值 52，低于全公司 68 的平均水平", "time": "2天前", "action": "引入测试覆盖率门禁"},
    ]


@router.get("/data-sources", response_model=list[schemas.DataSource])
def get_sources(ctx: TenantContext = Depends(require_permission("project:read"))):
    return [
        {"name": "GitLab 仓库", "coverage": 100, "status": "connected"},
        {"name": "Merge Request", "coverage": 92, "status": "connected"},
        {"name": "Issue 跟踪", "coverage": 78, "status": "partial"},
        {"name": "CI/CD 流水线", "coverage": 65, "status": "partial"},
        {"name": "代码质量扫描", "coverage": 40, "status": "disconnected"},
    ]


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
