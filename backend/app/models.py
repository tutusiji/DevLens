"""ORM 模型 —— 严格对齐 frontend/lib/types.ts

复杂结构（dimensions / capability / categories 等）用 JSON 字段存储，
既保证前端类型形状，又避免过度拆表（P0 阶段）。
"""
from sqlalchemy import (
    Column, String, Integer, Float, Text, JSON, ForeignKey, UniqueConstraint,
    LargeBinary,
)
from sqlalchemy.orm import relationship

from .db import Base


class LargeTeam(Base):
    __tablename__ = "large_teams"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    tenant_id = Column(String, default="tenant-default", index=True)


class TeamSpace(Base):
    __tablename__ = "team_spaces"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    parent_id = Column(String, ForeignKey("team_spaces.id"), nullable=True)  # 可选父团队
    description = Column(Text)
    owner_id = Column(String)
    owner_name = Column(String)
    status = Column(String, default="active")
    created_at = Column(String)
    updated_at = Column(String)
    member_ids = Column(JSON, default=list)
    project_ids = Column(JSON, default=list)
    tenant_id = Column(String, default="tenant-default", index=True)


class RepositoryProviderConfig(Base):
    """平台级凭证与 Webhook 配置（GitHub / GitLab / Gitee / Gitea 等）。

    access_token / webhook_secret 均以 Fernet 加密后落库。
    """
    __tablename__ = "repository_provider_configs"
    id = Column(String, primary_key=True)          # 如 github-<hash>
    provider = Column(String, nullable=False)      # github|gitlab|gitee|gitea|bitbucket|generic
    display_name = Column(String, default="")
    base_url = Column(String, default="")          # 自建实例地址；空为官方
    access_token_encrypted = Column(LargeBinary, nullable=True)
    webhook_secret_encrypted = Column(LargeBinary, nullable=True)
    enabled = Column(Integer, default=1)
    created_at = Column(String)
    updated_at = Column(String)
    tenant_id = Column(String, default="tenant-default", index=True)


class ApiToken(Base):
    """应用级 API Token（开放平台）：按租户隔离，scope 控制可访问域。"""
    __tablename__ = "api_tokens"
    id = Column(String, primary_key=True)          # atk-xxx
    name = Column(String, nullable=False)
    token_hash = Column(String, nullable=False)    # sha256(token)，明文只返回一次
    scope = Column(String, default="read")         # read|write
    last_used_at = Column(String)
    expires_at = Column(String)
    created_at = Column(String)
    tenant_id = Column(String, default="tenant-default", index=True)


class ApiAccessLog(Base):
    """API Token 调用审计：每次 X-API-Key 请求记录时间戳与路径。"""
    __tablename__ = "api_access_logs"
    id = Column(String, primary_key=True)          # aal-xxx
    token_id = Column(String, nullable=False)
    method = Column(String, default="")
    path = Column(String, default="")
    status = Column(Integer, default=0)
    created_at = Column(String, index=True)
    tenant_id = Column(String, default="tenant-default", index=True)


class TeamGroup(Base):
    __tablename__ = "team_groups"
    id = Column(String, primary_key=True)
    team_id = Column(String, ForeignKey("team_spaces.id"))
    name = Column(String)
    lead_id = Column(String)
    lead_name = Column(String)
    member_ids = Column(JSON, default=list)
    project_ids = Column(JSON, default=list)
    tenant_id = Column(String, default="tenant-default", index=True)


class Developer(Base):
    __tablename__ = "developers"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    username = Column(String)
    email = Column(String, nullable=True)
    employee_id = Column(String, nullable=True)  # 工号，用于身份匹配
    role = Column(String)
    role_type = Column(String)  # Role: frontend|backend|devops|algorithm|qa
    team = Column(String)
    team_id = Column(String, ForeignKey("team_spaces.id"))
    team_space_id = Column(String, ForeignKey("team_spaces.id"), nullable=True)
    group_id = Column(String)
    level = Column(String)  # Level: D1-G3
    overall = Column(Integer)
    commits = Column(Integer, default=0)
    reviews = Column(Integer, default=0)
    langs = Column(JSON, default=list)
    tags = Column(JSON, default=list)
    # DeveloperDetail 扩展
    capability = Column(JSON)              # DeveloperCapabilityVector
    team_capability_avg = Column(JSON)     # TeamCapabilityVector
    growth_curve = Column(JSON)            # GrowthCurvePoint[]
    behavior_evidence = Column(JSON)       # BehaviorEvidence[]
    partners = Column(JSON)                # CollaborationPartner[]
    modules = Column(JSON)                 # ModuleContribution[]
    project_contributions = Column(JSON, default=list)  # DeveloperProjectContribution[]
    ai_suggestion = Column(Text)
    # 组织隔离：旧数据迁移至 tenant-default，新写入数据必须归属租户。
    tenant_id = Column(String, default="tenant-default", index=True)


