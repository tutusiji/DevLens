"""ORM 模型 —— 严格对齐 frontend/lib/types.ts

复杂结构（dimensions / capability / categories 等）用 JSON 字段存储，
既保证前端类型形状，又避免过度拆表（P0 阶段）。
"""
from sqlalchemy import (
    Column, String, Integer, Float, Text, JSON, ForeignKey,
)
from sqlalchemy.orm import relationship

from .db import Base


class LargeTeam(Base):
    __tablename__ = "large_teams"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text)


class TeamSpace(Base):
    __tablename__ = "team_spaces"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    large_team_id = Column(String, ForeignKey("large_teams.id"))
    description = Column(Text)
    owner_id = Column(String)
    owner_name = Column(String)
    status = Column(String, default="active")
    created_at = Column(String)
    updated_at = Column(String)
    member_ids = Column(JSON, default=list)
    project_ids = Column(JSON, default=list)


class TeamGroup(Base):
    __tablename__ = "team_groups"
    id = Column(String, primary_key=True)
    team_id = Column(String, ForeignKey("team_spaces.id"))
    name = Column(String)
    lead_id = Column(String)
    lead_name = Column(String)
    member_ids = Column(JSON, default=list)
    project_ids = Column(JSON, default=list)


class Developer(Base):
    __tablename__ = "developers"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    username = Column(String)
    role = Column(String)
    role_type = Column(String)  # Role: frontend|backend|devops|algorithm|qa
    team = Column(String)
    team_id = Column(String, ForeignKey("team_spaces.id"))
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
    ai_suggestion = Column(Text)


class Team(Base):
    __tablename__ = "teams"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    members = Column(Integer, default=0)
    avg_score = Column(Integer)
    bus_factor = Column(Integer)
    risk_count = Column(Integer, default=0)
    capability = Column(JSON)  # TeamCapabilityVector


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
    insights = relationship("Insight", back_populates="project", cascade="all, delete-orphan")
    module_risks = relationship("ModuleRisk", back_populates="project", cascade="all, delete-orphan")
    fix_priorities = relationship("FixPriority", back_populates="project", cascade="all, delete-orphan")


class Repository(Base):
    __tablename__ = "repositories"
    id = Column(String, primary_key=True)
    name = Column(String)
    path = Column(String)
    source_type = Column(String)  # remote|local
    provider = Column(String)     # github|gitlab|gitea|bitbucket|generic
    remote_url = Column(String)
    branch = Column(String)
    team_id = Column(String)
    project_id = Column(String, ForeignKey("projects.id"))
    status = Column(String, default="synced")  # synced|syncing|failed
    last_sync = Column(String)
    commits = Column(Integer, default=0)
    contributors = Column(Integer, default=0)


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
    department = Column(String)
    confidence = Column(Float)
    method = Column(String)  # email|employee_id|pinyin|fuzzy|exact


class CapabilityGap(Base):
    __tablename__ = "capability_gaps"
    id = Column(String, primary_key=True)
    capability = Column(String)
    current = Column(Integer)
    target = Column(Integer)
    owner = Column(String)
    action = Column(String)


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


class SkillGroup(Base):
    """评估编组：每次评估选择一组规则"""
    __tablename__ = "skill_groups"
    id = Column(String, primary_key=True)          # skg-xxx
    name = Column(String, nullable=False)          # 组名，如「Java后端规范组」
    description = Column(Text, default="")
    skill_ids = Column(JSON, default=list)          # [skill_id, ...] 有序
    analysis_type = Column(String, default="repo_analysis")  # repo_analysis|developer_review|team_aggregation
    enabled = Column(Integer, default=1)
    created_at = Column(String)
    updated_at = Column(String)


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
