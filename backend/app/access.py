"""租户上下文与轻量 RBAC。

认证由上游 SSO / API Gateway 完成，本服务只消费可信的 ``X-DevLens-*`` 身份头：

* ``X-DevLens-User-Id``：本地用户 ID
* ``X-DevLens-Tenant-Id``：当前租户 ID

开发环境没有上游认证时允许回退到 seed 的本地 owner；生产环境请设置
``DEVLENS_ALLOW_LOCAL_ADMIN=false`` 并由网关注入上述头部。
"""
from dataclasses import dataclass
from datetime import datetime, timezone
import os
import uuid

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from . import models
from .db import get_db


DEFAULT_TENANT_ID = "tenant-default"
DEFAULT_USER_ID = "usr-local-admin"

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "owner": {"*"},
    "admin": {"*"},
    "evaluator": {
        "project:read", "developer:read", "rules:read", "assessment:read",
        "assessment:run", "comparison:read", "report:export",
    },
    "analyst": {
        "project:read", "developer:read", "rules:read", "assessment:read",
        "comparison:read", "report:export",
    },
    "viewer": {
        "project:read", "developer:read", "rules:read", "assessment:read",
        "comparison:read",
    },
}


@dataclass(frozen=True)
class TenantContext:
    tenant_id: str
    user_id: str
    role: str

    def allows(self, permission: str) -> bool:
        permissions = ROLE_PERMISSIONS.get(self.role, set())
        return "*" in permissions or permission in permissions


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def local_admin_enabled() -> bool:
    """本地单机兼容开关，生产环境必须由部署配置关闭。"""
    return os.getenv("DEVLENS_ALLOW_LOCAL_ADMIN", "true").lower() in {"1", "true", "yes"}


def ensure_bootstrap_tenant(db: Session) -> None:
    """确保空安装也拥有一个可登录、可迁移历史数据的默认组织，以及独立的测试组织空间。"""
    now = _now()
    tenant = db.query(models.Tenant).filter_by(id=DEFAULT_TENANT_ID).first()
    if not tenant:
        db.add(models.Tenant(
            id=DEFAULT_TENANT_ID,
            name="DevLens 本地工作区",
            slug="local",
            status="active",
            created_at=now,
            updated_at=now,
        ))
    # 测试组织空间：种子/演示数据统一存放于此，与真实数据隔离
    from .seed import SEED_TENANT_ID
    test_tenant = db.query(models.Tenant).filter_by(id=SEED_TENANT_ID).first()
    if not test_tenant:
        db.add(models.Tenant(
            id=SEED_TENANT_ID,
            name="DevLens 测试组织",
            slug="test",
            status="active",
            created_at=now,
            updated_at=now,
        ))
    user = db.query(models.AccountUser).filter_by(id=DEFAULT_USER_ID).first()
    if not user:
        db.add(models.AccountUser(
            id=DEFAULT_USER_ID,
            email="local-admin@devlens.local",
            name="本地管理员",
            status="active",
            created_at=now,
            updated_at=now,
        ))
    for (tenant_id, membership_id) in [
        (DEFAULT_TENANT_ID, "tmem-local-owner"),
        (SEED_TENANT_ID, "tmem-test-owner"),
    ]:
        membership = (
            db.query(models.TenantMembership)
            .filter_by(tenant_id=tenant_id, user_id=DEFAULT_USER_ID)
            .first()
        )
        if not membership:
            db.add(models.TenantMembership(
                id=membership_id,
                tenant_id=tenant_id,
                user_id=DEFAULT_USER_ID,
                role="owner",
                created_at=now,
                updated_at=now,
            ))
    db.commit()


def get_tenant_context(
    request: Request,
    x_devlens_user_id: str | None = Header(default=None),
    x_devlens_tenant_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> TenantContext:
    """解析当前会员身份，不允许跨租户伪造 user / tenant 组合。

    优先级：JWT(Bearer/cookie) > X-DevLens-* 头 > 本地管理员回退。
    """
    from .auth import decode_token, token_from_request, user_tenant_headers, local_admin_fallback

    # 1) JWT 优先（登录体系）
    token = token_from_request(request)
    if token:
        payload = decode_token(token)
        if not payload:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已过期或无效，请重新登录")
        membership = (
            db.query(models.TenantMembership)
            .filter_by(tenant_id=payload.get("tenant"), user_id=payload.get("sub"))
            .first()
        )
        if not membership:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前用户不属于该租户")
        user = db.query(models.AccountUser).filter_by(id=payload.get("sub")).first()
        tenant = db.query(models.Tenant).filter_by(id=payload.get("tenant")).first()
        if not user or user.status != "active" or not tenant or tenant.status != "active":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="用户或租户不可用")
        return TenantContext(tenant.id, user.id, membership.role)

    # 2) 身份头（上游网关注入 / 旧客户端）
    if not x_devlens_user_id and not x_devlens_tenant_id:
        h_uid, h_tid = user_tenant_headers(request)
        if h_uid and h_tid:
            x_devlens_user_id, x_devlens_tenant_id = h_uid, h_tid
    if not x_devlens_user_id and not x_devlens_tenant_id and local_admin_fallback(request):
        return TenantContext(DEFAULT_TENANT_ID, DEFAULT_USER_ID, "owner")
    if not x_devlens_user_id or not x_devlens_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少 X-DevLens-User-Id 或 X-DevLens-Tenant-Id 身份头",
        )
    membership = (
        db.query(models.TenantMembership)
        .filter_by(tenant_id=x_devlens_tenant_id, user_id=x_devlens_user_id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前用户不属于该租户")
    user = db.query(models.AccountUser).filter_by(id=x_devlens_user_id).first()
    tenant = db.query(models.Tenant).filter_by(id=x_devlens_tenant_id).first()
    if not user or user.status != "active" or not tenant or tenant.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="用户或租户不可用")
    return TenantContext(tenant.id, user.id, membership.role)


def require_permission(permission: str):
    """生成 FastAPI dependency，所有可售化读写 API 都通过同一 RBAC 判定。"""
    def dependency(ctx: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        if not ctx.allows(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"当前角色无 {permission} 权限",
            )
        return ctx
    return dependency


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"
