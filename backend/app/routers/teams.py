"""团队 / 组织 / 身份匹配路由"""
import uuid

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas

router = APIRouter()


@router.get("/large-teams", response_model=list[schemas.LargeTeamM])
def large_teams(db: Session = Depends(get_db)):
    return db.query(models.LargeTeam).all()


@router.get("/teams", response_model=list[schemas.Team])
def list_teams(db: Session = Depends(get_db)):
    return db.query(models.Team).all()


@router.get("/capability-gaps", response_model=list[schemas.CapabilityGap])
def capability_gaps(db: Session = Depends(get_db)):
    return db.query(models.CapabilityGap).all()


@router.get("/identity-matches", response_model=list[schemas.IdentityMatch])
def identity_matches(db: Session = Depends(get_db)):
    return db.query(models.IdentityMatch).all()


@router.get("/team-spaces", response_model=list[schemas.TeamSpace])
def team_spaces(db: Session = Depends(get_db)):
    return db.query(models.TeamSpace).all()


@router.get("/team-groups", response_model=list[schemas.TeamGroup])
def team_groups(team_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(models.TeamGroup)
    if team_id:
        q = q.filter_by(team_id=team_id)
    return q.all()


@router.post("/team-spaces", response_model=schemas.TeamSpace)
def create_team_space(body: dict = Body(...), db: Session = Depends(get_db)):
    owner_id = body.get("ownerId") or body.get("owner_id")
    space = models.TeamSpace(
        id=f"team-{uuid.uuid4().hex[:6]}",
        name=body.get("name", ""),
        large_team_id=body.get("largeTeamId") or body.get("large_team_id") or "lt-tech",
        description=body.get("description"),
        owner_id=owner_id,
        owner_name=body.get("ownerName") or body.get("owner_name"),
        status="active",
        created_at="刚刚",
        updated_at="刚刚",
        member_ids=[owner_id] if owner_id else [],
        project_ids=[],
    )
    db.add(space)
    db.commit()
    db.refresh(space)
    return space


@router.post("/team-groups", response_model=schemas.TeamGroup)
def create_team_group(body: dict = Body(...), db: Session = Depends(get_db)):
    group = models.TeamGroup(
        id=f"group-{uuid.uuid4().hex[:6]}",
        team_id=body.get("teamId") or body.get("team_id", ""),
        name=body.get("name", ""),
        lead_id=body.get("leadId") or body.get("lead_id"),
        lead_name=body.get("leadName") or body.get("lead_name"),
        member_ids=[],
        project_ids=[],
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group
