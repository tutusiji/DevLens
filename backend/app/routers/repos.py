"""仓库路由"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..access import TenantContext, require_permission

router = APIRouter()


@router.get("/repos", response_model=list[schemas.Repository])
def list_repos(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    return db.query(models.Repository).filter_by(tenant_id=ctx.tenant_id).all()
