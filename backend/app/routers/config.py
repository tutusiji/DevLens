"""配置类路由：LLM Provider / 任务路由 / 向量库。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..access import TenantContext, require_permission

router = APIRouter()


def _mask_api_key(key: str) -> str:
    """脱敏 API Key：保留前缀 6 位和后缀 4 位，中间用 **** 代替。
    短 key 全部隐藏。"""
    if not key:
        return ""
    if len(key) <= 10:
        return "*" * len(key)
    return f"{key[:6]}****{key[-4:]}"


@router.get("/model-providers", response_model=list[schemas.ModelProviderM])
def model_providers(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    providers = db.query(models.ModelProvider).all()
    # 脱敏 api_key 后返回，防止泄露大模型密钥
    result = []
    for p in providers:
        result.append({
            "key": p.key,
            "name": p.name,
            "api_key": _mask_api_key(p.api_key or ""),
            "base_url": p.base_url or "",
            "status": p.status or "unconfigured",
            "models": p.models or [],
        })
    return result


@router.get("/task-routes", response_model=list[schemas.TaskRouteM])
def task_routes(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    return db.query(models.TaskRoute).all()


@router.get("/vector-collections", response_model=list[schemas.VectorCollectionM])
def vector_collections(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    return db.query(models.VectorCollection).all()


@router.get("/embedding-models", response_model=list[schemas.EmbeddingModelM])
def embedding_models(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("project:read")),
):
    return db.query(models.EmbeddingModel).all()


@router.get("/graph", deprecated=True)
def graph():
    """废弃全局代码图谱，防止把不同项目/租户的模块错误拼接为同一张图。"""
    raise HTTPException(
        status_code=410,
        detail=(
            "全局代码图谱已下线。请使用 /projects/{project_id}/graph 查看项目级代码图谱，"
            "或使用 /architecture-designs 查看项目架构设计方案。"
        ),
    )
