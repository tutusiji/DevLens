"""开发者路由：列表 / 详情"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..access import TenantContext, require_permission

router = APIRouter()


@router.get("/developers", response_model=list[schemas.Developer])
def list_developers(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("developer:read")),
):
    return db.query(models.Developer).filter_by(tenant_id=ctx.tenant_id).all()


@router.get("/developers/{did}", response_model=schemas.DeveloperDetail)
def get_developer(
    did: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("developer:read")),
):
    d = db.query(models.Developer).filter_by(id=did, tenant_id=ctx.tenant_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="开发者不存在")
    # capability/growth_curve 等是 JSON 字段，from_attributes 直接读取
    return schemas.DeveloperDetail.model_validate(d)
