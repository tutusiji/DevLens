/**
 * DevLens 全局类型定义
 * 对齐后端 API 应返回的数据形状，后续接真实接口零改动
 */

// ============ 通用类型 ============

export type ProjectStatus = 'pending' | 'analyzing' | 'completed' | 'failed';
export type RiskLevel = 'high' | 'medium' | 'low';
export type RiskType = 'skill_gap' | 'high_variance' | 'bus_factor' | 'tech_debt';

// ============ 职级体系 D1-G3 ============
// D 是最高高阶能力层，G 是工程师成长层；同一大级内 3 > 2 > 1
export type Level =
  | 'D1' | 'D2' | 'D3'
  | 'E1' | 'E2' | 'E3'
  | 'F1' | 'F2' | 'F3'
  | 'G1' | 'G2' | 'G3';

// 按能力从高到低排列；同一大级中子等 3 最高
export const LEVELS: Level[] = [
  'D3', 'D2', 'D1',
  'E3', 'E2', 'E1',
  'F3', 'F2', 'F1',
  'G3', 'G2', 'G1',
];

export const LEVEL_GROUPS: { prefix: string; label: string; range: string }[] = [
  { prefix: 'D', label: '高阶能力层', range: '稀缺高阶岗位，部门通常 2-3 人' },
  { prefix: 'E', label: '资深工程师', range: '技术深度与独立负责能力' },
  { prefix: 'F', label: '中高级工程师', range: '稳定交付与模块负责能力' },
  { prefix: 'G', label: '工程师成长层', range: '基础能力与成长阶段' },
];

// 用于开发者列表排序，数值越大代表能力层级越高
export const LEVEL_ORDER: Record<Level, number> = {
  D1: 10, D2: 11, D3: 12,
  E1: 7, E2: 8, E3: 9,
  F1: 4, F2: 5, F3: 6,
  G1: 1, G2: 2, G3: 3,
};

// ============ 开发角色 ============
export type Role = 'frontend' | 'backend' | 'devops' | 'algorithm' | 'qa';

export interface RoleConfig {
  key: Role;
  name: string;
  dimensions: string[]; // 该角色的 8 个维度 key
}

// ============ 能力标准 ============
export interface LevelStandard {
  level: Level;
  standards: Record<string, number>; // 维度 key -> 标准分阈值(0-100)
}

/** 能力标准管理中单个角色的完整配置 */
export interface CapabilityRoleInfo {
  roleKey: Role;
  roleName: string;
  dimensions: string[];
  skillGroupId?: string | null;
  skillGroupName?: string | null;
  standards: Record<Level, Record<string, number>>;
}

/** 能力标准页元数据，由后端提供以避免展示常量漂移 */
export interface CapabilityMeta {
  dimensionLabels: Record<string, string>;
  allLevels: Level[];
  levelGroups: { prefix: string; label: string; range: string }[];
  defaultDimensions: Record<string, string[]>;
}

export interface CapabilitySaveRequest {
  dimensions: string[];
  standards: Record<Level, Record<string, number>>;
  skillGroupId?: string | null;
}

// ============ 首页：决策总览 ============

export interface StatItem {
  label: string;
  value: number;
  unit?: string;
  delta: number; // 环比变化，正数上升负数下降
  trend: number[]; // 迷你趋势数据
  icon: string; // lucide icon 名
}

export interface TrinityCell {
  score: number; // 综合评分 0-100
  members: number; // 参与人数
  owner?: string; // 负责人
}

export interface TrinityMatrix {
  rows: string[]; // 团队名
  cols: string[]; // 项目名
  cells: (TrinityCell | null)[][]; // [teamIndex][projectIndex]
}

export interface HealthTrendPoint {
  month: string;
  quality: number;
  security: number;
  health: number;
}

export interface RiskAlert {
  id: string;
  type: RiskType;
  level: RiskLevel;
  title: string;
  description: string;
  time: string;
  action: string;
}

export interface DataSource {
  name: string;
  coverage: number; // 0-100
  status: 'connected' | 'partial' | 'disconnected';
}

// ============ 决策总览：活跃榜单 ============

export type ActivityTrend = 'up' | 'down' | 'stable';

export interface ActiveProject {
  id: string;
  name: string;
  language: string;
  commits: number;
  contributors: number;
  trend: ActivityTrend;
}

export interface ActiveDeveloper {
  id: string;
  name: string;
  role: string;
  team: string;
  commits: number;
  reviews: number;
  trend: ActivityTrend;
}

