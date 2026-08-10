"""团队 / 组织 / 身份匹配路由"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..access import TenantContext, require_permission
from ..capability import DIMENSION_LABELS
from ..llm import chat

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _team_developers(db: Session, team_id: str) -> list[models.Developer]:
    """取组织树团队（team_spaces）下的开发者；同时兼容旧 team_id 字段。"""
    return (
        db.query(models.Developer)
        .filter(
            (models.Developer.team_space_id == team_id)
            | (models.Developer.team_id == team_id)
            | (models.Developer.group_id == team_id)
        )
        .all()
    )


def _member_dimension_scores(db: Session, dev: models.Developer) -> dict[str, int]:
    """聚合成员能力分：优先 capability 向量，其次最近一次评估分数。"""
    cap = dev.capability or {}
    if cap:
        return {k: _to_score(v) for k, v in cap.items() if isinstance(v, (int, float))}
    latest = (
        db.query(models.DeveloperEvaluation)
        .filter_by(developer_id=dev.id, status="completed")
        .order_by(models.DeveloperEvaluation.created_at.desc())
        .first()
    )
    if latest and latest.scores:
        return {k: _to_score(v) for k, v in latest.scores.items()}
    return {}


def _to_score(value) -> int:
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return 0


def _resolve_team_name(db: Session, tid: str, tenant_id: str) -> str | None:
    """解析团队显示名：优先 TeamSpace，其次业务 Team。"""
    space = db.query(models.TeamSpace).filter_by(id=tid, tenant_id=tenant_id).first()
    if space:
        return space.name
    team = db.query(models.Team).filter_by(id=tid, tenant_id=tenant_id).first()
    if team:
        return team.name
    return None


@router.get("/large-teams", response_model=list[schemas.LargeTeamM])
def large_teams(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    return []


@router.get("/teams", response_model=list[schemas.Team])
def list_teams(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    return db.query(models.Team).filter_by(tenant_id=ctx.tenant_id).all()


@router.get("/capability-gaps", response_model=list[schemas.CapabilityGap])
def capability_gaps(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("assessment:read")),
):
    return db.query(models.CapabilityGap).filter_by(tenant_id=ctx.tenant_id).all()


@router.get("/identity-matches", response_model=list[schemas.IdentityMatch])
def identity_matches(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("developer:read")),
):
    return db.query(models.IdentityMatch).filter_by(tenant_id=ctx.tenant_id).all()


@router.get("/team-spaces", response_model=list[schemas.TeamSpace])
def team_spaces(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    spaces = db.query(models.TeamSpace).filter_by(tenant_id=ctx.tenant_id).all()
    names = {s.id: s.name for s in spaces}
    out = []
    for s in spaces:
        d = {c.name: getattr(s, c.name) for c in models.TeamSpace.__table__.columns}
        d["parent_name"] = names.get(s.parent_id)
        out.append(d)
    return out


@router.get("/team-groups", response_model=list[schemas.TeamGroup])
def team_groups(
    team_id: str | None = None, db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    return []


@router.post("/team-spaces", response_model=schemas.TeamSpace, status_code=status.HTTP_201_CREATED)
def create_team_space(
    body: schemas.TeamSpaceUpsert, db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:write")),
):
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="团队名称不能为空")
    parent_id = body.parent_id or None  # 空串归一为根（None）
    if parent_id:
        parent = db.query(models.TeamSpace).filter_by(id=parent_id, tenant_id=ctx.tenant_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="父团队不存在")
    space = models.TeamSpace(
        id=f"team-{uuid.uuid4().hex[:6]}", tenant_id=ctx.tenant_id, parent_id=parent_id,
        name=body.name.strip(), description=body.description,
        owner_id=body.owner_id, owner_name=body.owner_name, status="active",
        created_at="刚刚", updated_at="刚刚",
        member_ids=[body.owner_id] if body.owner_id else [], project_ids=[],
    )
    db.add(space)
    db.commit()
    db.refresh(space)
    return space


@router.patch("/team-spaces/{space_id}", response_model=schemas.TeamSpace)
def update_team_space(
    space_id: str, body: schemas.TeamSpaceUpsert, db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:write")),
):
    space = db.query(models.TeamSpace).filter_by(id=space_id, tenant_id=ctx.tenant_id).first()
    if not space:
        raise HTTPException(status_code=404, detail="团队不存在")
    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        name = data["name"]
        if not name or not name.strip():
            raise HTTPException(status_code=422, detail="团队名称不能为空")
        space.name = name.strip()
    if "description" in data:
        space.description = data["description"]
    if "owner_id" in data:
        space.owner_id = data["owner_id"]
        space.owner_name = data.get("owner_name")  # PATCH 可能只带 ownerId
    if "parent_id" in data:
        new_parent = data["parent_id"] or None   # 空串/None 均归一为根（移到根）
        if new_parent == space.id:
            raise HTTPException(status_code=422, detail="父团队不能是自己")
        if new_parent:
            parent = db.query(models.TeamSpace).filter_by(id=new_parent, tenant_id=ctx.tenant_id).first()
            if not parent:
                raise HTTPException(status_code=404, detail="父团队不存在")
            cur = parent
            seen = set()  # 防御脏数据中的环，避免无限循环
            while cur:
                if cur.id in seen:
                    break
                seen.add(cur.id)
                if cur.id == space.id:
                    raise HTTPException(status_code=422, detail="父团队不能是自身的子团队")
                cur = db.query(models.TeamSpace).filter_by(id=cur.parent_id, tenant_id=ctx.tenant_id).first() if cur.parent_id else None
        space.parent_id = new_parent
    space.updated_at = "刚刚"
    db.commit()
    db.refresh(space)
    return space


@router.post("/team-groups", response_model=list[schemas.TeamGroup])
def create_team_group(
    body: dict = Body(...), db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:write")),
):
    return []


# ============ P5：团队预测与招聘建议 ============
@router.get("/teams/{tid}/forecast")
def team_forecast(
    tid: str,
    horizon: int = Query(default=4, ge=1, le=12),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("comparison:read")),
):
    """团队健康度 / 能力预测。

    数据来源：团队成员最近一次实测评估的维度均值，叠加团队所属项目的评分快照
    趋势，做 4 期线性外推。数据不足 2 期时返回 only_observed。
    """
    team_name = _resolve_team_name(db, tid, ctx.tenant_id) or tid

    devs = _team_developers(db, tid)
    latest_scores: list[dict] = []
    for dev in devs:
        evaluation = (
            db.query(models.DeveloperEvaluation)
            .filter_by(developer_id=dev.id, tenant_id=ctx.tenant_id, status="completed")
            .order_by(models.DeveloperEvaluation.created_at.desc())
            .first()
        )
        if evaluation and evaluation.scores:
            latest_scores.append(evaluation.scores)

    def _avg(dim: str) -> float:
        values = [s.get(dim) for s in latest_scores if s.get(dim) is not None]
        return sum(values) / len(values) if values else 0.0

    dims = sorted({k for s in latest_scores for k in s.keys()})
    # 用团队项目 snapshot 补历史序列
    snapshots = (
        db.query(models.ProjectAssessmentSnapshot)
        .filter_by(tenant_id=ctx.tenant_id)
        .order_by(models.ProjectAssessmentSnapshot.recorded_at.asc())
        .all()
    )
    team_snapshot_avg: dict[str, list[int]] = {}
    for snap in snapshots:
        key = snap.recorded_at[:7]
        team_snapshot_avg.setdefault(key, []).append(snap.score or 0)
    hist = [sum(v) / len(v) for v in team_snapshot_avg.values()]

    if len(hist) < 2:
        return {
            "team_id": tid,
            "team_name": team_name,
            "only_observed": True,
            "dimensions": dims,
            "dimension_scores": {d: round(_avg(d) or 0) for d in dims},
            "observations": [{"period": k, "score": round(sum(v) / len(v))} for k, v in team_snapshot_avg.items()],
            "forecast": [],
            "model": "insufficient-data",
        }

    n = len(hist)
    xs = list(range(n))
    x_mean = sum(xs) / n
    y_mean = sum(hist) / n
    slope = sum((xs[i] - x_mean) * (hist[i] - y_mean) for i in range(n)) / sum((xs[i] - x_mean) ** 2 for i in range(n))
    forecast = []
    for step in range(1, horizon + 1):
        predicted = max(0, min(100, round(hist[-1] + slope * step)))
        forecast.append({
            "period": f"T+{step}",
            "score": predicted,
            "trend": "up" if predicted > hist[-1] else ("down" if predicted < hist[-1] else "stable"),
        })

    return {
        "team_id": tid,
        "team_name": team_name,
        "only_observed": False,
        "dimensions": dims,
        "dimension_scores": {d: round(_avg(d) or 0) for d in dims},
        "observations": [{"period": k, "score": round(sum(v) / len(v))} for k, v in team_snapshot_avg.items()],
        "forecast": forecast,
        "model": "linear-regression",
    }


@router.get("/risk-center")
def risk_center(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    """组织风险预警中心：聚合 Bus Factor / 能力缺口 / 技术债 / 项目健康，
    按阈值分级为 P0（立即处理）/ P1（两周内）/ P2（持续关注）。"""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    alerts: list[dict] = []

    # 1. Bus Factor 风险：按团队聚合开发者的模块 ownership 分布估算
    teams = db.query(models.Team).filter_by(tenant_id=ctx.tenant_id).all()
    for team in teams:
        if team.bus_factor is not None and team.bus_factor <= 2:
            alerts.append({
                "level": "P0" if team.bus_factor <= 1 else "P1",
                "category": "bus_factor",
                "title": f"团队「{team.name}」关键人风险（Bus Factor {team.bus_factor}）",
                "detail": "核心贡献集中在极少数人，需尽快补充备份负责人或知识交接。",
                "owner": team.name,
            })

    # 2. 能力缺口：capability_gaps 缺口 >= 30 视为高危
    gaps = db.query(models.CapabilityGap).filter_by(tenant_id=ctx.tenant_id).all()
    for gap in gaps:
        diff = (gap.target or 0) - (gap.current or 0)
        if diff >= 30:
            alerts.append({
                "level": "P0" if diff >= 40 else "P1",
                "category": "skill_gap",
                "title": f"能力缺口严重：{gap.capability}（当前 {gap.current or 0} → 目标 {gap.target or 0}）",
                "detail": f"差距 {diff} 分，负责人 {gap.owner or '未分配'}",
                "owner": gap.owner or "",
            })

    # 3. 项目健康：score < 60 或债务高
    projects = db.query(models.Project).filter_by(tenant_id=ctx.tenant_id).all()
    for p in projects:
        score = p.score or 0
        if score and score < 60:
            alerts.append({
                "level": "P1",
                "category": "tech_debt",
                "title": f"项目「{p.name}」健康度偏低（{score}）",
                "detail": "低于 60 分阈值，建议安排技术债治理。",
                "owner": p.team_id or "",
            })

    # 4. 无评估记录的高危团队：长期未做能力评估
    stale_days_threshold = 90
    for team in teams:
        devs = _team_developers(db, team.id)
        if not devs:
            continue
        evaluated = False
        for dev in devs[:8]:
            if db.query(models.DeveloperEvaluation).filter_by(
                developer_id=dev.id, tenant_id=ctx.tenant_id, status="completed",
            ).first():
                evaluated = True
                break
        if not evaluated:
            alerts.append({
                "level": "P2",
                "category": "stale_assessment",
                "title": f"团队「{team.name}」缺少近期能力评估",
                "detail": f"{len(devs)} 名成员均无完成的实测评估，能力盲区持续。",
                "owner": team.name,
            })

    # 排序：P0 > P1 > P2
    level_rank = {"P0": 0, "P1": 1, "P2": 2}
    alerts.sort(key=lambda a: (level_rank.get(a["level"], 9), a["category"]))
    return {
        "generated_at": now.isoformat(),
        "summary": {
            "total": len(alerts),
            "P0": sum(1 for a in alerts if a["level"] == "P0"),
            "P1": sum(1 for a in alerts if a["level"] == "P1"),
            "P2": sum(1 for a in alerts if a["level"] == "P2"),
        },
        "alerts": alerts,
    }


@router.post("/teams/{tid}/hiring-advice")
def team_hiring_advice(
    tid: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("assessment:run")),
):
    """基于团队能力缺口生成招聘建议（Skill 驱动）。"""
    from ..analysis_rules import get_group, render_prompt

    team_name = _resolve_team_name(db, tid, ctx.tenant_id) or tid

    devs = _team_developers(db, tid)
    gaps = db.query(models.CapabilityGap).filter_by(tenant_id=ctx.tenant_id).all()

    gap_lines = "\n".join(
        f"- {g.capability}: 当前 {g.current}，目标 {g.target}（缺口 {g.target - g.current}，负责人 {g.owner or '未分配'}）"
        for g in gaps[:6]
    ) or "- 暂无明确能力缺口记录"
    member_lines = "\n".join(
        f"- {d.name}（{d.role or d.role_type or '角色未知'}，职级 {d.level or '未定'}）"
        for d in devs[:12]
    ) or "- 团队成员数据不足"

    group = get_group(db, ctx.tenant_id, "hiring_advice")
    if group:
        prompt = render_prompt(group, db, team_name=team_name, member_lines=member_lines, gap_lines=gap_lines)
    else:
        from ..analysis_rules import BUILTIN_GROUP_TEMPLATES
        prompt = BUILTIN_GROUP_TEMPLATES["hiring_advice"].format(
            team_name=team_name, member_lines=member_lines, gap_lines=gap_lines, rules="- 无额外规则",
        )
    try:
        advice = chat([{"role": "user", "content": prompt}], max_tokens=1500)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"生成招聘建议失败: {exc}") from exc

    return {"team_id": tid, "team_name": team_name, "advice": advice}


# ============ 团队分析模型：技能矩阵 / 冰山模型 / SWOT ============
@router.get("/teams/{tid}/skills-matrix", response_model=schemas.SkillsMatrixM)
def team_skills_matrix(
    tid: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    """技能矩阵（Skills Matrix）：团队成员 × 能力维度 分数矩阵。"""
    team_name = _resolve_team_name(db, tid, ctx.tenant_id) or tid
    devs = _team_developers(db, tid)

    members = []
    for dev in devs:
        scores = _member_dimension_scores(db, dev)
        members.append({
            "id": dev.id,
            "name": dev.name,
            "role": dev.role or dev.role_type or "",
            "level": dev.level or "",
            "scores": scores,
        })

    # 统一维度：按出现频率排序，取前 12 个
    dim_count: dict[str, int] = {}
    for m in members:
        for dim in m["scores"]:
            dim_count[dim] = dim_count.get(dim, 0) + 1
    dimensions = sorted(dim_count, key=lambda d: (-dim_count[d], d))[:12]

    # 团队平均分
    team_avg: dict[str, float] = {}
    for dim in dimensions:
        values = [m["scores"].get(dim) for m in members if m["scores"].get(dim) is not None]
        team_avg[dim] = round(sum(values) / len(values), 1) if values else 0.0

    return {
        "team_id": tid,
        "team_name": team_name,
        "dimensions": dimensions,
        "dimension_labels": {d: DIMENSION_LABELS.get(d, d) for d in dimensions},
        "members": members,
        "team_average": team_avg,
        "member_count": len(members),
    }


@router.get("/teams/{tid}/iceberg", response_model=schemas.IcebergM)
def team_iceberg(
    tid: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    """冰山模型（Iceberg Model）：显性能力（水面以上）vs 隐性特质（水面以下）。

    显性层来自能力分数；隐性层来自行为证据（节奏/稳定性/协作等）与协作类维度。
    """
    team_name = _resolve_team_name(db, tid, ctx.tenant_id) or tid
    devs = _team_developers(db, tid)

    # 显性：团队平均能力分（8 个标准维度）
    explicit: list[dict] = []
    dim_scores: dict[str, list[int]] = {}
    for dev in devs:
        for dim, score in _member_dimension_scores(db, dev).items():
            dim_scores.setdefault(dim, []).append(score)
    for dim, values in dim_scores.items():
        explicit.append({
            "label": DIMENSION_LABELS.get(dim, dim),
            "score": round(sum(values) / len(values)),
            "description": f"{len(values)} 名成员有效数据",
        })
    explicit.sort(key=lambda x: x["score"], reverse=True)

    # 隐性：行为证据聚合（每成员取最近评估关联的 behavior_evidence）
    implicit: list[dict] = []
    behavior_agg: dict[str, list[float]] = {}
    for dev in devs:
        for item in (dev.behavior_evidence or []):
            label = item.get("label", "")
            value = item.get("value")
            if label and isinstance(value, (int, float)):
                behavior_agg.setdefault(label, []).append(value)
    for label, values in behavior_agg.items():
        avg = sum(values) / len(values)
        # 规整到 0-100（对比 benchmark 的超越比例）
        benchmark = None
        for dev in devs:
            for item in (dev.behavior_evidence or []):
                if item.get("label") == label:
                    benchmark = item.get("benchmark")
                    break
            if benchmark is not None:
                break
        normalized = 50
        if benchmark:
            normalized = max(0, min(100, round(50 + (avg - benchmark) / benchmark * 50)))
        implicit.append({
            "label": label,
            "value": round(avg, 2),
            "score": normalized,
            "benchmark": benchmark or 0,
            "description": f"样本 {len(values)} 人",
        })

    # 兜底：若行为数据不足，用协作/成长类维度作为隐性代理
    if not implicit:
        for key in ("collaboration", "growth_velocity"):
            if key in dim_scores:
                implicit.append({
                    "label": DIMENSION_LABELS.get(key, key),
                    "value": round(sum(dim_scores[key]) / len(dim_scores[key]), 2),
                    "score": round(sum(dim_scores[key]) / len(dim_scores[key])),
                    "benchmark": 0,
                    "description": "由能力维度推导",
                })

    return {
        "team_id": tid,
        "team_name": team_name,
        "explicit": explicit[:10],
        "implicit": implicit[:10],
        "member_count": len(devs),
    }


@router.post("/teams/{tid}/swot", response_model=schemas.SwotResultM)
def team_swot(
    tid: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("assessment:read")),
):
    """SWOT 模型分析（Skill 驱动）：prompt 由绑定的 skill group 装配，规则资产化。"""
    from ..analysis_rules import get_group, render_prompt

    team_name = _resolve_team_name(db, tid, ctx.tenant_id) or tid
    devs = _team_developers(db, tid)

    # 团队能力均值
    dim_scores: dict[str, list[int]] = {}
    for dev in devs:
        for dim, score in _member_dimension_scores(db, dev).items():
            dim_scores.setdefault(dim, []).append(score)
    cap_lines = "\n".join(
        f"- {DIMENSION_LABELS.get(k, k)}: {round(sum(v) / len(v))}"
        for k, v in sorted(dim_scores.items(), key=lambda x: -sum(x[1]) / len(x[1]))[:8]
    ) or "- 暂无能力数据"
    member_lines = "\n".join(
        f"- {d.name}（{d.role or d.role_type or '角色未知'}，职级 {d.level or '未定'}，综合 {d.overall or 0}）"
        for d in devs[:12]
    ) or "- 成员数据不足"
    projects = db.query(models.Project).filter_by(tenant_id=ctx.tenant_id).all()
    proj_lines = "\n".join(
        f"- {p.name}: 健康度 {p.score or 0}，commits {p.commits or 0}"
        for p in sorted(projects, key=lambda x: x.score or 0)[:5]
    ) or "- 无关联项目数据"
    gaps = db.query(models.CapabilityGap).filter_by(tenant_id=ctx.tenant_id).all()
    gap_lines = "\n".join(f"- {g.capability}: 差距 {(g.target or 0) - (g.current or 0)}" for g in gaps[:5]) or "- 无能力缺口记录"

    group = get_group(db, ctx.tenant_id, "swot")
    if group:
        prompt = render_prompt(
            group, db,
            team_name=team_name,
            member_lines=member_lines,
            cap_lines=cap_lines,
            proj_lines=proj_lines,
            gap_lines=gap_lines,
        )
    else:  # 兜底：库内无组时用内置模板
        from ..analysis_rules import BUILTIN_GROUP_TEMPLATES
        prompt = BUILTIN_GROUP_TEMPLATES["swot"].format(
            team_name=team_name, member_lines=member_lines, cap_lines=cap_lines,
            proj_lines=proj_lines, gap_lines=gap_lines, rules="- 无额外规则",
        )
    import json
    try:
        text = chat([{"role": "user", "content": prompt}], max_tokens=2000)
        m = text[text.find("{"): text.rfind("}") + 1]
        data = json.loads(m)
        for key in ("strengths", "weaknesses", "opportunities", "threats"):
            if not isinstance(data.get(key), list):
                data[key] = []
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"生成 SWOT 分析失败: {exc}") from exc

    return {"team_id": tid, "team_name": team_name, "swot": data}
