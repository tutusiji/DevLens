"""平台凭证管理 + 仓库发现 / 批量导入 + Webhook 触发重分析。"""
import hmac
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..access import TenantContext, require_permission
from ..analyzer import analyze_repository
from ..db import get_db
from ..security import decrypt_value, encrypt_value
from ..provider_client import discover_repos

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _provider_config_out(cfg: models.RepositoryProviderConfig) -> dict:
    token = decrypt_value(cfg.access_token_encrypted)
    return {
        "id": cfg.id,
        "provider": cfg.provider,
        "displayName": cfg.display_name,
        "baseUrl": cfg.base_url,
        "enabled": cfg.enabled == 1,
        "hasToken": bool(token),
        "tokenMasked": f"{token[:4]}****{token[-4:]}" if token and len(token) > 8 else "****",
        "hasWebhookSecret": bool(decrypt_value(cfg.webhook_secret_encrypted)),
        "createdAt": cfg.created_at,
        "updatedAt": cfg.updated_at,
    }


@router.get("/providers", response_model=list[schemas.ProviderConfigM])
def list_provider_configs(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    cfgs = db.query(models.RepositoryProviderConfig).filter_by(tenant_id=ctx.tenant_id).all()
    return [_provider_config_out(c) for c in cfgs]


@router.post("/providers", response_model=schemas.ProviderConfigM, status_code=201)
def upsert_provider_config(
    body: schemas.ProviderConfigUpsert,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:write")),
):
    cfg = db.query(models.RepositoryProviderConfig).filter_by(
        provider=body.provider, tenant_id=ctx.tenant_id,
    ).first()
    now = _now()
    if not cfg:
        cfg = models.RepositoryProviderConfig(
            id=f"pcfg-{uuid.uuid4().hex[:10]}",
            provider=body.provider,
            display_name=body.display_name or body.provider,
            base_url=(body.base_url or "").rstrip("/"),
            access_token_encrypted=encrypt_value(body.access_token),
            webhook_secret_encrypted=encrypt_value(body.webhook_secret),
            enabled=1 if body.enabled else 0,
            created_at=now,
            updated_at=now,
            tenant_id=ctx.tenant_id,
        )
        db.add(cfg)
    else:
        if body.display_name is not None:
            cfg.display_name = body.display_name
        if body.base_url is not None:
            cfg.base_url = body.base_url.rstrip("/")
        if body.access_token:
            cfg.access_token_encrypted = encrypt_value(body.access_token)
        if body.webhook_secret:
            cfg.webhook_secret_encrypted = encrypt_value(body.webhook_secret)
        if body.enabled is not None:
            cfg.enabled = 1 if body.enabled else 0
        cfg.updated_at = now
    db.commit()
    db.refresh(cfg)
    return _provider_config_out(cfg)


@router.delete("/providers/{cfg_id}")
def delete_provider_config(
    cfg_id: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:write")),
):
    cfg = db.query(models.RepositoryProviderConfig).filter_by(
        id=cfg_id, tenant_id=ctx.tenant_id,
    ).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="凭证配置不存在")
    db.delete(cfg)
    db.commit()
    return {"ok": True, "id": cfg_id}