export interface ActiveTeam {
  id: string;
  name: string;
  members: number;
  score: number;
  trend: ActivityTrend;
}

// ============ 项目 ============

export interface LargeTeam {
  id: string;
  name: string;
  description?: string;
}

export interface TeamSpace {
  id: string;
  name: string;
  largeTeamId: string;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  memberIds: string[];
  projectIds: string[];
}

export interface TeamGroup {
  id: string;
  teamId: string;
  name: string;
  leadId?: string;
  leadName?: string;
  memberIds: string[];
  projectIds: string[];
}

export interface Project {
  id: string;
  name: string;
  group: string;
  teamId: string;
  language: string;
  score: number; // 综合健康度
  quality: number;
  security: number;
  debt: number;
  status: ProjectStatus;
  commits: number;
  contributors: number;
  lastAnalyzed: string;
}

// ============ 开发者 ============

export interface Developer {
  id: string;
  name: string;
  username: string;
  role: string;
  roleType: Role; // 开发角色 key
  team: string;
  teamId: string;
  groupId?: string;
  level: Level; // D1-G3 公司能力职级
  overall: number; // 综合评分
  commits: number;
  reviews: number;
  langs: string[];
  tags: string[];
}

// ============ 团队 ============

export interface TeamCapabilityVector {
  code_quality: number;
  architecture: number;
  stability: number;
  efficiency: number;
  collaboration: number;
  security_aware: number;
  test_coverage: number;
}

export interface Team {
  id: string;
  name: string;
  members: number;
  avgScore: number;
  busFactor: number;
  riskCount: number;
  capability: TeamCapabilityVector;
}

export interface CapabilityGap {
  capability: string;
  current: number;
  target: number;
  owner: string;
  action: string;
}

// ============ 接入与仓库来源 ============

export type RepositorySourceType = 'remote' | 'local';
export type RepositoryProvider = 'github' | 'gitlab' | 'gitea' | 'bitbucket' | 'generic';

export interface Repository {
  id: string;
  name: string;
  path: string;
  sourceType: RepositorySourceType;
  provider?: RepositoryProvider;
  remoteUrl?: string;
  branch: string;
  teamId: string;
  projectId?: string;
  status: 'synced' | 'syncing' | 'failed';
  lastSync: string;
  commits: number;
  contributors: number;
}

export interface ProjectCreateRequest {
  name: string;
  repoType: RepositorySourceType;
  repoUrl?: string;
  repoPath?: string;
  provider?: RepositoryProvider;
  branch: string;
  teamId: string;
  accessToken?: string;
  skillGroupId?: string; // 可选：本次分析绑定的 Skill Group
}

export interface RepositoryImportResult {
  projectId: string;
  runId: string;
  sourceType: RepositorySourceType;
  provider?: RepositoryProvider;
  repository: string;
  branch: string;
  status: 'queued' | 'cloning' | 'analyzing' | 'completed' | 'failed';
  error?: string;
}

export interface AnalysisRun {
  id: string;
  projectId: string;
  status: RepositoryImportResult['status'];
  progress: number;
  stage: string;
  message: string;
  updatedAt: string;
}

export interface IdentityMatch {
  gitName: string;
  gitEmail: string;
  personName: string;
  department: string;
  confidence: number; // 0-1
  method: 'email' | 'employee_id' | 'pinyin' | 'fuzzy';
}

// ============ 开发者详情（/developers/[id]）============

/** 8 维成长型能力模型（随角色使用不同维度集） */
export interface DeveloperCapabilityVector extends TeamCapabilityVector {
  [key: string]: number;
  growth_velocity: number;
}

export interface GrowthCurvePoint {
  period: string; // 如 "2025 Q1"
  composite: number; // 综合分
  teamAvg: number; // 团队均值
}

export interface BehaviorEvidence {
  label: string;
  value: number;
  unit: string;
  benchmark: number; // 组织均值
  description: string;
}

export interface CollaborationPartner {
  name: string;
  username: string;
  sharedCommits: number;
  reviewCount: number;
}

export interface ModuleContribution {
  module: string;
  commits: number;
  ownership: number; // 0-100，归属占比
  complexity: number; // 0-100
  projectId?: string;
  projectName?: string;
}

export interface DeveloperProjectContribution {
  projectId: string;
  projectName: string;
  projectScore: number;
  projectStatus: ProjectStatus | string;
  role: string;
  commits: number;
  reviews: number;
  ownership: number;
  moduleCount: number;
  lastActiveAt: string;
}

