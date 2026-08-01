"""Pydantic 响应模型 -- 对齐 frontend/lib/types.ts，camelCase 输出"""
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, from_attributes=True
    )


# ============ 首页概览 ============
class StatItem(CamelModel):
    label: str
    value: float
    unit: Optional[str] = None
    delta: float
    trend: list[float]
    icon: str


class TrinityCell(CamelModel):
    score: int
    members: int
    owner: Optional[str] = None


class TrinityMatrix(CamelModel):
    rows: list[str]
    cols: list[str]
    cells: list[list[Optional[TrinityCell]]]


class HealthTrendPoint(CamelModel):
    month: str
    quality: int
    security: int
    health: int


class RiskAlert(CamelModel):
    id: str
    type: str
    level: str
    title: str
    description: str
    time: str
    action: str


class DataSource(CamelModel):
    name: str
    coverage: int
    status: str


class ActiveProject(CamelModel):
    id: str
    name: str
    language: str
    commits: int
    contributors: int
    trend: str


class ActiveDeveloper(CamelModel):
    id: str
    name: str
    role: str
    team: str
    commits: int
    reviews: int
    trend: str


class ActiveTeam(CamelModel):
    id: str
    name: str
    members: int
    score: int
    trend: str


# ============ 项目 ============
class ProjectDimension(CamelModel):
    label: str
    score: int
    benchmark: int
    trend: str
    description: str


class ContributorRanking(CamelModel):
    name: str
    username: str
    commits: int
    reviews: int
    ownership: int


class DebtTrendPoint(CamelModel):
    month: str
    debt: int
    complexity: int


class ReviewCategoryCount(CamelModel):
    category: str
    count: int


class AIReviewInsight(CamelModel):
    id: str
    title: str
    module: str
    type: str
    category: str
    severity: str
    level: str
    risk_score: int
    confidence: float
    status: str
    file_path: str
    symbol: Optional[str] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    source: str
    first_seen_at: str
    last_seen_at: str
    assignee: Optional[str] = None
    evidence: str
    code_excerpt: Optional[str] = None
    impact: str
    action: str
    verification: str
    skill_group: Optional[str] = None


class ModuleRisk(CamelModel):
    id: str
    name: str
    path: str
    score: int
    severity: str
    critical_count: int
    issue_count: int
    complexity: int
    debt_load: int
    owner: Optional[str] = None
    backup_owner: Optional[str] = None
    ownership: int
    last_changed: str
    categories: list[ReviewCategoryCount]


class FixPriority(CamelModel):
    id: str
    insight_id: Optional[str] = None
    module: str
    title: str
    severity: str
    priority: str
    debt: int
    effort: str
    impact: str
    expected_gain: int
    status: str
    assignee: Optional[str] = None
    due_date: Optional[str] = None


class ProjectReviewSummary(CamelModel):
    total: int
    critical: int
    open: int
    new_since_last_scan: int
    in_progress: int
    resolved: int


class ProjectAnalysisMeta(CamelModel):
    branch: str
    commit: str
    analysis_version: str
    scanned_at: str
    coverage: int
    files_scanned: int
    confidence: float


class Project(CamelModel):
    id: str
    name: str
    group: Optional[str] = None
    team_id: Optional[str] = None
    language: Optional[str] = None
    score: Optional[int] = None
    quality: Optional[int] = None
    security: Optional[int] = None
    debt: Optional[int] = None
    status: str = "pending"
    commits: int = 0
    contributors: int = 0
    last_analyzed: Optional[str] = None


class ProjectDetail(Project):
    dimensions: list[ProjectDimension] = []
    ai_insights: list[AIReviewInsight] = []
    contributor_list: list[ContributorRanking] = []
    debt_trend: list[DebtTrendPoint] = []
    fix_priorities: list[FixPriority] = []
    module_risks: list[ModuleRisk] = []
    review_summary: Optional[ProjectReviewSummary] = None
    analysis_meta: Optional[ProjectAnalysisMeta] = None


# ============ 开发者 ============
class Developer(CamelModel):
    id: str
    name: str
    username: str
    role: str
    role_type: str
    team: str
    team_id: str
    group_id: Optional[str] = None
    level: str
    overall: int
    commits: int
    reviews: int
    langs: list[str] = []
    tags: list[str] = []


class GrowthCurvePoint(CamelModel):
    period: str
    composite: int
    team_avg: int


class BehaviorEvidence(CamelModel):
    label: str
    value: float
    unit: str
    benchmark: float
    description: str


class CollaborationPartner(CamelModel):
    name: str
    username: str
    shared_commits: int
    review_count: int


class ModuleContribution(CamelModel):
    module: str
    commits: int
    ownership: int
    complexity: int


class DeveloperDetail(Developer):
    capability: dict[str, Any] = {}
    team_capability_avg: dict[str, Any] = {}
    role_standard: Optional[dict[str, Any]] = None
    growth_curve: list[GrowthCurvePoint] = []
    behavior_evidence: list[BehaviorEvidence] = []
    partners: list[CollaborationPartner] = []
    modules: list[ModuleContribution] = []
    ai_suggestion: str = ""


