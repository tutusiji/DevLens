"""认证 API：登录 / 登出 / 当前用户。

登录成功后返回 JWT（前端存 localStorage，请求带 Authorization: Bearer）。
轻量自用方案：bcrypt 密码 + HS256 JWT；后续可平滑对接 SSO/网关。
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..access import DEFAULT_TENANT_ID
from ..auth import (
    COOKIE_NAME,
    create_access_token,
    decode_token,
    hash_password,
    token_from_request,
    verify_password,
)
from ..config import settings
from ..db import get_db

router = APIRouter(tags=["auth"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


def _user_out(user: models.AccountUser) -> dict:
    return {"id": user.id, "email": user.email, "name": user.name, "status": user.status}


@router.post("/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """邮箱 + 密码登录，返回 JWT 与用户/租户上下文。"""
    email = body.email.strip().lower()
    user = db.query(models.AccountUser).filter_by(email=email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="邮箱或密码错误")
    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已禁用")

    memberships = (
        db.query(models.TenantMembership)
        .filter_by(user_id=user.id)
        .order_by(models.TenantMembership.created_at)
        .all()
    )
    if not memberships:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="该账号未加入任何租户，请联系管理员")
    # 默认租户：优先级 DEFAULT_TENANT_ID > 第一个加入的租户
    chosen = next((m for m in memberships if m.tenant_id == DEFAULT_TENANT_ID), memberships[0])
    tenant = db.query(models.Tenant).filter_by(id=chosen.tenant_id).first()
    if not tenant or tenant.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="默认租户不可用")

    token = create_access_token(user.id, chosen.tenant_id, chosen.role)
    tenants = [
        {
            "id": m.tenant_id,
            "role": m.role,
            "name": (db.query(models.Tenant).filter_by(id=m.tenant_id).first() or models.Tenant()).name,
        }
        for m in memberships
    ]
    return {
        "token": token,
        "user": _user_out(user),
        "tenant": {"id": tenant.id, "name": tenant.name, "slug": tenant.slug},
        "role": chosen.role,
        "tenants": tenants,
    }


@router.get("/auth/me")
def me(request: Request, db: Session = Depends(get_db)):
    """根据当前 token 返回用户信息与租户列表（前端刷新恢复会话用）。"""
    token = token_from_request(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已过期或无效")
    user = db.query(models.AccountUser).filter_by(id=payload.get("sub")).first()
    if not user or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号不可用")
    memberships = (
        db.query(models.TenantMembership)
        .filter_by(user_id=user.id)
        .order_by(models.TenantMembership.created_at)
        .all()
    )
    tenants = [
        {
            "id": m.tenant_id,
            "role": m.role,
            "name": (db.query(models.Tenant).filter_by(id=m.tenant_id).first() or models.Tenant()).name,
        }
        for m in memberships
    ]
    current_tenant_id = payload.get("tenant")
    return {
        "user": _user_out(user),
        "tenant": {"id": current_tenant_id},
        "role": payload.get("role"),
        "tenants": tenants,
    }


@router.post("/auth/logout")
def logout():
    """登出（无状态 JWT；前端负责清除本地 token）。"""
    return {"ok": True}


@router.post("/auth/change-password")
def change_password(
    body: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """修改当前用户密码。"""
    token = token_from_request(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已过期或无效")
    user = db.query(models.AccountUser).filter_by(id=payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="原密码错误")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="新密码至少 8 位")
    user.password_hash = hash_password(body.new_password)
    user.updated_at = _now()
    db.commit()
    return {"ok": True}