export interface DeveloperDetail extends Developer {
  capability: DeveloperCapabilityVector;
  teamCapabilityAvg: TeamCapabilityVector;
  roleStandard?: Record<string, number>; // 该角色+级别对应的标准阈值（运行时注入）
  growthCurve: GrowthCurvePoint[];
  behaviorEvidence: BehaviorEvidence[];
  partners: CollaborationPartner[];
  modules: ModuleContribution[];
  /** 以项目贡献事实为来源，展示开发者参与的全部项目。 */
  projects?: DeveloperProjectContribution[];
  aiSuggestion: string;
}

// ============ 项目详情（/projects/[id]）============

export interface ProjectDimension {
  label: string;
  score: number;
  benchmark: number;
  trend: 'up' | 'down' | 'stable';
  description: string;
}

export type ReviewCategory =
  | 'quality'
  | 'security'
  | 'performance'
  | 'maintainability'
  | 'architecture'
  | 'reliability'
  | 'logic'
  | 'complexity'
  | 'configuration'
  | 'dependency'
  | 'testing'
  | 'delivery';

export type InsightStatus =
  | 'open'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'accepted_risk'
  | 'false_positive';

export interface AIReviewInsight {
  id: string;
  title: string;
  module: string;
  type: ReviewCategory;
  category: ReviewCategory;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  level: 'critical' | 'warning' | 'info';
  riskScore: number;
  confidence: number;
  status: InsightStatus;
  filePath: string;
  symbol?: string;
  startLine?: number;
  endLine?: number;
  source: string;
  firstSeenAt: string;
  lastSeenAt: string;
  assignee?: string;
  evidence: string;
  codeExcerpt?: string;
  impact: string;
  action: string;
  verification: string;
}

export interface ReviewCategoryCount {
  category: ReviewCategory;
  count: number;
}

export interface ModuleRisk {
  id: string;
  name: string;
  path: string;
  score: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  criticalCount: number;
  issueCount: number;
  complexity: number;
  debtLoad: number;
  owner?: string;
  backupOwner?: string;
  ownership: number;
  lastChanged: string;
  categories: ReviewCategoryCount[];
}

export interface ProjectReviewSummary {
  total: number;
  critical: number;
  open: number;
  newSinceLastScan: number;
  inProgress: number;
  resolved: number;
}

export interface ProjectAnalysisMeta {
  branch: string;
  commit: string;
  analysisVersion: string;
  scannedAt: string;
  coverage: number;
  filesScanned: number;
  confidence: number;
}

export interface ContributorRanking {
  name: string;
  username: string;
  commits: number;
  reviews: number;
  ownership: number;
}

export interface DebtTrendPoint {
  month: string;
  debt: number;
  complexity: number;
}

export interface FixPriority {
  id: string;
  insightId?: string;
  module: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  debt: number;
  effort: string;
  impact: string;
  expectedGain: number;
  status: InsightStatus;
  assignee?: string;
  dueDate?: string;
}

export interface ProjectDetail extends Project {
  dimensions: ProjectDimension[];
  aiInsights: AIReviewInsight[];
  contributorList: ContributorRanking[];
  debtTrend: DebtTrendPoint[];
  fixPriorities: FixPriority[];
  moduleRisks: ModuleRisk[];
  reviewSummary: ProjectReviewSummary;
  analysisMeta: ProjectAnalysisMeta;
}

// ============ 项目代码图谱与架构设计方案 ============

export interface ProjectGraphNode {
  id: string;
  label: string;
  layer: 'edge' | 'service' | 'data' | 'infra' | string;
  x: number;
  y: number;
  loc: string;
  health: number;
  path: string;
  issueCount: number;
}

export interface ProjectGraphEdge {
  source: string;
  target: string;
}

export interface ProjectCodeGraph {
  projectId: string;
  projectName: string;
  branch: string;
  commit: string;
  generatedAt: string;
  nodes: ProjectGraphNode[];
  edges: ProjectGraphEdge[];
  stats: {
    moduleCount: number;
    edgeCount: number;
    avgHealth: number;
    riskModuleCount: number;
  };
}

export interface ArchitectureLayer {
  key: 'edge' | 'service' | 'data' | 'infra' | string;
  label: string;
  description: string;
  color: string;
  componentCount: number;
  components: string[];
}

