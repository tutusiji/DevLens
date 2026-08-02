"""租户与成员 RBAC 管理 API。认证由上游注入身份头，本模块管理授权关系。"""
from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..access import ROLE_PERMISSIONS, TenantContext, get_tenant_context, require_permission
from ..capability import ALL_LEVELS, ROLE_DIMENSIONS, default_thresholds
from ..db import get_db
from ..seed import ensure_default_env_inventory_skills


router = APIRouter(tags=["tenants-rbac"])
VALID_ROLES = set(ROLE_PERMISSIONS)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _membership_out(membership: models.TenantMembership, user: models.AccountUser) -> dict:
    return {
        "id": membership.id,
        "tenant_id": membership.tenant_id,
        "user_id": membership.user_id,
        "role": membership.role,
        "created_at": membership.created_at,
        "updated_at": membership.updated_at,
        "user": user,
    }


@router.post("/tenants", response_model=schemas.TenantM, status_code=status.HTTP_201_CREATED)
def create_tenant(
    body: schemas.TenantCreateRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("tenant:manage")),
):
    """创建独立租户，并初始化可立即编辑的角色/职级标准资产。"""
    slug = body.slug.strip().lower()
    if not slug or any(character not in "abcdefghijklmnopqrstuvwxyz0123456789-" for character in slug):
        raise HTTPException(status_code=422, detail="slug 仅支持小写字母、数字和连字符")
    if db.query(models.Tenant).filter_by(slug=slug).first():
        raise HTTPException(status_code=409, detail="slug 已被使用")
    owner_email = body.owner_email.strip().lower()
    if not owner_email:
        raise HTTPException(status_code=422, detail="owner_email 不能为空")
    now = _now()
    tenant = models.Tenant(
        id=f"tenant-{uuid.uuid4().hex[:12]}",
        name=body.name.strip() or slug,
        slug=slug,
        status="active",
        created_at=now,
        updated_at=now,
    )
    user = db.query(models.AccountUser).filter_by(email=owner_email).first()
    if not user:
        user = models.AccountUser(
            id=f"usr-{uuid.uuid4().hex[:12]}",
            email=owner_email,
            name=body.owner_name.strip() or owner_email,
            status="active",
            created_at=now,
            updated_at=now,
        )
        db.add(user)
        db.flush()
    db.add(tenant)
    db.add(models.TenantMembership(
        id=f"tmem-{uuid.uuid4().hex[:12]}",
        tenant_id=tenant.id,
        user_id=user.id,
        role="owner",
        created_at=now,
        updated_at=now,
    ))
    # 每个新租户有一套独立、可管理的阈值资产；规则组由 tenant 管理员
    # 按自身规范导入后在能力标准页关联，避免跨客户共享规则正文。
    for role_key, dimensions in ROLE_DIMENSIONS.items():
        role = models.CapabilityRole(
            id=f"cr-{tenant.id[-6:]}-{role_key}",
            key=role_key,
            name={
                "frontend": "前端工程师", "backend": "后端工程师",
                "devops": "DevOps 工程师", "algorithm": "算法工程师", "qa": "测试工程师",
            }[role_key],
            dimensions=dimensions,
            enabled=1,
            tenant_id=tenant.id,
            created_at=now,
            updated_at=now,
        )
        db.add(role)
        for level in ALL_LEVELS:
            db.add(models.CapabilityStandard(
                id=f"cstd-{uuid.uuid4().hex[:12]}",
                role_id=role.id,
                level=level,
                thresholds=default_thresholds(role_key, level),
                updated_at=now,
            ))
    db.commit()
    # 环境盘点规则同样是每个租户独立管理的资产；新租户创建后立即获得
    # 可编辑的默认扫描 Skill，避免首次进入环境盘点时出现空规则状态。
    ensure_default_env_inventory_skills(db, tenant.id)
    db.refresh(tenant)
    return tenant


