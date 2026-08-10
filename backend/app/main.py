"""DevLens FastAPI 应用"""
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text

from .db import Base, engine, SessionLocal
from . import capability, models, seed
from .access import DEFAULT_TENANT_ID, ensure_bootstrap_tenant
from .auth import hash_password
from .config import settings
from .routers import (
    overview, projects, developers, teams, repos, config, skills, env_inventory, evaluations,
    portfolio, reports, tenants, architecture_designs, auth, providers, open_api,
)


def ensure_migrate():
    """增量迁移：为已有表补充新列（create_all 不会改已存在的表）"""
    with engine.connect() as conn:
        insp = inspect(engine)
        cols = [c["name"] for c in insp.get_columns("team_spaces")]
        if "parent_id" not in cols:
            conn.execute(text("ALTER TABLE team_spaces ADD COLUMN parent_id VARCHAR"))
            conn.commit()
        cols = [c["name"] for c in insp.get_columns("account_users")]
        if "password_hash" not in cols:
            conn.execute(text("ALTER TABLE account_users ADD COLUMN password_hash VARCHAR"))
            conn.commit()
        # 个人中心：用户名（不可改，DiceBear 种子）+ 头像 URL
        cols = [c["name"] for c in insp.get_columns("account_users")]
        if "username" not in cols:
            conn.execute(text("ALTER TABLE account_users ADD COLUMN username VARCHAR"))
            conn.commit()
        if "avatar_url" not in cols:
            conn.execute(text("ALTER TABLE account_users ADD COLUMN avatar_url VARCHAR"))
            conn.commit()
        # 历史用户（如本地 admin）无用户名：回填邮箱本地部分，保证个人中心可展示
        conn.execute(
            text(
                "UPDATE account_users SET username = lower(split_part(email, '@', 1)) "
                "WHERE username IS NULL OR username = ''"
            )
        )
        conn.commit()
        # 历史用户无头像：用 username + 随机数生成 DiceBear 头像（注册时的「初始化随机」
        # 对老用户补做一次）。WHERE avatar_url IS NULL 保证只回填一次，之后稳定不变。
        conn.execute(
            text(
                "UPDATE account_users "
                "SET avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=' "
                "    || username || floor(random() * 10000)::int::text "
                "WHERE (avatar_url IS NULL OR avatar_url = '') AND username IS NOT NULL"
            )
        )
        conn.commit()
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

        # Skill 驱动架构：评估组绑定分析模块 + prompt 模板（规则资产化）
        cols = {c["name"] for c in insp.get_columns("skill_groups")}
        if "prompt_template" not in cols:
            conn.execute(text("ALTER TABLE skill_groups ADD COLUMN prompt_template TEXT"))
            conn.commit()

        # 网络仓库接入 v2：access_token 加密落库、开发者组织树归属 + 身份匹配增强
        column_additions = {
            "repositories": {"access_token_encrypted": "BYTEA"},
            "developers": {"team_space_id": "VARCHAR", "employee_id": "VARCHAR", "email": "VARCHAR"},
            "identity_matches": {"developer_id": "VARCHAR"},
            "developer_evaluations": {"repo_path": "VARCHAR", "branch": "VARCHAR"},
        }
        existing_tables = set(insp.get_table_names())
        for table_name, columns in column_additions.items():
            if table_name not in existing_tables:
                continue
            existing_columns = {column["name"] for column in insp.get_columns(table_name)}
            for name, column_type in columns.items():
                if name not in existing_columns:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {name} {column_type}"))
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


