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

export interface ProjectCreateRequest {
  name: string;
  repoType: RepositorySourceType;
  repoUrl?: string;
  repoPath?: string;
  provider?: RepositoryProvider;
  branch: string;
  teamId: string;
  accessToken?: string;
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
}

export interface DeveloperDetail extends Developer {
  capability: DeveloperCapabilityVector;
  teamCapabilityAvg: TeamCapabilityVector;
  roleStandard?: Record<string, number>; // 该角色+级别对应的标准阈值（运行时注入）
  growthCurve: GrowthCurvePoint[];
  behaviorEvidence: BehaviorEvidence[];
  partners: CollaborationPartner[];
  modules: ModuleContribution[];
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