export interface ArchitectureComponent {
  id: string;
  name: string;
  layer: 'edge' | 'service' | 'data' | 'infra' | string;
  layerLabel: string;
  description: string;
  health: number;
  issueCount: number;
}

export interface ArchitectureDecision {
  title: string;
  value: string;
  evidence: string;
}

export interface ArchitectureRisk {
  name: string;
  path: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  score: number;
  issueCount: number;
  owner: string;
}

export interface ArchitectureDesign {
  projectId: string;
  projectName: string;
  language: string;
  analysisStatus: 'ready' | 'pending' | string;
  branch: string;
  commit: string;
  generatedAt: string;
  overview: string;
  principles: string[];
  layers: ArchitectureLayer[];
  components: ArchitectureComponent[];
  relations: ProjectGraphEdge[];
  decisions: ArchitectureDecision[];
  risks: ArchitectureRisk[];
}

export interface ArchitectureDesignListResponse {
  designs: ArchitectureDesign[];
  generatedAt: string;
}

// ============ Skill 管理模块 ============

/** 规则分类（与后端 REVIEW_CATEGORIES 对齐） */
export type SkillCategory = ReviewCategory;

/** 规则严重级 */
export type SkillSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** 检查类型 */
export type SkillCheckType = 'llm' | 'static';

/** 分析编组类型 */
export type SkillGroupAnalysisType = 'repo_analysis' | 'developer_review' | 'team_aggregation';

/** 合规/违规示例（few-shot） */
export interface SkillExample {
  desc: string;
  code: string;
}