def _ensure_org_tree():
    """组织三表合一：large_teams→根，team_groups→子，developers.group_id→team_id。幂等（按 id）。"""
    from . import models
    from .db import SessionLocal
    with SessionLocal() as db:
        for lt in db.query(models.LargeTeam).all():
            if db.query(models.TeamSpace).filter_by(id=lt.id).first():
                continue
            db.add(models.TeamSpace(
                id=lt.id, name=lt.name, description=lt.description, parent_id=None,
                status="active", created_at="", updated_at="", member_ids=[], project_ids=[],
                tenant_id=lt.tenant_id,
            ))
        db.commit()
        for g in db.query(models.TeamGroup).all():
            if db.query(models.TeamSpace).filter_by(id=g.id).first():
                continue
            db.add(models.TeamSpace(
                id=g.id, name=g.name, description="", parent_id=g.team_id,
                owner_id=g.lead_id, owner_name=g.lead_name,
                status="active", created_at="", updated_at="",
                member_ids=g.member_ids or [], project_ids=g.project_ids or [],
                tenant_id=g.tenant_id,
            ))
        db.commit()
        # 回填存量 team_spaces：旧 large_team_id → parent_id（仅存量库有此列；全新库由 seed 建树）
        if "large_team_id" in {c["name"] for c in inspect(engine).get_columns("team_spaces")}:
            db.execute(text("UPDATE team_spaces SET parent_id = large_team_id WHERE parent_id IS NULL AND large_team_id IS NOT NULL"))
            db.commit()
        for d in db.query(models.Developer).all():
            if d.group_id:
                group = db.query(models.TeamSpace).filter_by(id=d.group_id).first()
                d.team_id = d.group_id
                d.team = group.name if group else d.team
                d.group_id = None
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    ensure_migrate()
    _ensure_org_tree()
    db = SessionLocal()
    ensure_bootstrap_tenant(db)
    db.close()
    # 认证 bootstrap：确保管理员账号存在且可密码登录（密码哈希只在缺失时写入，不覆盖）
    db = SessionLocal()
    admin = db.query(models.AccountUser).filter_by(email=settings.admin_email).first()
    if not admin:
        db.add(models.AccountUser(
            id="usr-bootstrap-admin",
            email=settings.admin_email,
            name="系统管理员",
            password_hash=hash_password(settings.admin_password),
            status="active",
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat(),
        ))
        db.commit()
        db.close()
    else:
        if not admin.password_hash:
            admin.password_hash = hash_password(settings.admin_password)
            admin.updated_at = datetime.now(timezone.utc).isoformat()
            db.commit()
        db.close()
    # 每个租户拥有独立、可编辑的默认环境盘点规则；只补缺失项，不覆盖用户修改。
    db = SessionLocal()
    for (tenant_id,) in db.query(models.Tenant.id).all():
        seed.ensure_default_env_inventory_skills(db, tenant_id)
    db.close()
    db = SessionLocal()
    if db.query(models.TeamSpace).filter_by(tenant_id=seed.SEED_TENANT_ID).count() == 0:
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
    # Skill 驱动架构：为每个租户补齐分析模块（swot/hiring/growth/career/skills_matrix/iceberg）
    # 的默认 SkillGroup（内置 prompt 模板 + 规则），幂等。
    from .analysis_rules import seed_module_groups
    db = SessionLocal()
    for (tenant_id,) in db.query(models.Tenant.id).all():
        seed_module_groups(db, tenant_id)
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


# ============ 监控指标（P6） ============
from fastapi.responses import PlainTextResponse  # noqa: E402

REQUEST_COUNT = 0
REQUEST_ERROR_COUNT = 0


@app.middleware("http")
async def count_requests(request, call_next):
    """轻量请求计数，暴露给 Prometheus 抓取。"""
    global REQUEST_COUNT, REQUEST_ERROR_COUNT
    REQUEST_COUNT += 1
    response = await call_next(request)
    if response.status_code >= 500:
        REQUEST_ERROR_COUNT += 1
    return response


@app.get("/metrics", response_class=PlainTextResponse)
def metrics():
    """Prometheus 文本格式指标。"""
    from .db import SessionLocal
    try:
        with SessionLocal() as db:
            projects = db.query(models.Project).count()
            developers = db.query(models.Developer).count()
            teams = db.query(models.TeamSpace).count()
            evaluations = db.query(models.DeveloperEvaluation).count()
    except Exception:
        projects = developers = teams = evaluations = -1
    return "\n".join([
        "# HELP devlens_http_requests_total 累计 HTTP 请求数",
        "# TYPE devlens_http_requests_total counter",
        f"devlens_http_requests_total {REQUEST_COUNT}",
        "# HELP devlens_http_errors_total 累计 5xx 错误数",
        "# TYPE devlens_http_errors_total counter",
        f"devlens_http_errors_total {REQUEST_ERROR_COUNT}",
        "# HELP devlens_projects 项目总数",
        "# TYPE devlens_projects gauge",
        f"devlens_projects {projects}",
        "# HELP devlens_developers 开发者总数",
        "# TYPE devlens_developers gauge",
        f"devlens_developers {developers}",
        "# HELP devlens_team_spaces 团队空间总数",
        "# TYPE devlens_team_spaces gauge",
        f"devlens_team_spaces {teams}",
        "# HELP devlens_developer_evaluations 开发者评估总数",
        "# TYPE devlens_developer_evaluations gauge",
        f"devlens_developer_evaluations {evaluations}",
    ])

app.include_router(overview.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
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
app.include_router(providers.router, prefix="/api/v1")
app.include_router(open_api.router, prefix="/api/v1")


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
