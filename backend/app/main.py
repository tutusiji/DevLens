"""DevLens FastAPI 应用"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text

from .db import Base, engine, SessionLocal
from . import capability, models, seed
from .access import DEFAULT_TENANT_ID, ensure_bootstrap_tenant
from .routers import (
    overview, projects, developers, teams, repos, config, skills, env_inventory, evaluations,
    portfolio, reports, tenants, architecture_designs,
)


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
        # Env Inventory v2：扫描规则资产化，扫描记录保存生效 Skill 快照以便审计追溯。
        env_scan_columns = {
            "skill_ids": "JSON",
            "skill_snapshot": "JSON",
        }
        cols = {c["name"] for c in insp.get_columns("env_inventory_scans")}
        for name, column_type in env_scan_columns.items():
            if name not in cols:
                conn.execute(
                    text(f"ALTER TABLE env_inventory_scans ADD COLUMN {name} {column_type}")
                )
                conn.commit()
        conn.execute(
            text("UPDATE env_inventory_scans SET skill_ids = :empty_list WHERE skill_ids IS NULL"),
            {"empty_list": "[]"},
        )
        conn.execute(
            text("UPDATE env_inventory_scans SET skill_snapshot = :empty_snapshot WHERE skill_snapshot IS NULL"),
            {"empty_snapshot": "{}"},
        )
        conn.commit()

        # Developer v2：保存可审计的项目参与贡献快照；旧数据先回填为空数组，
        # 详情接口仍会根据项目 contributor_list 派生项目归属。
        developer_columns = {"project_contributions": "JSON"}
        cols = {c["name"] for c in insp.get_columns("developers")}
        for name, column_type in developer_columns.items():
            if name not in cols:
                conn.execute(
                    text(f"ALTER TABLE developers ADD COLUMN {name} {column_type}")
                )
                conn.commit()
        conn.execute(
            text("UPDATE developers SET project_contributions = :empty_list WHERE project_contributions IS NULL"),
            {"empty_list": "[]"},
        )
        conn.commit()

        # Capability Standards：新表由 create_all 建立；以下补列逻辑兼容内测期间
        # 已存在但字段不完整的数据库，避免部署升级后角色配置/阈值接口不可用。
        capability_columns = {
            "capability_roles": {
                "dimensions": "JSON",
                "skill_group_id": "VARCHAR",
                "enabled": "INTEGER",
                "created_at": "VARCHAR",
                "updated_at": "VARCHAR",
            },
            "capability_standards": {
                "thresholds": "JSON",
                "updated_at": "VARCHAR",
            },
        }
        existing_tables = set(insp.get_table_names())
        for table_name, columns in capability_columns.items():
            if table_name not in existing_tables:
                # 正常启动路径中 Base.metadata.create_all 已处理；保留 checkfirst
                # 使 ensure_migrate 可独立承担新表迁移职责。
                Base.metadata.tables[table_name].create(bind=conn, checkfirst=True)
                continue
            existing_columns = {c["name"] for c in insp.get_columns(table_name)}
            for name, column_type in columns.items():
                if name not in existing_columns:
                    conn.execute(
                        text(f"ALTER TABLE {table_name} ADD COLUMN {name} {column_type}")
                    )
                    conn.commit()

        # 可售化升级：为已有业务资产补 tenant_id，历史记录统一归入本地默认租户；
        # DeveloperEvaluation 另补 project / rule snapshot，保证评估可审计并可进报告。
        commercial_columns = {
            "developers": {"tenant_id": "VARCHAR"},
            "projects": {"tenant_id": "VARCHAR", "architecture_design": "JSON"},
            "repositories": {"tenant_id": "VARCHAR"},
            "large_teams": {"tenant_id": "VARCHAR"},
            "team_spaces": {"tenant_id": "VARCHAR"},
            "team_groups": {"tenant_id": "VARCHAR"},
            "teams": {"tenant_id": "VARCHAR"},
            "capability_gaps": {"tenant_id": "VARCHAR"},
            "identity_matches": {"tenant_id": "VARCHAR"},
            "skill_sources": {"tenant_id": "VARCHAR"},
            "skills": {"tenant_id": "VARCHAR"},
            "skill_groups": {"tenant_id": "VARCHAR"},
            "capability_roles": {"tenant_id": "VARCHAR"},
            "developer_evaluations": {
                "tenant_id": "VARCHAR",
                "project_id": "VARCHAR",
                "rule_snapshot": "JSON",
            },
        }
        existing_tables = set(insp.get_table_names())
        for table_name, columns in commercial_columns.items():
            if table_name not in existing_tables:
                continue
            existing_columns = {column["name"] for column in insp.get_columns(table_name)}
            for name, column_type in columns.items():
                if name not in existing_columns:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {name} {column_type}"))
            if "tenant_id" in columns:
                conn.execute(
                    text(f"UPDATE {table_name} SET tenant_id = :tenant_id WHERE tenant_id IS NULL"),
                    {"tenant_id": DEFAULT_TENANT_ID},
                )
        conn.commit()

        # v0.5 起能力角色按租户隔离。早期 PostgreSQL schema 对 key 有全局唯一
        # 约束，须在 tenant_id 回填后替换为 (tenant_id, key) 复合唯一约束。
        if engine.dialect.name == "postgresql":
            conn.execute(text(
                "ALTER TABLE capability_roles "
                "DROP CONSTRAINT IF EXISTS capability_roles_key_key"
            ))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_capability_role_tenant_key "
                "ON capability_roles (tenant_id, key)"
            ))
            conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    ensure_migrate()
    db = SessionLocal()
    ensure_bootstrap_tenant(db)
    db.close()
    # 每个租户拥有独立、可编辑的默认环境盘点规则；只补缺失项，不覆盖用户修改。
    db = SessionLocal()
    for (tenant_id,) in db.query(models.Tenant.id).all():
        seed.ensure_default_env_inventory_skills(db, tenant_id)
    db.close()
    db = SessionLocal()
    if db.query(models.LargeTeam).filter_by(tenant_id=seed.SEED_TENANT_ID).count() == 0:
        db.close()
        seed.seed()
    elif db.query(models.ModelProvider).count() == 0:
        db.close()
        seed.seed_config()
    else:
        db.close()
    # Skill 种子数据：仅当测试租户 skills 为空时（独立于主 seed，避免回归已有部署）
    db = SessionLocal()
    if db.query(models.Skill).filter_by(tenant_id=seed.SEED_TENANT_ID).count() == 0:
        db.close()
        seed.seed_skills()
    else:
        db.close()
    # 开发者画像的项目参与关系来自项目 contributor_list；为历史测试数据补齐
    # 尚未归集的项目贡献，不覆盖已经存在的真实/演示贡献清单。
    db = SessionLocal()
    seed.ensure_seed_project_contributors(db, seed.SEED_TENANT_ID)
    db.close()
    # Env Inventory 种子数据：仅当测试租户 env_inventory_entries 为空时
    # （env 条目无 tenant_id 列，通过 project_id 归属，故按测试租户项目子查询判断）
    db = SessionLocal()
    test_project_ids = [
        pid for (pid,) in db.query(models.Project.id)
        .filter_by(tenant_id=seed.SEED_TENANT_ID).all()
    ]
    env_count = 0
    if test_project_ids:
        env_count = db.query(models.EnvInventoryEntry).filter(
            models.EnvInventoryEntry.project_id.in_(test_project_ids)
        ).count()
    if env_count == 0:
        db.close()
        seed.seed_env_inventory()
    else:
        db.close()
    # 能力标准种子：Skill 组已先完成初始化，因此前端/后端角色可默认关联对应规则组。
    db = SessionLocal()
    if db.query(models.CapabilityRole).filter_by(tenant_id=seed.SEED_TENANT_ID).count() == 0:
        db.close()
        seed.seed_capability()
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
app.include_router(capability.router, prefix="/api/v1")
app.include_router(evaluations.router, prefix="/api/v1")
app.include_router(portfolio.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(tenants.router, prefix="/api/v1")
app.include_router(architecture_designs.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"name": "DevLens API", "status": "ok"}


@app.get("/api/v1/health")
def health():
    """部署健康检查：服务可达且数据库可连接（nginx /api/ 反代到本端点）。"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "error"})
