"""DevLens FastAPI 应用"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .db import Base, engine, SessionLocal
from . import models, seed
from .routers import overview, projects, developers, teams, repos, config, skills, env_inventory


def ensure_migrate():
    """增量迁移：为已有表补充新列（create_all 不会改已存在的表）"""
    with engine.connect() as conn:
        insp = inspect(engine)
        cols = [c["name"] for c in insp.get_columns("identity_matches")]
        if "project_id" not in cols:
            conn.execute(text("ALTER TABLE identity_matches ADD COLUMN project_id VARCHAR"))
            conn.commit()
        cols = [c["name"] for c in insp.get_columns("projects")]
        if "assets" not in cols:
            conn.execute(text("ALTER TABLE projects ADD COLUMN assets JSON"))
            conn.commit()
        cols = [c["name"] for c in insp.get_columns("insights")]
        if "skill_group" not in cols:
            conn.execute(text("ALTER TABLE insights ADD COLUMN skill_group VARCHAR"))
            conn.commit()
        cols = [c["name"] for c in insp.get_columns("projects")]
        if "graph_edges" not in cols:
            conn.execute(text("ALTER TABLE projects ADD COLUMN graph_edges JSON"))
            conn.commit()
        cols = [c["name"] for c in insp.get_columns("analysis_runs")]
        if "skill_group_id" not in cols:
            conn.execute(text("ALTER TABLE analysis_runs ADD COLUMN skill_group_id VARCHAR"))
            conn.commit()
        # Env Inventory 早期表已由 create_all 创建；新增结构化配置字段须显式补列。
        env_entry_columns = {
            "host": "VARCHAR",
            "port": "VARCHAR",
            "username": "VARCHAR",
            "database": "VARCHAR",
            "fingerprint": "VARCHAR",
            "detail": "JSON",
        }
        cols = {c["name"] for c in insp.get_columns("env_inventory_entries")}
        for name, column_type in env_entry_columns.items():
            if name not in cols:
                conn.execute(
                    text(f"ALTER TABLE env_inventory_entries ADD COLUMN {name} {column_type}")
                )
                conn.commit()
        # 旧记录在 ALTER 后的新增列为 NULL；统一回填为空值，保证 Pydantic 响应和前端
        # 可直接按字符串/对象字段消费，而无需为历史数据增加额外的空值分支。
        for name in ("host", "port", "username", "database", "fingerprint"):
            conn.execute(
                text(f"UPDATE env_inventory_entries SET {name} = '' WHERE {name} IS NULL")
            )
        conn.execute(
            text("UPDATE env_inventory_entries SET detail = :empty_detail WHERE detail IS NULL"),
            {"empty_detail": "{}"},
        )
        conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    ensure_migrate()
    db = SessionLocal()
    if db.query(models.LargeTeam).count() == 0:
        db.close()
        seed.seed()
    elif db.query(models.ModelProvider).count() == 0:
        db.close()
        seed.seed_config()
    else:
        db.close()
    # Skill 种子数据：仅当 skills 表为空时（独立于主 seed，避免回归已有部署）
    db = SessionLocal()
    if db.query(models.Skill).count() == 0:
        db.close()
        seed.seed_skills()
    else:
        db.close()
    # Env Inventory 种子数据：仅当 env_inventory_entries 表为空时
    db = SessionLocal()
    if db.query(models.EnvInventoryEntry).count() == 0:
        db.close()
        seed.seed_env_inventory()
    else:
        db.close()
    yield


app = FastAPI(title="DevLens API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(overview.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(developers.router, prefix="/api/v1")
app.include_router(teams.router, prefix="/api/v1")
app.include_router(repos.router, prefix="/api/v1")
app.include_router(config.router, prefix="/api/v1")
app.include_router(skills.router, prefix="/api/v1")
app.include_router(env_inventory.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"name": "DevLens API", "status": "ok"}
