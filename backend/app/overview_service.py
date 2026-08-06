"""Overview 概览页真实计算：把 4 组 demo 数据换成数据库真实统计。

每个函数租户隔离、空库安全：数据缺失时返回空结构（路由层保证 HTTP 200），
内部绝不抛异常（Qdrant 探活 try/except 兜底）。
"""
from collections import defaultdict

from . import models
from .config import settings
from .rag import get_qdrant


def _pct(numer: float, denom: float) -> int:
    if not denom:
        return 0
    return max(0, min(100, round(numer / denom * 100)))


def _avg(values: list[int]) -> int:
    return round(sum(values) / len(values)) if values else 0


def compute_trinity_matrix(db, tenant_id: str) -> dict:
    """团队×项目 覆盖矩阵：用 Project.contributor_list（真实 Git 贡献归集）构建邻接。

    回退：项目归属团队（project.team_id）保证至少主责团队有 cell。
    """
    teams = [
        t for t in db.query(models.TeamSpace).filter_by(tenant_id=tenant_id).all()
        if t.member_ids
    ]
    teams.sort(key=lambda t: len(t.member_ids), reverse=True)
    teams = teams[:8]

    projects = db.query(models.Project).filter_by(tenant_id=tenant_id).all()
    projects.sort(key=lambda p: p.commits or 0, reverse=True)
    seen = {}
    for p in projects:  # 按名称去重（保留 commits 最高的），避免同名项目列重复
        if p.name not in seen and len(seen) < 8:
            seen[p.name] = p
    projects = list(seen.values())

    if not teams or not projects:
        return {"rows": [], "cols": [], "cells": []}

    # 开发者名 -> 团队引用（id 优先，兜底团队名）
    dev_team = {}
    for d in db.query(models.Developer).filter_by(tenant_id=tenant_id).all():
        dev_team[d.name] = d.team_id or d.team

    cells = []
    for team in teams:
        row = []
        for project in projects:
            members = [
                c for c in (project.contributor_list or [])
                if (c.get("name") or c.get("username")) and
                dev_team.get(c.get("name") or c.get("username")) in (team.id, team.name)
            ]
            if members:
                top = max(members, key=lambda c: c.get("commits") or 0)
                row.append({
                    "score": project.score or 0,
                    "members": len(members),
                    "owner": top.get("name") or top.get("username"),
                })
            elif project.team_id == team.id:
                row.append({
                    "score": project.score or 0,
                    "members": len(team.member_ids or []),
                    "owner": team.owner_name,
                })
            else:
                row.append(None)
        cells.append(row)

    return {"rows": [t.name for t in teams], "cols": [p.name for p in projects], "cells": cells}


def compute_health_trend(db, tenant_id: str) -> list[dict]:
    """月度健康趋势：从 project_assessment_snapshots 按月聚合（复用 portfolio 基线兜底）。"""
    from .routers.portfolio import ensure_project_baseline_snapshots

    ensure_project_baseline_snapshots(db, tenant_id)

    by_month = defaultdict(lambda: {"quality": [], "security": [], "score": []})
    for s in db.query(models.ProjectAssessmentSnapshot).filter_by(tenant_id=tenant_id).all():
        month = (s.recorded_at or "")[:7]
        if len(month) == 7:
            by_month[month]["quality"].append(s.quality or 0)
            by_month[month]["security"].append(s.security or 0)
            by_month[month]["score"].append(s.score or 0)

    out = []
    for month in sorted(by_month.keys())[-6:]:
        g = by_month[month]
        out.append({
            "month": f"{int(month[5:7])}月",
            "quality": _avg(g["quality"]),
            "security": _avg(g["security"]),
            "health": _avg(g["score"]),
        })
    return out


_LEVEL_WEIGHT = {"high": 3, "medium": 2, "low": 1}