# ============ 团队 ============
class Team(CamelModel):
    id: str
    name: str
    members: int
    avg_score: int
    bus_factor: int
    risk_count: int
    capability: dict[str, Any]


class CapabilityGap(CamelModel):
    capability: str
    current: int
    target: int
    owner: str
    action: str


# ============ 组织 ============
class LargeTeamM(CamelModel):
    id: str
    name: str
    description: Optional[str] = None


class TeamSpace(CamelModel):
    id: str
    name: str
    large_team_id: str
    description: Optional[str] = None
    owner_id: Optional[str] = None
    owner_name: Optional[str] = None
    status: str = "active"
    created_at: str = ""
    updated_at: str = ""
    member_ids: list[str] = []
    project_ids: list[str] = []


class TeamGroup(CamelModel):
    id: str
    team_id: str
    name: str
    lead_id: Optional[str] = None
    lead_name: Optional[str] = None
    member_ids: list[str] = []
    project_ids: list[str] = []


# ============ 仓库 / 分析 / 匹配 ============
class Repository(CamelModel):
    id: str
    name: str
    path: str
    source_type: str
    provider: Optional[str] = None
    remote_url: Optional[str] = None
    branch: str
    team_id: str
    project_id: Optional[str] = None
    status: str = "synced"
    last_sync: str = ""
    commits: int = 0
    contributors: int = 0


class AnalysisRun(CamelModel):
    id: str
    project_id: str
    status: str
    progress: int
    stage: str
    message: str
    updated_at: str


class IdentityMatch(CamelModel):
    git_name: str
    git_email: str
    person_name: str
    department: str
    confidence: float
    method: str


# ============ 请求 ============
class ProjectCreateRequest(CamelModel):
    name: str
    repo_type: str
    repo_url: Optional[str] = None
    repo_path: Optional[str] = None
    provider: Optional[str] = None
    branch: str
    team_id: str
    access_token: Optional[str] = None
    skill_group_id: Optional[str] = None  # 可选：本次分析绑定的 Skill Group


class RepositoryImportResult(CamelModel):
    project_id: str
    run_id: str
    source_type: str
    provider: Optional[str] = None
    repository: str
    branch: str
    status: str = "queued"


# ============ 配置: LLM / 向量 / 图谱 ============
class ModelProviderM(CamelModel):
    key: str
    name: str
    api_key: str
    base_url: str
    status: str
    models: list[str] = []


class TaskRouteM(CamelModel):
    task: str
    provider: str
    model: str
    desc: str


class VectorCollectionM(CamelModel):
    name: str
    vectors: int
    size: str
    dimension: int


class EmbeddingModelM(CamelModel):
    name: str
    dimension: int
    status: str


class GraphNodeM(CamelModel):
    id: str
    label: str
    layer: str
    x: int
    y: int
    loc: str
    health: int


class GraphEdgeM(CamelModel):
    source: str
    target: str


class GraphData(CamelModel):
    nodes: list[GraphNodeM]
    edges: list[GraphEdgeM]
    stats: dict[str, Any]


# ============ Skill 管理模块 ============
class SkillExample(CamelModel):
    desc: str = ""
    code: str = ""


class SkillSourceM(CamelModel):
    id: str
    name: str
    doc_type: str = "markdown"
    content: str = ""
    source_lang: str = ""
    description: str = ""
    status: str = "imported"
    created_by: str = ""
    created_at: str = ""
    updated_at: str = ""


class SkillM(CamelModel):
    id: str
    source_id: Optional[str] = None
    name: str
    description: str = ""
    category: str = "quality"
    severity: str = "medium"
    check_type: str = "llm"
    rule_content: str = ""
    positive_examples: list[SkillExample] = []
    negative_examples: list[SkillExample] = []
    enabled: int = 1
    created_by: str = ""
    created_at: str = ""
    updated_at: str = ""


class SkillGroupM(CamelModel):
    id: str
    name: str
    description: str = ""
    skill_ids: list[str] = []
    analysis_type: str = "repo_analysis"
    enabled: int = 1
    created_at: str = ""
    updated_at: str = ""


class SkillGroupRunM(CamelModel):
    id: str
    run_id: Optional[str] = None
    project_id: Optional[str] = None
    group_id: str
    group_snapshot: dict[str, Any]
    trigger: str = "manual"
    created_at: str = ""


# ---- Skill 请求模型 ----
class SkillSourceCreateRequest(CamelModel):
    name: str
    doc_type: str = "markdown"
    content: str = ""
    source_lang: str = ""
    description: str = ""


class SkillCreateRequest(CamelModel):
    name: str
    description: str = ""
    category: str = "quality"
    severity: str = "medium"
    check_type: str = "llm"
    rule_content: str = ""
    positive_examples: list[SkillExample] = []
    negative_examples: list[SkillExample] = []
    source_id: Optional[str] = None
    enabled: int = 1


class SkillGroupCreateRequest(CamelModel):
    name: str
    description: str = ""
    skill_ids: list[str] = []
    analysis_type: str = "repo_analysis"
    enabled: int = 1


class BindGroupRequest(CamelModel):
    group_id: str


class ExtractResult(CamelModel):
    source_id: str
    status: str
    extracted: int = 0
    message: str = ""