class Team(Base):
    __tablename__ = "teams"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    members = Column(Integer, default=0)
    avg_score = Column(Integer)
    bus_factor = Column(Integer)
    risk_count = Column(Integer, default=0)
    capability = Column(JSON)  # TeamCapabilityVector
    tenant_id = Column(String, default="tenant-default", index=True)


class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    group = Column(String)
    team_id = Column(String)
    language = Column(String)
    score = Column(Integer)
    quality = Column(Integer)
    security = Column(Integer)
    debt = Column(Integer)
    status = Column(String, default="pending")  # ProjectStatus
    commits = Column(Integer, default=0)
    contributors = Column(Integer, default=0)
    last_analyzed = Column(String)
    # ProjectDetail 扩展（JSON）
    dimensions = Column(JSON)          # ProjectDimension[]
    contributor_list = Column(JSON)    # ContributorRanking[]
    debt_trend = Column(JSON)          # DebtTrendPoint[]
    review_summary = Column(JSON)      # ProjectReviewSummary
    analysis_meta = Column(JSON)       # ProjectAnalysisMeta
    assets = Column(JSON)              # 技术资产清单(frameworks/dependencies/configs/deployments)
    graph_edges = Column(JSON)         # 代码图谱真实依赖边(import 解析)
    architecture_design = Column(JSON) # 从项目代码、资产、依赖与风险提取的架构设计方案快照
    tenant_id = Column(String, default="tenant-default", index=True)
    insights = relationship("Insight", back_populates="project", cascade="all, delete-orphan")
    module_risks = relationship("ModuleRisk", back_populates="project", cascade="all, delete-orphan")
    fix_priorities = relationship("FixPriority", back_populates="project", cascade="all, delete-orphan")


class Repository(Base):
    __tablename__ = "repositories"
    id = Column(String, primary_key=True)
    name = Column(String)
    path = Column(String)  # 本地缓存路径（分析时填充）
    source_type = Column(String, default="remote")  # 当前仅支持 remote
    provider = Column(String)     # github|gitlab|gitee|gitea|bitbucket|generic
    remote_url = Column(String)
    branch = Column(String)
    access_token_encrypted = Column(LargeBinary, nullable=True)  # 私有仓库 access token
    team_id = Column(String)
    project_id = Column(String, ForeignKey("projects.id"))
    status = Column(String, default="synced")  # synced|syncing|failed
    last_sync = Column(String)
    commits = Column(Integer, default=0)
    contributors = Column(Integer, default=0)
    tenant_id = Column(String, default="tenant-default", index=True)


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"
    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"))
    status = Column(String, default="queued")  # queued|cloning|analyzing|completed|failed
    progress = Column(Integer, default=0)
    stage = Column(String, default="")
    message = Column(String, default="")
    updated_at = Column(String)
    skill_group_id = Column(String)  # 本次分析绑定的 Skill Group（可空）


class Insight(Base):
    __tablename__ = "insights"
    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"))
    title = Column(String)
    module = Column(String)
    type = Column(String)      # ReviewCategory
    category = Column(String)  # ReviewCategory
    severity = Column(String)  # critical|high|medium|low|info
    level = Column(String)     # critical|warning|info
    risk_score = Column(Integer)
    confidence = Column(Float)
    status = Column(String, default="open")  # InsightStatus
    file_path = Column(String)
    symbol = Column(String)
    start_line = Column(Integer)
    end_line = Column(Integer)
    source = Column(String)
    first_seen_at = Column(String)
    last_seen_at = Column(String)
    assignee = Column(String)
    evidence = Column(Text)
    code_excerpt = Column(Text)
    impact = Column(Text)
    action = Column(Text)
    verification = Column(Text)
    skill_group = Column(String)  # 来源 Skill Group: security|quality|...
    project = relationship("Project", back_populates="insights")


