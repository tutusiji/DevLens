"""配置类路由：LLM Provider / 任务路由 / 向量库 / 代码图谱"""
import math

from fastapi import APIRouter, Depends
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


@router.get("/graph", response_model=schemas.GraphData)
def graph(db: Session = Depends(get_db)):
    """从项目模块风险生成代码图谱节点（圆形布局），边用模块路径相邻近似。"""
    modules = db.query(models.ModuleRisk).all()
    # 按 project 分组取代表性模块（避免过多）
    seen = set()
    nodes = []
    n = len(modules)
    for i, m in enumerate(modules):
        if m.name in seen:
            continue
        seen.add(m.name)
        angle = (2 * math.pi * i) / max(1, n)
        radius = 40
        nodes.append({
            "id": m.name,
            "label": m.name,
            "layer": "service",
            "x": round(50 + radius * math.cos(angle)),
            "y": round(50 + radius * math.sin(angle)),
            "loc": f"{m.issue_count}项",
            "health": max(0, 100 - m.score),
        })
    # 边：真实 import 依赖（从 project.graph_edges，正则解析 import 生成）
    edges = []
    projects = db.query(models.Project).filter(models.Project.graph_edges.isnot(None)).all()
    for p in projects:
        for e in (p.graph_edges or []):
            edges.append({"source": e.get("source"), "target": e.get("target")})
    stats = {
        "moduleCount": len(nodes),
        "edgeCount": len(edges),
        "avgHealth": round(sum(x["health"] for x in nodes) / len(nodes)) if nodes else 0,
    }
    return {"nodes": nodes, "edges": edges, "stats": stats}
