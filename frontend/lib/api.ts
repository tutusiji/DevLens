/**
 * DevLens API 客户端
 * 配置 NEXT_PUBLIC_API_URL 后走真实后端(FastAPI)，未配置则用 mock
 */
import {
  overviewStats, trinityMatrix, healthTrend, riskAlerts, dataSources,
  projects, developers, teams, capabilityGaps, identityMatches,
  getDeveloperDetail, getProjectDetail, teamSpaces, teamGroups,
  activeProjects, activeDevelopers, activeTeams, repoList, largeTeams,
  modelProviders, taskRoutes, vectorCollections, embeddingModels,
  roleConfigs, roleStandards, DIMENSION_LABELS, ALL_LEVELS,
} from './mock-data';

import type {
  AnalysisRun, ProjectCreateRequest, ProjectDetail, RepositoryImportResult,
  TeamGroup, TeamSpace, Project, Developer, Team, DeveloperDetail,
  StatItem, TrinityMatrix, HealthTrendPoint, RiskAlert, DataSource,
  ActiveProject, ActiveDeveloper, ActiveTeam, CapabilityGap, IdentityMatch, Repository, LargeTeam,
  SkillSource, Skill, SkillGroup, SkillGroupPreview, ExtractResult,
  SkillSourceCreateRequest, SkillCreateRequest, SkillGroupCreateRequest,
  EnvInventoryEntry, EnvInventoryScan, EnvInventorySummary, EnvName, EnvToolType,
  CapabilityMeta, CapabilityRoleInfo, CapabilitySaveRequest, Role,
  DeveloperEvaluation, EvaluateDeveloperRequest, TriggerDeveloperEvaluationResponse,
  ProjectComparisonResponse, ProjectTrendResponse, CurrentTenantContext, TenantMembership,
  TenantRole,
  ProjectCodeGraph, ArchitectureDesign, ArchitectureDesignListResponse,
} from './types';
import { LEVEL_GROUPS } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const USE_MOCK = !process.env.NEXT_PUBLIC_API_URL;