/** 规范来源：导入的编码规范文档 */
export interface SkillSource {
  id: string;
  name: string;
  docType: 'markdown' | 'text' | 'pdf';
  content: string;
  sourceLang: string; // java|frontend|go|python|all
  description: string;
  status: 'imported' | 'extracted' | 'failed';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** 规则条目：一条可执行的评估规则 */
export interface Skill {
  id: string;
  sourceId?: string;
  name: string;
  description: string;
  category: SkillCategory;
  severity: SkillSeverity;
  checkType: SkillCheckType;
  ruleContent: string;
  positiveExamples: SkillExample[];
  negativeExamples: SkillExample[];
  enabled: number; // 0|1
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** 评估编组 */
export interface SkillGroup {
  id: string;
  name: string;
  description: string;
  skillIds: string[];
  analysisType: SkillGroupAnalysisType;
  enabled: number; // 0|1
  createdAt: string;
  updatedAt: string;
}

/** 编组预览（组 + 规则明细） */
export interface SkillGroupPreview extends SkillGroup {
  skills: Skill[];
}

/** 评估运行记录：哪次分析用了哪个组 + 规则快照 */
export interface SkillGroupRun {
  id: string;
  runId?: string;
  projectId?: string;
  groupId: string;
  groupSnapshot: {
    groupName: string;
    skillIds: string[];
    rules: { id: string; name: string; category: SkillCategory; severity: SkillSeverity; ruleContent: string }[];
  };
  trigger: 'manual' | 'auto';
  createdAt: string;
}

/** AI 抽取结果 */
export interface ExtractResult {
  sourceId: string;
  status: 'imported' | 'extracted' | 'failed';
  extracted: number;
  message: string;
}

/** 创建规范来源请求 */
export interface SkillSourceCreateRequest {
  name: string;
  docType: 'markdown' | 'text' | 'pdf';
  content: string;
  sourceLang: string;
  description: string;
}

/** 创建规则请求 */
export interface SkillCreateRequest {
  name: string;
  description?: string;
  category: SkillCategory;
  severity: SkillSeverity;
  checkType: SkillCheckType;
  ruleContent: string;
  positiveExamples?: SkillExample[];
  negativeExamples?: SkillExample[];
  sourceId?: string;
  enabled?: number;
}

/** 创建编组请求 */
export interface SkillGroupCreateRequest {
  name: string;
  description?: string;
  skillIds: string[];
  analysisType: SkillGroupAnalysisType;
  enabled?: number;
}

// ============ 项目环境配置盘点（Env Inventory）============

export type EnvName = 'dev' | 'test' | 'prod' | 'gray' | 'common';
export type EnvToolType =
  | 'database' | 'redis' | 'nacos' | 'mq' | 'kafka' | 'es'
  | 'oss' | 'gateway' | 'third_party' | 'other';
export type EnvEntryStatus = 'active' | 'added' | 'changed' | 'removed';

/** 配置条目：一条记录 = 一个配置项 */
export interface EnvInventoryEntry {
  id: string;
  projectId: string;
  scanId?: string;
  env: EnvName;
  toolType: EnvToolType;
  toolName: string;
  key: string;
  value: string;
  isSecret: number; // 0|1
  /** 连接地址结构化字段；常规配置项可能为空。 */
  host?: string;
  port?: string;
  username?: string;
  database?: string;
  fingerprint?: string;
  detail?: Record<string, unknown>;
  sourceFile: string;
  sourceLine: number;
  fileMtime?: string;
  firstSeenAt?: string;
  updatedAt: string;
  status: EnvEntryStatus;
  previousValue?: string;
}

/** 扫描记录 */
export interface EnvInventoryScan {
  id: string;
  projectId: string;
  scanType: 'full' | 'incremental';
  status: 'scanning' | 'completed' | 'failed';
  trigger: string;
  startedAt: string;
  finishedAt?: string;
  filesScanned: number;
  entriesFound: number;
  added: number;
  changed: number;
  removed: number;
  unchanged: number;
  message?: string;
  /** 本次扫描冻结的生效规则，确保范围与 AI 指令可追溯。 */
  skillIds?: string[];
  skillSnapshot?: Record<string, unknown>;
}

/** 概览：各环境×工具统计 + 最近扫描 */
export interface EnvInventorySummary {
  projectId: string;
  total: number;
  byEnv: Record<EnvName, number>;
  byToolType: Record<EnvToolType, number>;
  lastScanAt?: string;
  lastScanType?: 'full' | 'incremental';
}

/** 环境盘点 Skill：扫描范围与 AI 提取边界均作为可编辑规则资产。 */
export interface EnvInventorySkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  filePatterns: string[];
  keywords: string[];
  toolTypes: EnvToolType[];
  aiInstruction: string;
  enabled: number;
  builtIn: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

export interface EnvInventorySkillPayload {
  name: string;
  description: string;
  filePatterns: string[];
  keywords: string[];
  toolTypes: EnvToolType[];
  aiInstruction: string;
  enabled: number;
}

// ============ 开发者能力实测评估 ============

export interface DeveloperEvaluationRuleEvidence {
  rule: string;
  hit: boolean;
  note: string;
}

export interface DeveloperEvaluationEvidence {
  dimension: string;
  summary: string;
  rules: DeveloperEvaluationRuleEvidence[];
}

export interface DeveloperEvaluationGap {
  dimension: string;
  current: number;
  target: number;
  gap: number;
}

/** 一次真实 git 作者代码贡献的能力实测结果。 */
export interface DeveloperEvaluation {
  id: string;
  developerId: string;
  roleKey: Role;
  skillGroupId?: string | null;
  repoPath: string;
  gitAuthor: string;
  scores: Record<string, number>;
  evidence: DeveloperEvaluationEvidence[];
  achievedLevel?: Level | null;
  bestLevel?: Level | null;
  gaps: DeveloperEvaluationGap[];
  summary: string;
  status: 'running' | 'completed' | 'failed';
  error: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluateDeveloperRequest {
  repoPath: string;
  gitAuthor: string;
  roleKey?: Role;
  skillGroupId?: string | null;
}

export interface TriggerDeveloperEvaluationResponse {
  id: string;
  status: 'queued';
}

// ============ 可售化：项目组合 / 报告 / 多租户权限 ============

export interface ProjectAssessmentSnapshot {
  id: string;
  projectId: string;
  score: number;
  quality: number;
  security: number;
  debt: number;
  contributors: number;
  commits: number;
  recordedAt: string;
  source: string;
}

export interface ProjectComparisonItem {
  projectId: string;
  projectName: string;
  language: string;
  score: number;
  quality: number;
  security: number;
  debt: number;
  contributors: number;
  commits: number;
  lastAnalyzed: string;
  scoreDelta?: number | null;
}

export interface ProjectComparisonResponse {
  projects: ProjectComparisonItem[];
  generatedAt: string;
}

export interface ProjectTrendResponse {
  projectId: string;
  projectName: string;
  snapshots: ProjectAssessmentSnapshot[];
}

export type TenantRole = 'owner' | 'admin' | 'evaluator' | 'analyst' | 'viewer';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface AccountUser {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface TenantMembership {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantRole;
  createdAt: string;
  updatedAt: string;
  user?: AccountUser;
}

export interface CurrentTenantContext {
  tenant: Tenant;
  user: AccountUser;
  role: TenantRole;
  permissions: string[];
}
