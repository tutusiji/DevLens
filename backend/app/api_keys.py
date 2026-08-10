"""API 开放平台：应用级 Token 管理与 X-API-Key 鉴权依赖。"""
import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import Callable

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from . import models
from .db import get_db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def generate_token() -> str:
    return f"dl_{secrets.token_urlsafe(32)}"


def authenticate_api_key(
    request: Request,
    x_api_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> models.ApiToken:
    """FastAPI dependency：校验 X-API-Key，返回 ApiToken；失败 401。"""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="缺少 X-API-Key 请求头")
    token = db.query(models.ApiToken).filter_by(token_hash=hash_token(x_api_key)).first()
    if not token:
        raise HTTPException(status_code=401, detail="API Token 无效")
    if token.expires_at and token.expires_at < _now():
        raise HTTPException(status_code=401, detail="API Token 已过期")
    token.last_used_at = _now()
    db.commit()
    # 记录调用审计
    db.add(models.ApiAccessLog(
        id=f"aal-{uuid.uuid4().hex[:12]}",
        token_id=token.id,
        method=request.method,
        path=request.url.path,
        status=200,
        created_at=_now(),
        tenant_id=token.tenant_id,
    ))
    db.commit()
    return token
