"""团队 / 组织 / 身份匹配路由"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..access import TenantContext, require_permission
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
    """基于团队能力缺口生成招聘建议（LLM）。"""
    team_name = _resolve_team_name(db, tid, ctx.tenant_id)
    if not team_name:
        raise HTTPException(status_code=404, detail="团队不存在")

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

    prompt = (
        "你是研发团队负责人。请基于以下团队情况给出招聘建议：\n"
        f"团队：{team_name}\n"
        f"团队成员：\n{member_lines}\n"
        f"能力缺口：\n{gap_lines}\n"
        "请用中文输出，结构：\n"
        "1. 团队现状一句话判断\n"
        "2. 最值得补充的 1-3 个岗位，每个给出：岗位、理由、优先级（高/中/低）\n"
        "3. 若现有成员通过培养即可补齐缺口，说明应优先内部培养的方向\n"
        "控制在 400 字以内，务实具体。"
    )
    try:
        advice = chat([{"role": "user", "content": prompt}], max_tokens=1500)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"生成招聘建议失败: {exc}") from exc

    return {"team_id": tid, "team_name": team_name, "advice": advice}