class ModuleRisk(Base):
    __tablename__ = "module_risks"
    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"))
    name = Column(String)
    path = Column(String)
    score = Column(Integer)
    severity = Column(String)  # critical|high|medium|low
    critical_count = Column(Integer, default=0)
    issue_count = Column(Integer, default=0)
    complexity = Column(Integer)
    debt_load = Column(Integer)
    owner = Column(String)
    backup_owner = Column(String)
    ownership = Column(Integer)
    last_changed = Column(String)
    categories = Column(JSON)  # ReviewCategoryCount[]
    project = relationship("Project", back_populates="module_risks")


class FixPriority(Base):
    __tablename__ = "fix_priorities"
    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"))
    insight_id = Column(String)
    module = Column(String)
    title = Column(String)
    severity = Column(String)
    priority = Column(String)  # P0|P1|P2|P3
    debt = Column(Integer, default=0)
    effort = Column(String)
    impact = Column(Text)
    expected_gain = Column(Integer)
    status = Column(String, default="open")  # InsightStatus
    assignee = Column(String)
    due_date = Column(String)
    project = relationship("Project", back_populates="fix_priorities")


class IdentityMatch(Base):
    __tablename__ = "identity_matches"
    id = Column(String, primary_key=True)
    project_id = Column(String)  # 关联项目（nullable=全局 seed）
    git_name = Column(String)
    git_email = Column(String)
    person_name = Column(String)
    developer_id = Column(String, ForeignKey("developers.id"), nullable=True)
    department = Column(String)
    confidence = Column(Float)
    method = Column(String)  # email|employee_id|pinyin|fuzzy|exact
    tenant_id = Column(String, default="tenant-default", index=True)


class CapabilityGap(Base):
    __tablename__ = "capability_gaps"
    id = Column(String, primary_key=True)
    capability = Column(String)
    current = Column(Integer)
    target = Column(Integer)
    owner = Column(String)
    action = Column(String)
    tenant_id = Column(String, default="tenant-default", index=True)


class ModelProvider(Base):
    __tablename__ = "model_providers"
    id = Column(String, primary_key=True)
    key = Column(String)
    name = Column(String)
    api_key = Column(String)  # 脱敏展示
    base_url = Column(String)
    status = Column(String, default="unconfigured")  # connected|unconfigured
    models = Column(JSON)  # list[str]


class TaskRoute(Base):
    __tablename__ = "task_routes"
    id = Column(String, primary_key=True)
    task = Column(String)
    provider = Column(String)
    model = Column(String)
    desc = Column(String)


class VectorCollection(Base):
    __tablename__ = "vector_collections"
    id = Column(String, primary_key=True)
    name = Column(String)
    vectors = Column(Integer)
    size = Column(String)
    dimension = Column(Integer)


class EmbeddingModel(Base):
    __tablename__ = "embedding_models"
    id = Column(String, primary_key=True)
    name = Column(String)
    dimension = Column(Integer, default=0)
    status = Column(String, default="inactive")  # active|inactive


# ============ Skill 管理模块（4 张新表）============

class SkillSource(Base):
    """规则来源：导入的编码规范文档（md/txt 文本直接录入）"""
    __tablename__ = "skill_sources"
    id = Column(String, primary_key=True)          # sk-src-xxx
    name = Column(String, nullable=False)          # 规范名称，如《Java编码规范v3.2》
    doc_type = Column(String, default="markdown")  # markdown|text|pdf
    content = Column(Text, default="")             # 规范全文（md/txt 时直接存文本）
    source_lang = Column(String, default="")       # java|frontend|go|python|all
    description = Column(Text, default="")         # 一句话说明
    status = Column(String, default="imported")    # imported|extracted|failed
    created_by = Column(String, default="")
    created_at = Column(String)
    updated_at = Column(String)
    tenant_id = Column(String, default="tenant-default", index=True)


