"""团队 / 组织 / 身份匹配路由"""
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..access import TenantContext, require_permission

router = APIRouter()


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