@router.get("/repos/discover")
def discover(
    provider: str,
    org: str | None = None,
    user: str | None = None,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    cfg = db.query(models.RepositoryProviderConfig).filter_by(
        provider=provider, tenant_id=ctx.tenant_id,
    ).first()
    if not cfg:
        raise HTTPException(status_code=404, detail=f"未配置 {provider} 凭证，请先添加")
    try:
        repos = discover_repos(
            provider=provider,
            org=org,
            user=user,
            access_token_encrypted=cfg.access_token_encrypted,
            base_url=cfg.base_url,
        )
    except Exception as exc:  # noqa: BLE001 - 透传外部 API 错误给前端
        raise HTTPException(status_code=400, detail=f"发现仓库失败: {exc}") from exc
    return {"provider": provider, "repos": repos}


@router.post("/repos/import")
def import_repos(
    body: schemas.RepoImportRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:write")),
):
    """批量导入发现的仓库，每个仓库创建独立 Project + 触发分析。"""
    results = []
    for repo in body.repos:
        project_id = f"p-{uuid.uuid4().hex[:6]}"
        run_id = f"run-{uuid.uuid4().hex[:8]}"
        now = _now()
        http_url = repo.http_url or ""
        project = models.Project(
            id=project_id, name=repo.name.split("/")[-1], group=repo.name.split("/")[0],
            team_id=body.team_id, language="unknown", status="pending",
            commits=0, contributors=0, last_analyzed="分析中", tenant_id=ctx.tenant_id,
        )
        db.add(project)
        db.flush()
        db.add(models.Repository(
            id=f"r-{uuid.uuid4().hex[:6]}", name=repo.name,
            path="", source_type="remote", provider=body.provider,
            remote_url=http_url, branch=repo.default_branch or "main",
            access_token_encrypted=encrypt_value(body.access_token),
            team_id=body.team_id, project_id=project_id,
            status="syncing", last_sync="同步中", tenant_id=ctx.tenant_id,
        ))
        db.add(models.AnalysisRun(
            id=run_id, project_id=project_id, status="queued", progress=0,
            stage="git_collect", message="已加入分析队列", updated_at=now,
        ))
        db.commit()
        analyze_repository(
            project_id=project_id,
            repo_url=http_url,
            tenant_id=ctx.tenant_id,
            name=repo.name.split("/")[-1],
            branch=repo.default_branch or "main",
            access_token_encrypted=encrypt_value(body.access_token),
            background=True,
            run_id=run_id,
        )
        results.append({"project_id": project_id, "name": repo.name, "status": "queued"})
    return {"imported": len(results), "results": results}


# ============ Webhook：push 触发重分析 ============
@router.post("/webhooks/{provider}")
async def handle_webhook(
    provider: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """接收 GitHub / GitLab / Gitee push 事件，按 remote_url 找到项目并触发重分析。

    鉴权：GitHub 用 X-Hub-Signature-256（HMAC-SHA256）；GitLab/Gitee 用 X-Gitlab-Token
    或 X-Gitee-Token 与配置的 webhook_secret 比对。
    """
    cfg = db.query(models.RepositoryProviderConfig).filter_by(
        provider=provider, tenant_id="tenant-default",
    ).first() or db.query(models.RepositoryProviderConfig).filter_by(provider=provider).first()
    if not cfg or not cfg.webhook_secret_encrypted:
        raise HTTPException(status_code=404, detail="Webhook 未配置")

    secret = decrypt_value(cfg.webhook_secret_encrypted) or ""
    body_bytes = await request.body()

    if provider == "github":
        signature = request.headers.get("X-Hub-Signature-256", "")
        expected = "sha256=" + hmac.new(secret.encode(), body_bytes, "sha256").hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=403, detail="Webhook 签名校验失败")
    else:
        token = request.headers.get("X-Gitlab-Token") or request.headers.get("X-Gitee-Token")
        if not token or not hmac.compare_digest(token, secret):
            raise HTTPException(status_code=403, detail="Webhook Token 校验失败")

    payload = json.loads(body_bytes.decode("utf-8") or "{}")
    repo_url = (
        (payload.get("repository") or {}).get("clone_url")
        or (payload.get("repository") or {}).get("git_http_url")
        or (payload.get("project") or {}).get("git_http_url")
        or ""
    )
    if not repo_url:
        return {"ok": True, "triggered": False, "reason": "事件不含仓库地址"}

    repo = db.query(models.Repository).filter_by(
        remote_url=repo_url, source_type="remote",
    ).first() or db.query(models.Repository).filter(
        models.Repository.remote_url.contains(repo_url.split("//")[-1]),
    ).first()
    if not repo:
        return {"ok": True, "triggered": False, "reason": "仓库未接入 DevLens"}

    run_id = f"run-{uuid.uuid4().hex[:8]}"
    now = _now()
    project = db.query(models.Project).filter_by(id=repo.project_id).first()
    db.add(models.AnalysisRun(
        id=run_id, project_id=repo.project_id, status="queued", progress=0,
        stage="git_collect", message="Webhook push 触发重分析", updated_at=now,
    ))
    if project:
        project.status = "pending"
        project.last_analyzed = "分析中"
    db.commit()
    analyze_repository(
        project_id=repo.project_id,
        repo_url=repo.remote_url,
        tenant_id=repo.tenant_id,
        name=repo.name,
        branch=repo.branch or "main",
        access_token_encrypted=repo.access_token_encrypted,
        background=True,
        run_id=run_id,
    )
    return {"ok": True, "triggered": True, "project_id": repo.project_id, "run_id": run_id}