class Skill(Base):
    """规则条目：一条 Skill = 一条可执行的评估规则"""
    __tablename__ = "skills"
    id = Column(String, primary_key=True)          # sk-xxx
    source_id = Column(String, ForeignKey("skill_sources.id"), nullable=True)  # 来源（可为空=手工创建）
    name = Column(String, nullable=False)          # 规则名，如「禁止硬编码密钥」
    description = Column(Text, default="")         # 规则说明（展示用）
    category = Column(String, default="quality")   # quality|security|performance|architecture|maintainability|reliability|logic|complexity|configuration|dependency|testing|delivery
    severity = Column(String, default="medium")    # critical|high|medium|low|info
    check_type = Column(String, default="llm")     # llm（LLM 语义审查）|static（静态检测，预留）
    rule_content = Column(Text, nullable=False)    # ★ 规则正文，LLM 评估时注入 prompt
    positive_examples = Column(JSON, default=list)  # [{desc, code}] 合规示例（few-shot）
    negative_examples = Column(JSON, default=list)  # [{desc, code}] 违规示例（few-shot）
    enabled = Column(Integer, default=1)           # 0|1 启停
    created_by = Column(String, default="")
    created_at = Column(String)
    updated_at = Column(String)
    tenant_id = Column(String, default="tenant-default", index=True)


class SkillGroup(Base):
    """评估编组：每次评估选择一组规则。

    analysis_type 标识绑定的分析模块（repo_analysis / developer_evaluation /
    skills_matrix / iceberg / swot / hiring_advice / growth_advice / career_path / env_scan），
    同类型只有一个默认启用组。prompt_template 为分析 prompt 骨架（支持 {变量} 占位），
    组内 skills 的 rule_content 会注入其中 —— 规则全部资产化，不写死在分析代码里。
    """
    __tablename__ = "skill_groups"
    id = Column(String, primary_key=True)          # skg-xxx
    name = Column(String, nullable=False)          # 组名，如「Java后端规范组」
    description = Column(Text, default="")
    skill_ids = Column(JSON, default=list)          # [skill_id, ...] 有序
    analysis_type = Column(String, default="repo_analysis")  # 模块标识，见类注释
    prompt_template = Column(Text, default="")       # 分析 prompt 骨架（{变量} 占位）
    enabled = Column(Integer, default=1)
    created_at = Column(String)
    updated_at = Column(String)
    tenant_id = Column(String, default="tenant-default", index=True)


class SkillGroupRun(Base):
    """评估运行记录：哪次分析用了哪个组、组内规则的版本快照（保证可复现）"""
    __tablename__ = "skill_group_runs"
    id = Column(String, primary_key=True)          # skgr-xxx
    run_id = Column(String, ForeignKey("analysis_runs.id"), nullable=True)  # 关联分析运行
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    group_id = Column(String, ForeignKey("skill_groups.id"))
    group_snapshot = Column(JSON)                  # {group_name, skill_ids:[...], rules:[{id,name,category,severity,rule_content}]} 快照
    trigger = Column(String, default="manual")     # manual|auto
    created_at = Column(String)


# ============ 能力标准管理（2 张新表）============

class CapabilityRole(Base):
    """开发角色的能力维度配置，以及可选的 Skill 规则编组关联。"""
    __tablename__ = "capability_roles"

    __table_args__ = (
        UniqueConstraint("tenant_id", "key", name="uq_capability_role_tenant_key"),
    )

    id = Column(String, primary_key=True)          # cr-frontend / cr-backend / ...
    key = Column(String, nullable=False)           # frontend|backend|devops|algorithm|qa
    name = Column(String, nullable=False)          # 前端工程师 / 后端工程师 ...
    dimensions = Column(JSON, default=list)        # ["code_quality", "architecture", ...]
    skill_group_id = Column(String, ForeignKey("skill_groups.id"), nullable=True)
    enabled = Column(Integer, default=1)
    created_at = Column(String)
    updated_at = Column(String)
    tenant_id = Column(String, default="tenant-default", index=True)


class CapabilityStandard(Base):
    """一条记录对应一个角色和职级；各维度阈值以 JSON 字典保存。"""
    __tablename__ = "capability_standards"
    __table_args__ = (
        UniqueConstraint("role_id", "level", name="uq_capability_standard_role_level"),
    )

    id = Column(String, primary_key=True)          # cstd-xxx
    role_id = Column(String, ForeignKey("capability_roles.id"), nullable=False)
    level = Column(String, nullable=False)         # D1-D3 / E1-E3 / F1-F3 / G1-G3
    thresholds = Column(JSON, default=dict)        # {"code_quality": 85, ...}
    updated_at = Column(String)