@router.get("/auth/me", response_model=schemas.CurrentTenantContextM)
def get_current_context(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    tenant = db.query(models.Tenant).filter_by(id=ctx.tenant_id).first()
    user = db.query(models.AccountUser).filter_by(id=ctx.user_id).first()
    if not tenant or not user:
        raise HTTPException(status_code=404, detail="当前租户或用户不存在")
    permissions = sorted(ROLE_PERMISSIONS.get(ctx.role, set()))
    return {"tenant": tenant, "user": user, "role": ctx.role, "permissions": permissions}


@router.get("/tenants", response_model=list[schemas.TenantM])
def list_my_tenants(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """当前用户所属的全部租户（组织空间），供前端切换器使用。"""
    memberships = (
        db.query(models.TenantMembership)
        .filter_by(user_id=ctx.user_id)
        .all()
    )
    tenant_ids = [membership.tenant_id for membership in memberships]
    if not tenant_ids:
        return []
    tenants = (
        db.query(models.Tenant)
        .filter(models.Tenant.id.in_(tenant_ids))
        .order_by(models.Tenant.created_at.asc())
        .all()
    )
    return tenants


@router.get("/tenants/current/members", response_model=list[schemas.TenantMembershipM])
def list_members(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("tenant:manage")),
):
    memberships = (
        db.query(models.TenantMembership)
        .filter_by(tenant_id=ctx.tenant_id)
        .order_by(models.TenantMembership.created_at.asc())
        .all()
    )
    users = {
        user.id: user
        for user in db.query(models.AccountUser)
        .filter(models.AccountUser.id.in_([membership.user_id for membership in memberships]))
        .all()
    }
    return [_membership_out(membership, users[membership.user_id]) for membership in memberships]


@router.post(
    "/tenants/current/members",
    response_model=schemas.TenantMembershipM,
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    body: schemas.TenantMembershipCreateRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("tenant:manage")),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"未知角色，可选：{', '.join(sorted(VALID_ROLES))}")
    email = body.email.strip().lower()
    if not email:
        raise HTTPException(status_code=422, detail="email 不能为空")
    now = _now()
    user = db.query(models.AccountUser).filter_by(email=email).first()
    if not user:
        user = models.AccountUser(
            id=f"usr-{uuid.uuid4().hex[:12]}",
            email=email,
            name=body.name.strip() or email,
            status="active",
            created_at=now,
            updated_at=now,
        )
        db.add(user)
        db.flush()
    membership = db.query(models.TenantMembership).filter_by(
        tenant_id=ctx.tenant_id, user_id=user.id,
    ).first()
    if membership:
        membership.role = body.role
        membership.updated_at = now
    else:
        membership = models.TenantMembership(
            id=f"tmem-{uuid.uuid4().hex[:12]}",
            tenant_id=ctx.tenant_id,
            user_id=user.id,
            role=body.role,
            created_at=now,
            updated_at=now,
        )
        db.add(membership)
    db.commit()
    db.refresh(membership)
    return _membership_out(membership, user)


@router.patch("/tenants/current/members/{membership_id}", response_model=schemas.TenantMembershipM)
def change_member_role(
    membership_id: str,
    body: dict,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("tenant:manage")),
):
    role = body.get("role")
    if role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"未知角色，可选：{', '.join(sorted(VALID_ROLES))}")
    membership = db.query(models.TenantMembership).filter_by(
        id=membership_id, tenant_id=ctx.tenant_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="成员关系不存在")
    if membership.user_id == ctx.user_id and membership.role == "owner" and role != "owner":
        owner_count = db.query(models.TenantMembership).filter_by(
            tenant_id=ctx.tenant_id, role="owner",
        ).count()
        if owner_count <= 1:
            raise HTTPException(status_code=422, detail="不能降级租户最后一名 owner")
    membership.role = role
    membership.updated_at = _now()
    db.commit()
    user = db.query(models.AccountUser).filter_by(id=membership.user_id).first()
    return _membership_out(membership, user)


@router.delete("/tenants/current/members/{membership_id}")
def remove_member(
    membership_id: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("tenant:manage")),
):
    membership = db.query(models.TenantMembership).filter_by(
        id=membership_id, tenant_id=ctx.tenant_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="成员关系不存在")
    if membership.role == "owner":
        owner_count = db.query(models.TenantMembership).filter_by(
            tenant_id=ctx.tenant_id, role="owner",
        ).count()
        if owner_count <= 1:
            raise HTTPException(status_code=422, detail="不能移除租户最后一名 owner")
    db.delete(membership)
    db.commit()
    return {"ok": True, "id": membership_id}