/** 真实 fetch 封装 */
async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const tenantHeaders = typeof window === 'undefined' ? {} : {
    ...(localStorage.getItem('devlens-user-id') ? { 'X-DevLens-User-Id': localStorage.getItem('devlens-user-id')! } : {}),
    ...(localStorage.getItem('devlens-tenant-id') ? { 'X-DevLens-Tenant-Id': localStorage.getItem('devlens-tenant-id')! } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...tenantHeaders, ...init?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

async function downloadAPI(path: string): Promise<{ blob: Blob; filename: string }> {
  const tenantHeaders = typeof window === 'undefined' ? {} : {
    ...(localStorage.getItem('devlens-user-id') ? { 'X-DevLens-User-Id': localStorage.getItem('devlens-user-id')! } : {}),
    ...(localStorage.getItem('devlens-tenant-id') ? { 'X-DevLens-Tenant-Id': localStorage.getItem('devlens-tenant-id')! } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { headers: tenantHeaders });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  const disposition = res.headers.get('content-disposition') || '';
  const filename = disposition.match(/filename="?([^"]+)"?/)?.[1] || 'devlens-report';
  return { blob: await res.blob(), filename };
}

/** mock 延迟模拟网络（让 skeleton 态可见） */
function mockDelay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

const mockRunStartedAt = new Map<string, number>();

// ============ 能力标准管理 mock 数据（复用现有 roleConfigs / roleStandards）============
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function buildCapabilityMeta(): CapabilityMeta {
  return {
    dimensionLabels: { ...DIMENSION_LABELS },
    allLevels: [...ALL_LEVELS],
    levelGroups: LEVEL_GROUPS.map((group) => ({ ...group })),
    defaultDimensions: Object.fromEntries(
      roleConfigs.map((role) => [role.key, [...role.dimensions]]),
    ),
  };
}

function buildCapabilityRoles(): CapabilityRoleInfo[] {
  const defaultSkillGroups: Partial<Record<Role, string>> = {
    frontend: 'skg-seed-fe',
    backend: 'skg-seed-java',
  };
  return roleConfigs.map((role) => ({
    roleKey: role.key,
    roleName: role.name,
    dimensions: [...role.dimensions],
    skillGroupId: defaultSkillGroups[role.key] ?? null,
    standards: clone(roleStandards[role.key]),
  }));
}

function mockProjectGraph(projectId: string): ProjectCodeGraph {
  const detail = getProjectDetail(projectId);
  const modules = detail?.moduleRisks || [];
  const nodes = modules.map((module, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, modules.length);
    const path = module.path || module.name;
    return {
      id: path,
      label: module.name,
      layer: /api|route|controller|page/i.test(path) ? 'edge' : /repo|model|dao|entity|db/i.test(path) ? 'data' : 'service',
      x: Math.round(50 + 34 * Math.cos(angle)),
      y: Math.round(50 + 34 * Math.sin(angle)),
      loc: `${module.issueCount} 项问题`,
      health: Math.max(0, 100 - module.score),
      path,
      issueCount: module.issueCount,
    };
  });
  return {
    projectId,
    projectName: detail?.name || '未知项目',
    branch: detail?.analysisMeta?.branch || 'main',
    commit: detail?.analysisMeta?.commit || '',
    generatedAt: detail?.analysisMeta?.scannedAt || new Date().toISOString(),
    nodes,
    edges: nodes.slice(1).map((node, index) => ({ source: nodes[index].id, target: node.id })),
    stats: {
      moduleCount: nodes.length,
      edgeCount: Math.max(0, nodes.length - 1),
      avgHealth: nodes.length ? Math.round(nodes.reduce((sum, node) => sum + node.health, 0) / nodes.length) : 0,
      riskModuleCount: nodes.filter((node) => node.issueCount > 0).length,
    },
  };
}

function mockArchitectureDesign(projectId: string): ArchitectureDesign {
  const graph = mockProjectGraph(projectId);
  const detail = getProjectDetail(projectId);
  const components = graph.nodes.map((node) => ({
    id: node.id, name: node.label, layer: node.layer, layerLabel: node.layer === 'edge' ? '接入层' : node.layer === 'data' ? '数据与集成层' : '业务服务层',
    description: node.path, health: node.health, issueCount: node.issueCount,
  }));
  const layers = ['edge', 'service', 'data', 'infra'].map((key) => {
    const matched = components.filter((component) => component.layer === key);
    const labels: Record<string, [string, string, string]> = {
      edge: ['接入层', 'HTTP、页面、路由与外部入口', '#5B8FF9'],
      service: ['业务服务层', '领域逻辑、编排与应用服务', '#7CB305'],
      data: ['数据与集成层', '数据访问、缓存、消息与外部集成', '#F6BD16'],
      infra: ['基础设施层', '部署、配置、运行与平台能力', '#7262FD'],
    };
    return { key, label: labels[key][0], description: labels[key][1], color: labels[key][2], componentCount: matched.length, components: matched.slice(0, 6).map((component) => component.name) };
  }).filter((layer) => layer.componentCount > 0);
  return {
    projectId, projectName: graph.projectName, language: detail?.language || '', analysisStatus: graph.nodes.length ? 'ready' : 'pending', branch: graph.branch, commit: graph.commit, generatedAt: graph.generatedAt,
    overview: `${graph.projectName} 的项目级架构方案由代码模块、依赖关系、技术资产与风险模块自动提取。`,
    principles: ['按接入、业务服务、数据集成、基础设施分层展示。', '架构结论与当前项目分析快照关联。', '风险模块用于识别架构治理优先级。'],
    layers, components, relations: graph.edges,
    decisions: [
      { title: '应用技术基座', value: detail?.language || '待识别', evidence: '来自项目语言和依赖扫描' },
      { title: '模块依赖治理', value: `${graph.stats.edgeCount} 条模块关系`, evidence: '来自项目级 import 解析' },
      { title: '风险治理范围', value: `${graph.stats.riskModuleCount} 个风险模块`, evidence: '来自 AI Review 与模块风险分析' },
    ],
    risks: (detail?.moduleRisks || []).filter((module) => module.severity === 'critical' || module.severity === 'high').slice(0, 5).map((module) => ({
      name: module.name, path: module.path, severity: module.severity, score: module.score, issueCount: module.issueCount, owner: module.owner || '未分配',
    })),
  };
}

let mockCapabilityRoles = buildCapabilityRoles();

// ============ 多租户 / RBAC mock ============
const mockTenantContext: CurrentTenantContext = {
  tenant: {
    id: 'tenant-default', name: 'DevLens 演示工作区', slug: 'demo',
    status: 'active', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
  },
  user: {
    id: 'usr-local-admin', email: 'admin@devlens.demo', name: '演示管理员',
    status: 'active', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
  },
  role: 'owner',
  permissions: ['*'],
};
let mockTenantMembers: TenantMembership[] = [
  {
    id: 'tmem-local-owner', tenantId: 'tenant-default', userId: 'usr-local-admin', role: 'owner',
    createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
    user: mockTenantContext.user,
  },
  {
    id: 'tmem-demo-analyst', tenantId: 'tenant-default', userId: 'usr-demo-analyst', role: 'analyst',
    createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
    user: {
      id: 'usr-demo-analyst', email: 'analyst@devlens.demo', name: '评估分析师',
      status: 'active', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
    },
  },
];

// ============ Skill 管理模块 mock 数据（可变，支持全链路 mock）============
const mockSkillSources: SkillSource[] = [
  {
    id: 'sk-src-java', name: '示例-Java编码规范', docType: 'markdown', sourceLang: 'java',
    description: 'Java 后端服务编码规范示例（安全/事务/SQL/日志）', status: 'extracted',
    content: '# Java 编码规范\n## 安全\n- 禁止硬编码密钥\n- SQL 必须参数化查询\n## 事务\n- 写操作必须显式提交/回滚',
    createdBy: '', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'sk-src-fe', name: '示例-前端编码规范', docType: 'markdown', sourceLang: 'frontend',
    description: '前端工程编码规范示例（调试/样式/接口）', status: 'extracted',
    content: '# 前端编码规范\n## 调试\n- 禁止 console.log 提交\n## 样式\n- 禁止内联硬编码颜色',
    createdBy: '', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
  },
];

const mockSkills: Skill[] = [
  { id: 'sk-seed-1', sourceId: 'sk-src-java', name: '禁止硬编码密钥', description: '源码中不得出现明文密钥、口令、Token', category: 'security', severity: 'critical', checkType: 'llm', ruleContent: '检查代码中是否存在硬编码的密钥、口令、Token 等敏感凭证。此类凭证必须从配置中心或环境变量读取，禁止以明文形式出现在源码中。', positiveExamples: [{ desc: '从环境变量读取', code: 'String apiKey = System.getenv("API_KEY");' }], negativeExamples: [{ desc: '硬编码密钥', code: 'String apiKey = "sk-abc123";' }], enabled: 1, createdBy: '', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'sk-seed-2', sourceId: 'sk-src-java', name: 'SQL 禁止字符串拼接', description: 'SQL 必须参数化查询', category: 'security', severity: 'high', checkType: 'llm', ruleContent: '检查 SQL 查询是否使用参数化查询（PreparedStatement / 占位符）。禁止通过字符串拼接构造 SQL，以防止 SQL 注入风险。', positiveExamples: [{ desc: '参数化查询', code: 'ps.setString(1, id);' }], negativeExamples: [{ desc: '字符串拼接', code: 'String sql = "... id = " + id;' }], enabled: 1, createdBy: '', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'sk-seed-3', sourceId: 'sk-src-java', name: '事务必须显式提交/回滚', description: '写操作禁止依赖自动提交', category: 'reliability', severity: 'high', checkType: 'llm', ruleContent: '检查数据库写操作是否在显式事务中，且明确调用 commit 或 rollback。禁止依赖数据库自动提交，异常时必须回滚以保证数据一致性。', positiveExamples: [], negativeExamples: [], enabled: 1, createdBy: '', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'sk-seed-4', sourceId: 'sk-src-java', name: '循环复杂度≤10', description: '单方法圈复杂度上限', category: 'complexity', severity: 'medium', checkType: 'llm', ruleContent: '检查单个方法的圈复杂度（分支、循环、条件嵌套）是否超过 10。超过阈值的方法应拆分为多个职责单一的小方法。', positiveExamples: [], negativeExamples: [], enabled: 1, createdBy: '', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'sk-seed-5', sourceId: 'sk-src-java', name: '日志必须包含上下文', description: '禁止裸打印变量', category: 'maintainability', severity: 'medium', checkType: 'llm', ruleContent: '检查日志输出是否包含上下文信息（traceId、业务主键等）。禁止仅打印裸变量，异常日志必须打印完整堆栈。', positiveExamples: [], negativeExamples: [], enabled: 1, createdBy: '', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'sk-seed-6', sourceId: 'sk-src-fe', name: '禁止 console.log 提交', description: '调试代码不得入主分支', category: 'quality', severity: 'medium', checkType: 'llm', ruleContent: '检查代码中是否残留 console.log / debugger / 调试用的打印语句。此类调试代码禁止提交到主分支。', positiveExamples: [], negativeExamples: [], enabled: 1, createdBy: '', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'sk-seed-7', sourceId: 'sk-src-fe', name: '禁止内联样式硬编码', description: '颜色间距走设计 token', category: 'maintainability', severity: 'low', checkType: 'llm', ruleContent: '检查组件是否使用内联样式硬编码颜色、间距、字号等视觉值。此类值必须引用设计 token。', positiveExamples: [], negativeExamples: [], enabled: 1, createdBy: '', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'sk-seed-8', sourceId: 'sk-src-fe', name: 'API 请求必须处理错误态', description: '禁止静默失败', category: 'reliability', severity: 'high', checkType: 'llm', ruleContent: '检查 API 请求是否处理了错误态（网络异常、业务错误码）。禁止请求失败时静默吞掉错误。', positiveExamples: [], negativeExamples: [], enabled: 1, createdBy: '', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
];

const mockSkillGroups: SkillGroup[] = [
  { id: 'skg-seed-java', name: 'Java 后端规范组', description: 'Java 后端服务默认评估编组（安全/事务/SQL/日志）', skillIds: ['sk-seed-1', 'sk-seed-2', 'sk-seed-3', 'sk-seed-5'], analysisType: 'repo_analysis', enabled: 1, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'skg-seed-fe', name: '前端规范组', description: '前端工程默认评估编组（调试/样式/接口）', skillIds: ['sk-seed-6', 'sk-seed-7', 'sk-seed-8'], analysisType: 'repo_analysis', enabled: 1, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
];

let mockSkillSeq = 100;
const mockSkillId = () => `sk-mock-${++mockSkillSeq}`;
let mockGroupSeq = 100;
const mockGroupId = () => `skg-mock-${++mockGroupSeq}`;
let mockSourceSeq = 100;
const mockSourceId = () => `sk-src-mock-${++mockSourceSeq}`;

// ============ Env Inventory mock 数据（可变，支持全链路 mock）============
const mockEnvScans: EnvInventoryScan[] = [
  {
    id: 'einv-scan-seed-p1', projectId: 'p1', scanType: 'full', status: 'completed',
    trigger: 'auto', startedAt: '2026-08-01T07:58:00Z', finishedAt: '2026-08-01T08:00:00Z',
    filesScanned: 4, entriesFound: 5, added: 0, changed: 0, removed: 0, unchanged: 0,
    message: '首次全量扫描',
  },
];
const mockEnvEntries: EnvInventoryEntry[] = [
  { id: 'einv-seed-1', projectId: 'p1', scanId: 'einv-scan-seed-p1', env: 'prod', toolType: 'database', toolName: 'mysql', key: 'spring.datasource.url', value: 'jdbc:mysql://10.0.1.20:3306/user_center?useSSL=true', isSecret: 1, host: '10.0.1.20', port: '3306', username: 'uc_app', database: 'user_center', fingerprint: 'einv-mock-mysql-prod', sourceFile: 'src/main/resources/application-prod.yml', sourceLine: 12, fileMtime: '2026-08-01T08:00:00Z', firstSeenAt: '2026-08-01T08:00:00Z', updatedAt: '2026-08-01T08:00:00Z', status: 'active' },
  { id: 'einv-seed-4', projectId: 'p1', scanId: 'einv-scan-seed-p1', env: 'prod', toolType: 'redis', toolName: 'redis', key: 'spring.redis.host', value: '10.0.1.21:6379 · password=r***d(len=9)', isSecret: 1, host: '10.0.1.21', port: '6379', database: '0', fingerprint: 'einv-mock-redis-prod', sourceFile: 'src/main/resources/application-prod.yml', sourceLine: 22, updatedAt: '2026-08-01T08:00:00Z', status: 'active' },
  { id: 'einv-seed-7', projectId: 'p1', scanId: 'einv-scan-seed-p1', env: 'prod', toolType: 'nacos', toolName: 'nacos', key: 'spring.cloud.nacos.server-addr', value: 'nacos-prod:8848 · user=nacos', isSecret: 0, host: 'nacos-prod', port: '8848', username: 'nacos', fingerprint: 'einv-mock-nacos-prod', detail: { namespace: 'prod', group: 'DEFAULT_GROUP' }, sourceFile: 'src/main/resources/application-prod.yml', sourceLine: 31, updatedAt: '2026-08-01T08:00:00Z', status: 'active' },
  { id: 'einv-seed-8', projectId: 'p1', scanId: 'einv-scan-seed-p1', env: 'dev', toolType: 'database', toolName: 'mysql', key: 'spring.datasource.url', value: 'jdbc:mysql://127.0.0.1:3306/user_center_dev?useSSL=false', isSecret: 1, host: '127.0.0.1', port: '3306', username: 'dev_app', database: 'user_center_dev', fingerprint: 'einv-mock-mysql-dev', sourceFile: 'src/main/resources/application-dev.yml', sourceLine: 12, updatedAt: '2026-08-01T08:00:00Z', status: 'active' },
  { id: 'einv-seed-10', projectId: 'p1', scanId: 'einv-scan-seed-p1', env: 'dev', toolType: 'redis', toolName: 'redis', key: 'spring.redis.host', value: '127.0.0.1:6379', isSecret: 0, host: '127.0.0.1', port: '6379', database: '0', fingerprint: 'einv-mock-redis-dev', sourceFile: 'src/main/resources/application-dev.yml', sourceLine: 22, updatedAt: '2026-08-01T08:00:00Z', status: 'active' },
];
let mockEnvScanSeq = 100;
const mockEnvScanId = () => `einv-scan-mock-${++mockEnvScanSeq}`;
function buildEnvSummary(entries: EnvInventoryEntry[], scans: EnvInventoryScan[]): EnvInventorySummary {
  const active = entries.filter((e) => e.status !== 'removed');
  const byEnv = { dev: 0, test: 0, prod: 0, gray: 0, common: 0 } as Record<EnvName, number>;
  const byToolType = { database: 0, redis: 0, nacos: 0, mq: 0, kafka: 0, es: 0, oss: 0, gateway: 0, third_party: 0, other: 0 } as Record<EnvToolType, number>;
  active.forEach((e) => { byEnv[e.env] = (byEnv[e.env] || 0) + 1; byToolType[e.toolType] = (byToolType[e.toolType] || 0) + 1; });
  const last = scans.filter((s) => s.status === 'completed').sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  return { projectId: 'p1', total: active.length, byEnv, byToolType, lastScanAt: last?.finishedAt || last?.startedAt, lastScanType: last?.scanType };
}

export const api = {
  // 首页
  getOverview: () => (USE_MOCK ? mockDelay(overviewStats) : fetchAPI<StatItem[]>('/overview')),
  getTrinityMatrix: () => (USE_MOCK ? mockDelay(trinityMatrix) : fetchAPI<TrinityMatrix>('/trinity-matrix')),
  getHealthTrend: () => (USE_MOCK ? mockDelay(healthTrend) : fetchAPI<HealthTrendPoint[]>('/health-trend')),
  getRiskAlerts: () => (USE_MOCK ? mockDelay(riskAlerts) : fetchAPI<RiskAlert[]>('/risk-alerts')),
  getDataSources: () => (USE_MOCK ? mockDelay(dataSources) : fetchAPI<DataSource[]>('/data-sources')),
  getActiveProjects: () => (USE_MOCK ? mockDelay(activeProjects) : fetchAPI<ActiveProject[]>('/active-projects')),
  getActiveDevelopers: () => (USE_MOCK ? mockDelay(activeDevelopers) : fetchAPI<ActiveDeveloper[]>('/active-developers')),
  getActiveTeams: () => (USE_MOCK ? mockDelay(activeTeams) : fetchAPI<ActiveTeam[]>('/active-teams')),

  // 项目与仓库导入
  getProjects: () => (USE_MOCK ? mockDelay(projects) : fetchAPI<Project[]>('/projects')),
  getProjectDetail: (id: string) =>
    USE_MOCK ? mockDelay(getProjectDetail(id)) : fetchAPI<ProjectDetail>(`/projects/${id}`),
  createProject: (body: ProjectCreateRequest): Promise<RepositoryImportResult> => {
    const repository = body.repoType === 'remote' ? body.repoUrl || '' : body.repoPath || '';
    const runId = `run-${Date.now()}`;
    mockRunStartedAt.set(runId, Date.now());
    return USE_MOCK
      ? mockDelay({ projectId: 'p-new', runId, sourceType: body.repoType, provider: body.provider, repository, branch: body.branch, status: 'queued' as const })
      : fetchAPI<RepositoryImportResult>('/projects', { method: 'POST', body: JSON.stringify(body) });
  },
  getAnalysisStatus: (runId: string): Promise<AnalysisRun> => {
    if (!USE_MOCK) return fetchAPI<AnalysisRun>(`/analysis-runs/${runId}`);
    const elapsed = Date.now() - (mockRunStartedAt.get(runId) || Date.now());
    const progress = Math.min(100, Math.floor(elapsed / 500));
    const completed = progress >= 100;
    return mockDelay({
      id: runId,
      projectId: 'p-new',
      status: completed ? 'completed' : 'analyzing',
      progress,
      stage: completed ? 'report' : progress < 40 ? 'git_collect' : progress < 75 ? 'code_parse' : 'project_snapshot',
      message: completed ? '导入与初始分析完成' : '分析 Worker 正在处理仓库',
      updatedAt: new Date().toISOString(),
    });
  },

  // 团队空间
  getTeamSpaces: () => (USE_MOCK ? mockDelay(teamSpaces) : fetchAPI<TeamSpace[]>('/team-spaces')),
  getTeamGroups: (teamId?: string) =>
    USE_MOCK ? mockDelay(teamId ? teamGroups.filter((g) => g.teamId === teamId) : teamGroups) : fetchAPI<TeamGroup[]>(teamId ? `/team-groups?team_id=${teamId}` : '/team-groups'),
  getLargeTeams: () => (USE_MOCK ? mockDelay(largeTeams) : fetchAPI<LargeTeam[]>('/large-teams')),
  createTeamSpace: (body: Pick<TeamSpace, 'name' | 'description' | 'ownerId' | 'ownerName'>) =>
    USE_MOCK
      ? mockDelay({ id: `team-${Date.now()}`, status: 'active' as const, createdAt: '刚刚', updatedAt: '刚刚', largeTeamId: '', memberIds: body.ownerId ? [body.ownerId] : [], projectIds: [], ...body } as TeamSpace)
      : fetchAPI<TeamSpace>('/team-spaces', { method: 'POST', body: JSON.stringify(body) }),
  createTeamGroup: (body: Omit<TeamGroup, 'id' | 'memberIds' | 'projectIds'>) =>
    USE_MOCK
      ? mockDelay({ id: `group-${Date.now()}`, memberIds: [], projectIds: [], ...body } as TeamGroup)
      : fetchAPI<TeamGroup>('/team-groups', { method: 'POST', body: JSON.stringify(body) }),

  // 开发者
  getDevelopers: () => (USE_MOCK ? mockDelay(developers) : fetchAPI<Developer[]>('/developers')),
  getDeveloperDetail: (id: string) =>
    USE_MOCK ? mockDelay(getDeveloperDetail(id)) : fetchAPI<DeveloperDetail>(`/developers/${id}`),
  triggerDeveloperEvaluation: (
    developerId: string,
    body: EvaluateDeveloperRequest,
  ): Promise<TriggerDeveloperEvaluationResponse> =>
    USE_MOCK
      ? mockDelay({ id: 'deval-mock', status: 'queued' })
      : fetchAPI<TriggerDeveloperEvaluationResponse>(`/developers/${developerId}/evaluations`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  getDeveloperEvaluations: (developerId: string): Promise<DeveloperEvaluation[]> =>
    USE_MOCK
      ? mockDelay([])
      : fetchAPI<DeveloperEvaluation[]>(`/developers/${developerId}/evaluations`),
  getLatestDeveloperEvaluation: (developerId: string): Promise<DeveloperEvaluation | null> =>
    USE_MOCK
      ? mockDelay(null)
      : fetchAPI<DeveloperEvaluation | null>(`/developers/${developerId}/evaluations/latest`),
  getGitAuthors: (repoPath: string): Promise<string[]> =>
    USE_MOCK
      ? mockDelay(['Tutuhuang'])
      : fetchAPI<string[]>(`/git-authors?repo_path=${encodeURIComponent(repoPath)}`),

  // 项目组合与趋势（评分历史来自持久化 snapshot）
  getProjectComparison: (projectIds: string[] = []): Promise<ProjectComparisonResponse> =>
    USE_MOCK
      ? mockDelay({
        projects: projects.map((project) => ({
          projectId: project.id, projectName: project.name, language: project.language,
          score: project.score, quality: project.quality, security: project.security, debt: project.debt,
          contributors: project.contributors, commits: project.commits, lastAnalyzed: project.lastAnalyzed,
          scoreDelta: null,
        })), generatedAt: new Date().toISOString(),
      })
      : fetchAPI<ProjectComparisonResponse>(`/project-comparisons${projectIds.length ? `?project_ids=${encodeURIComponent(projectIds.join(','))}` : ''}`),
  getProjectTrend: (projectId: string): Promise<ProjectTrendResponse> => {
    if (!USE_MOCK) return fetchAPI<ProjectTrendResponse>(`/projects/${projectId}/trend`);
    const project = getProjectDetail(projectId);
    if (!project) return mockDelay({ projectId, projectName: '未知项目', snapshots: [] });
    return mockDelay({
      projectId, projectName: project.name,
      snapshots: (project.debtTrend || []).map((point, index) => ({
        id: `mock-snapshot-${index}`, projectId, score: Math.max(0, project.score - point.debt + 50),
        quality: project.quality, security: project.security,
        debt: point.debt, contributors: project.contributors,
        commits: project.commits, recordedAt: `${index + 1}`, source: 'legacy_baseline',
      })),
    });
  },
  downloadProjectComparisonReport: (projectIds: string[], format: 'html' | 'pdf') =>
    USE_MOCK
      ? mockDelay({
        blob: new Blob([`<html><body><h1>DevLens 项目组合评估报告</h1><p>演示导出 · 项目：${projectIds.join(', ') || '全部'}</p></body></html>`], { type: 'text/html' }),
        filename: `devlens-project-comparison.${format === 'pdf' ? 'html' : format}`,
      })
      : downloadAPI(`/reports/project-comparison?format=${format}&project_ids=${encodeURIComponent(projectIds.join(','))}`),
  downloadDeveloperEvaluationReport: (developerId: string, evaluationId: string, format: 'html' | 'pdf') =>
    USE_MOCK
      ? mockDelay({
        blob: new Blob([`<html><body><h1>DevLens 开发者能力评估报告</h1><p>${developerId} / ${evaluationId}</p></body></html>`], { type: 'text/html' }),
        filename: `devlens-evaluation-${evaluationId}.${format === 'pdf' ? 'html' : format}`,
      })
      : downloadAPI(`/developers/${developerId}/evaluations/${evaluationId}/report?format=${format}`),

  // 租户/RBAC：真实环境由网关注入身份头；本地可在设置页选择测试成员。
  getCurrentTenantContext: (): Promise<CurrentTenantContext> =>
    USE_MOCK ? mockDelay(clone(mockTenantContext)) : fetchAPI<CurrentTenantContext>('/auth/me'),
  getTenantMembers: (): Promise<TenantMembership[]> =>
    USE_MOCK ? mockDelay(clone(mockTenantMembers)) : fetchAPI<TenantMembership[]>('/tenants/current/members'),
  addTenantMember: (body: { email: string; name: string; role: TenantRole }): Promise<TenantMembership> =>
    USE_MOCK
      ? (() => {
        const now = new Date().toISOString();
        const userId = `usr-mock-${Date.now()}`;
        const membership: TenantMembership = {
          id: `tmem-mock-${Date.now()}`, tenantId: 'tenant-default', userId, role: body.role,
          createdAt: now, updatedAt: now,
          user: { id: userId, email: body.email, name: body.name || body.email, status: 'active', createdAt: now, updatedAt: now },
        };
        mockTenantMembers = [membership, ...mockTenantMembers];
        return mockDelay(clone(membership));
      })()
      : fetchAPI<TenantMembership>('/tenants/current/members', { method: 'POST', body: JSON.stringify(body) }),
  updateTenantMember: (membershipId: string, role: TenantRole): Promise<TenantMembership> =>
    USE_MOCK
      ? (() => {
        const membership = mockTenantMembers.find((item) => item.id === membershipId);
        if (!membership) return Promise.reject(new Error('成员不存在'));
        membership.role = role;
        membership.updatedAt = new Date().toISOString();
        return mockDelay(clone(membership));
      })()
      : fetchAPI<TenantMembership>(`/tenants/current/members/${membershipId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  removeTenantMember: (membershipId: string): Promise<{ ok: boolean; id: string }> =>
    USE_MOCK
      ? (() => {
        mockTenantMembers = mockTenantMembers.filter((item) => item.id !== membershipId);
        return mockDelay({ ok: true, id: membershipId });
      })()
      : fetchAPI<{ ok: boolean; id: string }>(`/tenants/current/members/${membershipId}`, { method: 'DELETE' }),

  // 团队
  getTeams: () => (USE_MOCK ? mockDelay(teams) : fetchAPI<Team[]>('/teams')),
  getCapabilityGaps: () => (USE_MOCK ? mockDelay(capabilityGaps) : fetchAPI<CapabilityGap[]>('/capability-gaps')),

  // 接入
  getIdentityMatches: () => (USE_MOCK ? mockDelay(identityMatches) : fetchAPI<IdentityMatch[]>('/identity-matches')),

  // 仓库
  getRepos: () => (USE_MOCK ? mockDelay(repoList) : fetchAPI<Repository[]>('/repos')),

  // 配置: LLM / 向量
  getModelProviders: () => (USE_MOCK ? mockDelay(modelProviders) : fetchAPI<any[]>('/model-providers')),
  getTaskRoutes: () => (USE_MOCK ? mockDelay(taskRoutes) : fetchAPI<any[]>('/task-routes')),
  getVectorCollections: () => (USE_MOCK ? mockDelay(vectorCollections) : fetchAPI<any[]>('/vector-collections')),
  getEmbeddingModels: () => (USE_MOCK ? mockDelay(embeddingModels) : fetchAPI<any[]>('/embedding-models')),
  // 图谱均必须绑定项目；不再提供跨项目混合的全局代码图谱。
  getProjectGraph: (projectId: string): Promise<ProjectCodeGraph> =>
    USE_MOCK ? mockDelay(mockProjectGraph(projectId)) : fetchAPI<ProjectCodeGraph>(`/projects/${projectId}/graph`),
  getProjectArchitectureDesign: (projectId: string): Promise<ArchitectureDesign> =>
    USE_MOCK ? mockDelay(mockArchitectureDesign(projectId)) : fetchAPI<ArchitectureDesign>(`/projects/${projectId}/architecture-design`),
  getArchitectureDesigns: (): Promise<ArchitectureDesignListResponse> =>
    USE_MOCK
      ? mockDelay({ designs: projects.map((project) => mockArchitectureDesign(project.id)), generatedAt: new Date().toISOString() })
      : fetchAPI<ArchitectureDesignListResponse>('/architecture-designs'),

  // 治理闭环：洞察 / 修复状态变更（支持 status + assignee 组合 PATCH）
  updateInsightStatus: (projectId: string, insightId: string, patch: { status?: string; assignee?: string }) =>
    USE_MOCK ? mockDelay({}) : fetchAPI<any>(`/projects/${projectId}/insights/${insightId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  updateFixStatus: (projectId: string, fixId: string, patch: { status?: string; assignee?: string }) =>
    USE_MOCK ? mockDelay({}) : fetchAPI<any>(`/projects/${projectId}/fixes/${fixId}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  // 技术资产 + 身份匹配
  getProjectAssets: (projectId: string) => (USE_MOCK ? mockDelay({ frameworks: [], dependencies: [], configs: [], deployments: [] }) : fetchAPI<any>(`/projects/${projectId}/assets`)),
  getProjectIdentityMatches: (projectId: string) => (USE_MOCK ? mockDelay(identityMatches) : fetchAPI<any>(`/projects/${projectId}/identity-matches`)),

  // ============ Skill 管理模块 ============
  getSkillSources: (): Promise<SkillSource[]> =>
    USE_MOCK ? mockDelay(mockSkillSources) : fetchAPI<SkillSource[]>('/skill-sources'),
  createSkillSource: (body: SkillSourceCreateRequest): Promise<SkillSource> => {
    if (!USE_MOCK) return fetchAPI<SkillSource>('/skill-sources', { method: 'POST', body: JSON.stringify(body) });
    const now = new Date().toISOString();
    const src: SkillSource = { id: mockSourceId(), status: 'imported', createdBy: '', createdAt: now, updatedAt: now, ...body };
    mockSkillSources.unshift(src);
    return mockDelay(src);
  },
  deleteSkillSource: (id: string): Promise<any> => {
    if (!USE_MOCK) return fetchAPI<any>(`/skill-sources/${id}`, { method: 'DELETE' });
    // 级联不删 skills，仅置 sourceId 为 null
    mockSkills.forEach((s) => { if (s.sourceId === id) s.sourceId = undefined; });
    const idx = mockSkillSources.findIndex((s) => s.id === id);
    if (idx >= 0) mockSkillSources.splice(idx, 1);
    return mockDelay({ ok: true, id });
  },
  extractSkills: (sourceId: string): Promise<ExtractResult> => {
    if (!USE_MOCK) return fetchAPI<ExtractResult>(`/skill-sources/${sourceId}/extract`, { method: 'POST' });
    // mock：模拟 LLM 抽取 3 条规则
    const src = mockSkillSources.find((s) => s.id === sourceId);
    if (!src) return mockDelay({ sourceId, status: 'failed' as const, extracted: 0, message: '来源不存在' });
    const now = new Date().toISOString();
    const lang = src.sourceLang || 'all';
    const drafts: Skill[] = [
      { id: mockSkillId(), sourceId, name: '禁止硬编码敏感凭证', category: 'security', severity: 'critical', checkType: 'llm', ruleContent: '检查代码中是否存在硬编码的密钥、口令、Token。', positiveExamples: [], negativeExamples: [], enabled: 1, description: '', createdBy: '', createdAt: now, updatedAt: now },
      { id: mockSkillId(), sourceId, name: `${lang} 异常必须捕获处理`, category: 'reliability', severity: 'high', checkType: 'llm', ruleContent: '检查异常是否被显式捕获并处理，禁止吞掉异常。', positiveExamples: [], negativeExamples: [], enabled: 1, description: '', createdBy: '', createdAt: now, updatedAt: now },
      { id: mockSkillId(), sourceId, name: '命名需符合规范', category: 'quality', severity: 'low', checkType: 'llm', ruleContent: '检查类、方法、变量命名是否符合语言命名规范。', positiveExamples: [], negativeExamples: [], enabled: 1, description: '', createdBy: '', createdAt: now, updatedAt: now },
    ];
    mockSkills.unshift(...drafts);
    src.status = 'extracted';
    src.updatedAt = now;
    return mockDelay({ sourceId, status: 'extracted' as const, extracted: drafts.length, message: `成功抽取 ${drafts.length} 条规则` });
  },

  getSkills: (params?: { sourceId?: string; category?: string; enabled?: number }): Promise<Skill[]> => {
    if (!USE_MOCK) {
      const q = new URLSearchParams();
      if (params?.sourceId) q.set('sourceId', params.sourceId);
      if (params?.category) q.set('category', params.category);
      if (params?.enabled !== undefined) q.set('enabled', String(params.enabled));
      const qs = q.toString();
      return fetchAPI<Skill[]>(`/skills${qs ? `?${qs}` : ''}`);
    }
    let list = [...mockSkills];
    if (params?.sourceId) list = list.filter((s) => s.sourceId === params.sourceId);
    if (params?.category) list = list.filter((s) => s.category === params.category);
    if (params?.enabled !== undefined) list = list.filter((s) => s.enabled === params.enabled);
    return mockDelay(list);
  },
  createSkill: (body: SkillCreateRequest): Promise<Skill> => {
    if (!USE_MOCK) return fetchAPI<Skill>('/skills', { method: 'POST', body: JSON.stringify(body) });
    const now = new Date().toISOString();
    const skill: Skill = { id: mockSkillId(), enabled: 1, createdBy: '', createdAt: now, updatedAt: now, positiveExamples: [], negativeExamples: [], description: '', ...body };
    mockSkills.unshift(skill);
    return mockDelay(skill);
  },
  updateSkill: (id: string, body: Partial<Skill>): Promise<Skill> => {
    if (!USE_MOCK) return fetchAPI<Skill>(`/skills/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    const skill = mockSkills.find((s) => s.id === id);
    if (!skill) return mockDelay({} as Skill);
    Object.assign(skill, body, { updatedAt: new Date().toISOString() });
    return mockDelay(skill);
  },
  deleteSkill: (id: string): Promise<any> => {
    if (!USE_MOCK) return fetchAPI<any>(`/skills/${id}`, { method: 'DELETE' });
    const idx = mockSkills.findIndex((s) => s.id === id);
    if (idx >= 0) mockSkills.splice(idx, 1);
    mockSkillGroups.forEach((g) => { g.skillIds = g.skillIds.filter((sid) => sid !== id); });
    return mockDelay({ ok: true, id });
  },

  getSkillGroups: (): Promise<SkillGroup[]> =>
    USE_MOCK ? mockDelay(mockSkillGroups) : fetchAPI<SkillGroup[]>('/skill-groups'),
  createSkillGroup: (body: SkillGroupCreateRequest): Promise<SkillGroup> => {
    if (!USE_MOCK) return fetchAPI<SkillGroup>('/skill-groups', { method: 'POST', body: JSON.stringify(body) });
    const now = new Date().toISOString();
    const group: SkillGroup = { id: mockGroupId(), enabled: 1, createdAt: now, updatedAt: now, description: '', ...body };
    mockSkillGroups.unshift(group);
    return mockDelay(group);
  },
  updateSkillGroup: (id: string, body: Partial<SkillGroup>): Promise<SkillGroup> => {
    if (!USE_MOCK) return fetchAPI<SkillGroup>(`/skill-groups/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    const group = mockSkillGroups.find((g) => g.id === id);
    if (!group) return mockDelay({} as SkillGroup);
    Object.assign(group, body, { updatedAt: new Date().toISOString() });
    return mockDelay(group);
  },
  deleteSkillGroup: (id: string): Promise<any> => {
    if (!USE_MOCK) return fetchAPI<any>(`/skill-groups/${id}`, { method: 'DELETE' });
    const idx = mockSkillGroups.findIndex((g) => g.id === id);
    if (idx >= 0) mockSkillGroups.splice(idx, 1);
    return mockDelay({ ok: true, id });
  },
  getSkillGroupPreview: (id: string): Promise<SkillGroupPreview> => {
    if (!USE_MOCK) return fetchAPI<SkillGroupPreview>(`/skill-groups/${id}/preview`);
    const group = mockSkillGroups.find((g) => g.id === id)!;
    const map = new Map(mockSkills.map((s) => [s.id, s]));
    const skills = group.skillIds.map((sid) => map.get(sid)).filter(Boolean) as Skill[];
    return mockDelay({ ...group, skills });
  },
  bindGroup: (runId: string, groupId: string): Promise<any> =>
    USE_MOCK ? mockDelay({ ok: true, runId, groupId }) : fetchAPI<any>(`/analysis-runs/${runId}/bind-group`, { method: 'POST', body: JSON.stringify({ groupId }) }),

  // ============ 能力标准管理（Capability Standards）============
  getCapabilityMeta: (): Promise<CapabilityMeta> =>
    USE_MOCK
      ? mockDelay(buildCapabilityMeta())
      : fetchAPI<CapabilityMeta>('/capability-standards/meta').catch(() => buildCapabilityMeta()),
  getCapabilityStandards: (): Promise<{ roles: CapabilityRoleInfo[]; meta: CapabilityMeta }> =>
    USE_MOCK
      ? mockDelay({ roles: clone(mockCapabilityRoles), meta: buildCapabilityMeta() })
      : fetchAPI<{ roles: CapabilityRoleInfo[]; meta: CapabilityMeta }>('/capability-standards')
        .catch(() => ({ roles: buildCapabilityRoles(), meta: buildCapabilityMeta() })),
  getCapabilityRole: (roleKey: Role): Promise<CapabilityRoleInfo> =>
    USE_MOCK
      ? mockDelay(clone(mockCapabilityRoles.find((role) => role.roleKey === roleKey)!))
      : fetchAPI<CapabilityRoleInfo>(`/capability-standards/${roleKey}`),
  saveCapabilityRole: (roleKey: Role, body: CapabilitySaveRequest): Promise<CapabilityRoleInfo> => {
    if (!USE_MOCK) {
      return fetchAPI<CapabilityRoleInfo>(`/capability-standards/${roleKey}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    }
    const role = mockCapabilityRoles.find((item) => item.roleKey === roleKey);
    if (!role) return Promise.reject(new Error('能力角色不存在'));
    role.dimensions = [...body.dimensions];
    role.standards = clone(body.standards);
    role.skillGroupId = body.skillGroupId ?? null;
    const skillGroup = mockSkillGroups.find((group) => group.id === role.skillGroupId);
    role.skillGroupName = skillGroup?.name ?? null;
    return mockDelay(clone(role));
  },
  resetCapabilityStandards: (): Promise<{ roles: CapabilityRoleInfo[]; meta: CapabilityMeta }> => {
    if (!USE_MOCK) {
      return fetchAPI<{ roles: CapabilityRoleInfo[]; meta: CapabilityMeta }>(
        '/capability-standards/reset',
        { method: 'POST' },
      );
    }
    mockCapabilityRoles = buildCapabilityRoles();
    return mockDelay({ roles: clone(mockCapabilityRoles), meta: buildCapabilityMeta() });
  },

  // ============ 项目环境配置盘点（Env Inventory）============
  getEnvInventory: (projectId: string, params?: { env?: EnvName; toolType?: EnvToolType; status?: string; q?: string }): Promise<EnvInventoryEntry[]> => {
    if (!USE_MOCK) {
      const q = new URLSearchParams();
      if (params?.env) q.set('env', params.env);
      if (params?.toolType) q.set('toolType', params.toolType);
      if (params?.status) q.set('status', params.status);
      if (params?.q) q.set('q', params.q);
      const qs = q.toString();
      return fetchAPI<EnvInventoryEntry[]>(`/projects/${projectId}/env-inventory${qs ? `?${qs}` : ''}`);
    }
    let list = mockEnvEntries.filter((e) => e.projectId === projectId);
    if (params?.env) list = list.filter((e) => e.env === params.env);
    if (params?.toolType) list = list.filter((e) => e.toolType === params.toolType);
    if (params?.status) list = list.filter((e) => e.status === params.status);
    if (params?.q) {
      const ql = params.q.toLowerCase();
      list = list.filter((e) => [e.key, e.value, e.host, e.port, e.username, e.database, e.sourceFile, e.toolName].join(' ').toLowerCase().includes(ql));
    }
    return mockDelay(list);
  },
  getEnvInventorySummary: (projectId: string): Promise<EnvInventorySummary> =>
    USE_MOCK ? mockDelay(buildEnvSummary(mockEnvEntries.filter((e) => e.projectId === projectId), mockEnvScans.filter((s) => s.projectId === projectId))) : fetchAPI<EnvInventorySummary>(`/projects/${projectId}/env-inventory/summary`),
  scanEnvInventory: (projectId: string, scanType: 'full' | 'incremental'): Promise<EnvInventoryScan> => {
    if (!USE_MOCK) return fetchAPI<EnvInventoryScan>(`/projects/${projectId}/env-inventory/scan`, { method: 'POST', body: JSON.stringify({ scanType }) });
    // mock：模拟一次扫描，full 重建 / incremental 产生少量变化
    const now = new Date().toISOString();
    const scan: EnvInventoryScan = {
      id: mockEnvScanId(), projectId, scanType, status: 'completed', trigger: 'manual',
      startedAt: now, finishedAt: now, filesScanned: 4, entriesFound: mockEnvEntries.filter((e) => e.projectId === projectId).length,
      added: 0, changed: scanType === 'incremental' ? 1 : 0,
      removed: 0, unchanged: scanType === 'incremental' ? 4 : 0,
      message: scanType === 'full' ? '全量扫描完成，已重建配置条目' : '增量扫描完成',
    };
    mockEnvScans.unshift(scan);
    if (scanType === 'incremental') {
      // 模拟：第一条密码变更
      const first = mockEnvEntries.find((e) => e.projectId === projectId && e.isSecret);
      if (first) { first.previousValue = first.value; first.value = 'x9***'; first.status = 'changed'; first.updatedAt = now; }
    }
    return mockDelay(scan);
  },
  getEnvInventoryScans: (projectId: string): Promise<EnvInventoryScan[]> =>
    USE_MOCK ? mockDelay(mockEnvScans.filter((s) => s.projectId === projectId)) : fetchAPI<EnvInventoryScan[]>(`/projects/${projectId}/env-inventory/scans`),
  getEnvInventoryScan: (projectId: string, scanId: string): Promise<{ scan: EnvInventoryScan; entries: EnvInventoryEntry[] }> =>
    USE_MOCK ? mockDelay({ scan: mockEnvScans.find((s) => s.id === scanId)!, entries: mockEnvEntries.filter((e) => e.scanId === scanId) }) : fetchAPI<{ scan: EnvInventoryScan; entries: EnvInventoryEntry[] }>(`/projects/${projectId}/env-inventory/scans/${scanId}`),
};

export type Api = typeof api;