def compute_risk_alerts(db, tenant_id: str) -> list[dict]:
    """真实风险预警：bus_factor / tech_debt / skill_gap，按严重度取前 8。

    ModuleRisk/FixPriority 无 tenant_id 列，须经 Project.tenant_id join 隔离。
    类型限定在前端 RiskType 联合类型内（无 critical_risk）。
    """
    alerts: list[dict] = []
    project_tenant = models.Project.tenant_id

    risks = (
        db.query(models.ModuleRisk, models.Project)
        .join(models.Project, models.ModuleRisk.project_id == models.Project.id)
        .filter(project_tenant == tenant_id)
        .all()
    )

    # bus_factor：ownership 较高且无备份负责人（单点风险，≥70 高危，≥40 中危）
    for risk, project in risks:
        own = risk.ownership or 0
        if own < 40 or risk.backup_owner:
            continue
        alerts.append({
            "id": f"r{len(alerts) + 1}",
            "type": "bus_factor",
            "level": "high" if own >= 70 else "medium",
            "title": f"「{project.name}」{risk.name} Bus Factor = 1",
            "description": f"{risk.owner or '未知'} 独占该模块 {own}% 知识且无备份负责人，存在单点风险",
            "time": project.last_analyzed or risk.last_changed or "最近",
            "action": "识别备份负责人 + 文档沉淀",
        })

    # tech_debt：critical 模块风险
    for risk, project in risks:
        if risk.severity != "critical":
            continue
        alerts.append({
            "id": f"r{len(alerts) + 1}",
            "type": "tech_debt",
            "level": "high",
            "title": f"「{project.name}」存在关键模块风险",
            "description": f"{risk.name} 风险分 {risk.score}，{risk.issue_count} 处问题待处理",
            "time": project.last_analyzed or risk.last_changed or "最近",
            "action": "排期处理关键风险，必要时重构",
        })

    # tech_debt：P0 未关闭修复
    _BARE_SEVERITY = {"high", "medium", "low", "critical", "高", "中", "低"}
    fixes = (
        db.query(models.FixPriority, models.Project)
        .join(models.Project, models.FixPriority.project_id == models.Project.id)
        .filter(
            project_tenant == tenant_id,
            models.FixPriority.priority == "P0",
            models.FixPriority.status == "open",
        )
        .all()
    )
    for fix, project in fixes:
        impact = (fix.impact or "").strip()
        if impact.lower() in _BARE_SEVERITY or len(impact) <= 2:
            impact = "优先排期修复"
        alerts.append({
            "id": f"r{len(alerts) + 1}",
            "type": "tech_debt",
            "level": "medium",
            "title": f"「{project.name}」存在 P0 技术债",
            "description": fix.title or f"{fix.module} 待修复",
            "time": project.last_analyzed or "最近",
            "action": impact,
        })

    # skill_gap：能力标准缺口
    for gap in db.query(models.CapabilityGap).filter_by(tenant_id=tenant_id).all():
        if (gap.current or 0) >= (gap.target or 0):
            continue
        diff = (gap.target or 0) - (gap.current or 0)
        alerts.append({
            "id": f"r{len(alerts) + 1}",
            "type": "skill_gap",
            "level": "medium" if diff >= 20 else "low",
            "title": f"「{gap.capability}」存在能力缺口",
            "description": f"{gap.owner or '成员'} 当前 {gap.current}，目标 {gap.target}，差距 {diff}",
            "time": "最近",
            "action": gap.action or "安排培训 + 结对提升",
        })

    # skill_gap：开发者实测评估缺口
    for ev in db.query(models.DeveloperEvaluation).filter_by(
        tenant_id=tenant_id, status="completed"
    ).all():
        dev = db.query(models.Developer).filter_by(id=ev.developer_id).first()
        dev_name = dev.name if dev else ev.git_author
        for g in ev.gaps or []:
            if (g.get("gap") or 0) < 20:
                continue
            alerts.append({
                "id": f"r{len(alerts) + 1}",
                "type": "skill_gap",
                "level": "medium" if g.get("gap") >= 30 else "low",
                "title": f"「{dev_name}」{g.get('dimension', '')} 实测缺口",
                "description": f"当前 {g.get('current')}，目标 {g.get('target')}，差距 {g.get('gap')}",
                "time": ev.updated_at or "最近",
                "action": "针对性提升该能力维度",
            })

    # 多样性选择：每类最多 3 条，保证 bus_factor / tech_debt / skill_gap 都能露头，
    # 再按严重度全局排序取前 8。
    by_type: dict[str, list[dict]] = {}
    for a in alerts:
        by_type.setdefault(a["type"], []).append(a)
    selected = []
    for typ in ("bus_factor", "tech_debt", "skill_gap"):
        selected.extend(
            sorted(by_type.get(typ, []), key=lambda a: _LEVEL_WEIGHT.get(a["level"], 0), reverse=True)[:3]
        )
    selected.sort(key=lambda a: _LEVEL_WEIGHT.get(a["level"], 0), reverse=True)
    return selected[:8]