# ============ 项目环境配置盘点（Env Inventory，2 张新表）============

class EnvInventoryScan(Base):
    """扫描记录：每次扫描一条，区分全量/增量"""
    __tablename__ = "env_inventory_scans"
    id = Column(String, primary_key=True)          # einv-scan-xxx
    project_id = Column(String, ForeignKey("projects.id"))
    scan_type = Column(String, default="full")     # full（全量）| incremental（按此历史更新）
    status = Column(String, default="scanning")    # scanning|completed|failed
    trigger = Column(String, default="manual")     # manual|auto
    started_at = Column(String)
    finished_at = Column(String)
    files_scanned = Column(Integer, default=0)     # 本次扫描的配置文件数
    entries_found = Column(Integer, default=0)     # 本次发现的条目数
    added = Column(Integer, default=0)             # 增量：新增条目数
    changed = Column(Integer, default=0)           # 增量：变更条目数
    removed = Column(Integer, default=0)           # 增量：失效条目数
    unchanged = Column(Integer, default=0)         # 增量：无变化条目数
    message = Column(Text, default="")
    # 本次扫描实际采用的环境盘点规则；快照保证结果可解释、可追溯。
    skill_ids = Column(JSON, default=list)
    skill_snapshot = Column(JSON, default=dict)


class EnvInventorySkill(Base):
    """环境盘点规则资产：定义扫描范围、关键词与 AI 提取边界。"""
    __tablename__ = "env_inventory_skills"
    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_env_inventory_skill_tenant_slug"),
    )

    id = Column(String, primary_key=True)
    slug = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    file_patterns = Column(JSON, default=list)
    keywords = Column(JSON, default=list)
    tool_types = Column(JSON, default=list)
    ai_instruction = Column(Text, default="")
    enabled = Column(Integer, default=1)
    built_in = Column(Integer, default=0)
    created_by = Column(String, default="")
    created_at = Column(String)
    updated_at = Column(String)
    tenant_id = Column(String, default="tenant-default", index=True)


class EnvInventoryEntry(Base):
    """配置条目：一条记录 = 一个配置项（含环境、工具类型、来源文件、更新时间）"""
    __tablename__ = "env_inventory_entries"
    id = Column(String, primary_key=True)          # einv-xxx
    project_id = Column(String, ForeignKey("projects.id"))
    scan_id = Column(String, ForeignKey("env_inventory_scans.id"), nullable=True)
    # ---- 分类维度 ----
    env = Column(String, default="common")         # dev|test|prod|gray|common（环境归属）
    tool_type = Column(String, default="other")    # database|redis|nacos|mq|kafka|es|oss|gateway|third_party|other
    tool_name = Column(String, default="")         # 工具/服务名，如 mysql / redis / nacos / user-center
    # ---- 配置内容 ----
    key = Column(String, default="")               # 配置键，如 spring.datasource.url / REDIS_HOST
    value = Column(Text, default="")               # 配置值（密码类已脱敏存储）
    is_secret = Column(Integer, default=0)         # 0|1 是否敏感字段（password/secret/token/key）
    # ---- 结构化连接信息（由 YAML / Compose / URL 解析器提取）----
    host = Column(String, default="")
    port = Column(String, default="")
    username = Column(String, default="")
    database = Column(String, default="")
    fingerprint = Column(String, default="")       # tool+env+host+port+db+source_file 的稳定去重指纹
    detail = Column(JSON, default=dict)            # namespace/group/service 等补充信息
    # ---- 溯源 ----
    source_file = Column(String, default="")       # 来源文件路径（相对仓库根）
    source_line = Column(Integer, default=0)       # 来源行号
    file_mtime = Column(String, default="")        # 源文件最后修改时间（ISO）
    first_seen_at = Column(String, default="")     # 首次发现时间
    updated_at = Column(String, default="")        # 最近更新时间（本次扫描时间）
    status = Column(String, default="active")      # active|added|changed|removed（增量对比用）
    previous_value = Column(Text, default="")      # 增量扫描前的旧值（changed 时记录）


# ============ 开发者能力实测评估（1 张新表）============

