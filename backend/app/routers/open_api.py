"""API 开放平台路由：Token 生命周期 + 公开只读端点（X-API-Key 鉴权）。"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models
from ..access import TenantContext, require_permission
from ..api_keys import authenticate_api_key, generate_token, hash_token
from ..db import get_db

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _token_out(t: models.ApiToken) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "scope": t.scope,
        "lastUsedAt": t.last_used_at or "",
        "expiresAt": t.expires_at or "",
        "createdAt": t.created_at,
    }


# ============ Token 生命周期（租户内 owner/admin） ============
@router.get("/api-tokens")
def list_api_tokens(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("tenant:manage")),
):
    tokens = db.query(models.ApiToken).filter_by(tenant_id=ctx.tenant_id).all()
    return [_token_out(t) for t in tokens]


@router.post("/api-tokens", status_code=201)
def create_api_token(
    body: dict,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("tenant:manage")),
):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Token 名称不能为空")
    scope = body.get("scope") or "read"
    if scope not in ("read", "write"):
        raise HTTPException(status_code=422, detail="scope 仅支持 read/write")

    raw = generate_token()
    now = _now()
    expires = body.get("expiresAt") or ""
    token = models.ApiToken(
        id=f"atk-{uuid.uuid4().hex[:12]}",
        name=name,
        token_hash=hash_token(raw),
        scope=scope,
        expires_at=expires,
        created_at=now,
        tenant_id=ctx.tenant_id,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return {"token": raw, **{k: v for k, v in _token_out(token).items()}}


@router.delete("/api-tokens/{token_id}")
def delete_api_token(
    token_id: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("tenant:manage")),
):
    token = db.query(models.ApiToken).filter_by(id=token_id, tenant_id=ctx.tenant_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token 不存在")
    db.delete(token)
    db.commit()
    return {"ok": True, "id": token_id}


# ============ 开放只读端点（X-API-Key） ============
@router.get("/open/projects")
def open_projects(
    q: str = Query(default=""),
    db: Session = Depends(get_db),
    token: models.ApiToken = Depends(authenticate_api_key),
):
    """外部集成拉取项目概览（只读）。"""
    if token.scope != "read":
        raise HTTPException(status_code=403, detail="该 Token 无 read 权限")
    query = db.query(models.Project).filter_by(tenant_id=token.tenant_id)
    if q:
        query = query.filter(models.Project.name.ilike(f"%{q}%"))
    projects = query.all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "language": p.language or "",
            "score": p.score or 0,
            "status": p.status,
            "commits": p.commits or 0,
            "contributors": p.contributors or 0,
            "lastAnalyzed": p.last_analyzed or "",
        }
        for p in projects
    ]


@router.get("/open/developers")
def open_developers(
    db: Session = Depends(get_db),
    token: models.ApiToken = Depends(authenticate_api_key),
):
    if token.scope != "read":
        raise HTTPException(status_code=403, detail="该 Token 无 read 权限")
    devs = db.query(models.Developer).filter_by(tenant_id=token.tenant_id).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "username": d.username or "",
            "role": d.role or d.role_type or "",
            "level": d.level or "",
            "overall": d.overall or 0,
            "commits": d.commits or 0,
        }
        for d in devs
    ]