def compute_data_sources(db, tenant_id: str) -> list[dict]:
    """真实集成状态：Git / LLM / Qdrant / Env 扫描 / Skill 规则。"""
    total_projects = db.query(models.Project).filter_by(tenant_id=tenant_id).count()

    # Git 仓库
    repos = db.query(models.Repository).filter_by(tenant_id=tenant_id).all()
    synced_repo_projects = {r.project_id for r in repos if r.status == "synced"}

    # LLM 分析（DeepSeek key 是否配置 + 已分析项目占比）
    llm_connected = bool(settings.llm_api_key)
    analyzed_projects = (
        db.query(models.Project)
        .filter(models.Project.tenant_id == tenant_id, models.Project.score.isnot(None))
        .count()
    )

    # 向量库 Qdrant：实时探活 + 已建 collection 的项目占比
    qdrant_connected = False
    qdrant_project_count = 0
    try:
        collections = [c.name for c in get_qdrant().get_collections().collections]
        qdrant_connected = True
        qdrant_ids = {
            name[len("code_"):].replace("_", "-")
            for name in collections if name.startswith("code_")
        }
        if qdrant_ids:
            qdrant_project_count = (
                db.query(models.Project)
                .filter(models.Project.tenant_id == tenant_id, models.Project.id.in_(qdrant_ids))
                .count()
            )
    except Exception:
        qdrant_connected = False

    # Env 扫描（无 tenant_id 列，join Project 隔离）
    scanned_project_ids = {
        row[0]
        for row in db.query(models.EnvInventoryScan.project_id)
        .join(models.Project, models.EnvInventoryScan.project_id == models.Project.id)
        .filter(models.Project.tenant_id == tenant_id)
        .all()
    }

    # Skill 规则
    skills = db.query(models.Skill).filter_by(tenant_id=tenant_id).all()
    enabled_count = sum(1 for s in skills if s.enabled)

    sources = [
        {
            "name": "Git 仓库",
            "coverage": _pct(len(synced_repo_projects), total_projects),
            "status": "connected" if repos else "disconnected",
        },
        {
            "name": "LLM 分析",
            "coverage": _pct(analyzed_projects, total_projects),
            "status": "connected" if llm_connected else "disconnected",
        },
        {
            "name": "向量库 Qdrant",
            "coverage": _pct(qdrant_project_count, total_projects),
            "status": "connected" if qdrant_connected else "disconnected",
        },
        {
            "name": "Env 扫描",
            "coverage": _pct(len(scanned_project_ids), total_projects),
            "status": "connected" if scanned_project_ids else "disconnected",
        },
        {
            "name": "Skill 规则",
            "coverage": _pct(enabled_count, len(skills)),
            "status": "connected" if enabled_count else "disconnected",
        },
    ]

    # 连通但覆盖不全 → partial
    for src in sources:
        if src["status"] == "connected" and src["coverage"] < 100:
            src["status"] = "partial"
    return sources