class DeveloperEvaluation(Base):
    """一次评估 = 一个 git 作者在某仓库的真实代码贡献实测。"""
    __tablename__ = "developer_evaluations"

    id = Column(String, primary_key=True)          # deval-xxx
    developer_id = Column(String, ForeignKey("developers.id"), nullable=False)
    role_key = Column(String, nullable=False)      # frontend|backend|devops|algorithm|qa
    skill_group_id = Column(String, ForeignKey("skill_groups.id"), nullable=True)
    tenant_id = Column(String, default="tenant-default", index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    repo_path = Column(String, nullable=True)      # 评估时本地缓存路径（运行中填充）
    git_author = Column(String, nullable=False)    # git log --format=%an
    branch = Column(String, nullable=True)         # 评估分支
    scores = Column(JSON, default=dict)            # {"code_quality": 85, ...}
    evidence = Column(JSON, default=list)          # [{dimension, summary, rules: [...]}]
    rule_snapshot = Column(JSON, default=dict)     # 评估时冻结的 Skill Group + 已启用规则
    achieved_level = Column(String, nullable=True) # D1-G3；无达标则 NULL
    best_level = Column(String, nullable=True)     # 阈值距离最近的参考职级
    gaps = Column(JSON, default=list)              # [{dimension, current, target, gap}]
    summary = Column(Text, default="")
    status = Column(String, default="running")     # running|completed|failed
    error = Column(Text, default="")
    created_at = Column(String)
    updated_at = Column(String)


# ============ 可售化：多租户 / 权限 / 评估快照与报告 ============

class Tenant(Base):
    """一个客户组织（租户）；所有可售化资产均以 tenant_id 隔离。"""
    __tablename__ = "tenants"

    id = Column(String, primary_key=True)          # tenant-xxx
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    status = Column(String, default="active")      # active|suspended
    created_at = Column(String)
    updated_at = Column(String)


class AccountUser(Base):
    """认证提供方映射的本地用户资料；密码只存 bcrypt 哈希。"""
    __tablename__ = "account_users"

    id = Column(String, primary_key=True)          # usr-xxx
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)          # 昵称（可修改）
    username = Column(String, nullable=True)       # 用户名（注册后不可改；DiceBear 种子；应用层唯一）
    avatar_url = Column(String, nullable=True)     # 头像 URL：DiceBear 绝对 URL 或 /api/v1/avatars/xxx
    password_hash = Column(String, nullable=True)  # bcrypt; NULL=仅限外部认证/不可密码登录
    status = Column(String, default="active")      # active|disabled
    created_at = Column(String)
    updated_at = Column(String)


class TenantMembership(Base):
    """用户在租户内的 RBAC 角色。"""
    __tablename__ = "tenant_memberships"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", name="uq_tenant_membership"),
    )

    id = Column(String, primary_key=True)          # tmem-xxx
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("account_users.id"), nullable=False, index=True)
    role = Column(String, nullable=False)          # owner|admin|evaluator|analyst|viewer
    created_at = Column(String)
    updated_at = Column(String)


class ProjectAssessmentSnapshot(Base):
    """项目评分历史快照，支撑横向对比与时间趋势。"""
    __tablename__ = "project_assessment_snapshots"

    id = Column(String, primary_key=True)          # psnap-xxx
    tenant_id = Column(String, default="tenant-default", index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id"), nullable=True)
    score = Column(Integer, default=0)
    quality = Column(Integer, default=0)
    security = Column(Integer, default=0)
    debt = Column(Integer, default=0)
    contributors = Column(Integer, default=0)
    commits = Column(Integer, default=0)
    recorded_at = Column(String, nullable=False)
    source = Column(String, default="analysis")    # analysis|baseline|manual


class ReportExport(Base):
    """可追溯的评估报告导出记录；导出本身动态生成，不存储敏感内容副本。"""
    __tablename__ = "report_exports"

    id = Column(String, primary_key=True)          # rpt-xxx
    tenant_id = Column(String, default="tenant-default", index=True)
    report_type = Column(String, nullable=False)   # project_comparison|developer_evaluation
    format = Column(String, nullable=False)        # html|pdf
    subject_ids = Column(JSON, default=list)
    requested_by = Column(String, default="")
    created_at = Column(String, nullable=False)
