"""配置类路由：LLM Provider / 任务路由 / 向量库。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas

router = APIRouter()


@router.get("/model-providers", response_model=list[schemas.ModelProviderM])
def model_providers(db: Session = Depends(get_db)):
    return db.query(models.ModelProvider).all()


@router.get("/task-routes", response_model=list[schemas.TaskRouteM])
def task_routes(db: Session = Depends(get_db)):
    return db.query(models.TaskRoute).all()


@router.get("/vector-collections", response_model=list[schemas.VectorCollectionM])
def vector_collections(db: Session = Depends(get_db)):
    return db.query(models.VectorCollection).all()


@router.get("/embedding-models", response_model=list[schemas.EmbeddingModelM])
def embedding_models(db: Session = Depends(get_db)):
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
