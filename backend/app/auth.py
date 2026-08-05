"""认证核心：bcrypt 密码哈希 + JWT 签发/解析 + 请求身份解析。

身份来源优先级（从可信到兜底）：
1. Authorization: Bearer <JWT>
2. X-DevLens-User-Id / X-DevLens-Tenant-Id 头（上游网关注入，兼容旧客户端）
3. DEVLENS_ALLOW_LOCAL_ADMIN=true 时的本地管理员回退（仅开发/单机）
"""
import datetime as _dt
import os
from dataclasses import dataclass

import bcrypt
import jwt
from fastapi import Request

from .config import settings

JWT_ALGORITHM = "HS256"
COOKIE_NAME = "devlens_token"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: str, tenant_id: str, role: str) -> str:
    """签发 JWT，默认 7 天有效期（DEVLENS_JWT_EXPIRE_HOURS 可调）。"""
    now = _dt.datetime.now(_dt.timezone.utc)
    payload = {
        "sub": user_id,
        "tenant": tenant_id,
        "role": role,
        "iat": now,
        "exp": now + _dt.timedelta(hours=settings.jwt_expire_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """解析并校验 JWT；无效/过期返回 None。"""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None


def token_from_request(request: Request) -> str | None:
    """从 Authorization 头或 cookie 提取 token。"""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.cookies.get(COOKIE_NAME)


def user_tenant_headers(request: Request) -> tuple[str | None, str | None]:
    """兼容旧客户端：从 X-DevLens-* 头读取身份。"""
    return (
        request.headers.get("x-devlens-user-id"),
        request.headers.get("x-devlens-tenant-id"),
    )


def local_admin_fallback(request: Request) -> bool:
    """本地单机兼容开关：仅当两个身份头都缺失时允许回退本地管理员。"""
    enabled = os.getenv("DEVLENS_ALLOW_LOCAL_ADMIN", "true").lower() in {"1", "true", "yes"}
    uid, tid = user_tenant_headers(request)
    return enabled and not uid and not tid
