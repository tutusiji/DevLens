/**
 * DevLens Mock 数据
 * MVP 阶段用这些数据驱动 UI，后续切换到真实 API 只需改 lib/api.ts
 */
import type {
  StatItem, TrinityMatrix, HealthTrendPoint, RiskAlert, DataSource,
  Project, Developer, Team, CapabilityGap, IdentityMatch,
  TeamSpace,
  DeveloperDetail, ProjectDetail, AIReviewInsight, ModuleRisk, FixPriority,
  RoleConfig, Level, Role, LevelStandard, ActivityTrend,
  TeamForecast, SkillsMatrix, SkillsMatrixMember, Iceberg, SwotResult, HiringAdvice,
} from './types';

// ============ 首页统计 ============
export const overviewStats: StatItem[] = [
  { label: '接入项目', value: 12, unit: '个', delta: 2, trend: [8, 9, 10, 11, 12], icon: 'folder-git-2' },
  { label: '开发者', value: 47, unit: '人', delta: 5, trend: [38, 40, 42, 45, 47], icon: 'users' },
  { label: '团队', value: 6, unit: '个', delta: 0, trend: [6, 6, 6, 6, 6], icon: 'network' },
  { label: '平均健康度', value: 78.4, unit: '分', delta: 3.2, trend: [72, 74, 75, 77, 78.4], icon: 'heart-pulse' },
];

// ============ 三位一体矩阵（团队 × 项目 交叉热力图）============
export const trinityMatrix: TrinityMatrix = {
  rows: ['平台架构组', '业务中台组', '前端体验组', '数据智能组', '基础架构组'],
  cols: ['用户中心', '订单系统', '数据网关', '支付平台', '内容引擎'],
  cells: [
    [ { score: 88, members: 4, owner: '陈思' }, { score: 72, members: 2, owner: '陈思' }, null, { score: 65, members: 1 }, null ],
    [ { score: 81, members: 5, owner: '林涛' }, { score: 90, members: 6, owner: '林涛' }, { score: 76, members: 3 }, null, { score: 68, members: 2 } ],
    [ null, { score: 74, members: 2 }, { score: 85, members: 4, owner: '王琳' }, null, { score: 92, members: 5, owner: '王琳' } ],
    [ { score: 69, members: 1 }, { score: 77, members: 3 }, { score: 94, members: 7, owner: '赵磊' }, { score: 82, members: 4, owner: '赵磊' }, null ],
    [ { score: 58, members: 1 }, null, { score: 71, members: 2 }, { score: 79, members: 3 }, { score: 84, members: 4 } ],
  ],
};

// ============ 健康度趋势 ============
export const healthTrend: HealthTrendPoint[] = [
  { month: '2月', quality: 72, security: 68, health: 70 },
  { month: '3月', quality: 74, security: 71, health: 72 },
  { month: '4月', quality: 73, security: 75, health: 74 },
  { month: '5月', quality: 78, security: 76, health: 76 },
  { month: '6月', quality: 80, security: 78, health: 77 },
  { month: '7月', quality: 82, security: 79, health: 78 },
];

// ============ 风险预警 ============
export const riskAlerts: RiskAlert[] = [
  { id: 'r1', type: 'skill_gap', level: 'high', title: '数据智能组「安全意识」覆盖率仅 18%', description: '7 名成员中仅 1 人安全维度 >=60，支付平台存在单点风险', time: '2小时前', action: '安排安全培训 + 代码审查配对' },
  { id: 'r2', type: 'bus_factor', level: 'high', title: '内容引擎 Bus Factor = 1', description: '王琳独占 92 分模块知识，离职将导致项目停摆', time: '5小时前', action: '识别备份负责人 + 文档沉淀' },
  { id: 'r3', type: 'high_variance', level: 'medium', title: '基础架构组能力差异过大', description: '架构能力维度标准差 24，新人难以承接核心模块', time: '1天前', action: '拆分任务粒度 + 结对编程' },
  { id: 'r4', type: 'tech_debt', level: 'medium', title: '用户中心技术债持续上升', description: '近 3 月技术债评分从 78 降至 65，复杂度集中在认证模块', time: '1天前', action: '排期重构认证流程' },
  { id: 'r5', type: 'skill_gap', level: 'low', title: '前端体验组测试覆盖偏低', description: '团队测试维度均值 52，低于全公司 68 的平均水平', time: '2天前', action: '引入测试覆盖率门禁' },
];

// ============ 数据源覆盖率 ============
export const dataSources: DataSource[] = [
  { name: 'GitLab 仓库', coverage: 100, status: 'connected' },
  { name: 'Merge Request', coverage: 92, status: 'connected' },
  { name: 'Issue 跟踪', coverage: 78, status: 'partial' },
  { name: 'CI/CD 流水线', coverage: 65, status: 'partial' },
  { name: '代码质量扫描', coverage: 40, status: 'disconnected' },
];

// ============ 项目列表 ============
export const projects: Project[] = [
  { id: 'p1', name: '用户中心', group: '平台架构组', teamId: 't1', language: 'Go', score: 88, quality: 90, security: 85, debt: 22, status: 'completed', commits: 1847, contributors: 4, lastAnalyzed: '2小时前' },
  { id: 'p2', name: '订单系统', group: '业务中台组', teamId: 't2', language: 'Java', score: 90, quality: 92, security: 88, debt: 18, status: 'completed', commits: 3214, contributors: 6, lastAnalyzed: '1小时前' },
  { id: 'p3', name: '数据网关', group: '数据智能组', teamId: 't4', language: 'Python', score: 94, quality: 95, security: 92, debt: 12, status: 'completed', commits: 2456, contributors: 7, lastAnalyzed: '3小时前' },
  { id: 'p4', name: '支付平台', group: '数据智能组', teamId: 't4', language: 'Java', score: 65, quality: 70, security: 58, debt: 45, status: 'analyzing', commits: 4102, contributors: 4, lastAnalyzed: '分析中' },
  { id: 'p5', name: '内容引擎', group: '前端体验组', teamId: 't3', language: 'TypeScript', score: 92, quality: 94, security: 90, debt: 15, status: 'completed', commits: 2891, contributors: 5, lastAnalyzed: '4小时前' },
  { id: 'p6', name: '搜索中台', group: '数据智能组', teamId: 't4', language: 'Python', score: 81, quality: 83, security: 79, debt: 28, status: 'completed', commits: 1567, contributors: 3, lastAnalyzed: '6小时前' },
  { id: 'p7', name: '风控引擎', group: '基础架构组', teamId: 't5', language: 'Go', score: 79, quality: 81, security: 82, debt: 25, status: 'completed', commits: 2034, contributors: 4, lastAnalyzed: '8小时前' },
  { id: 'p8', name: '消息推送', group: '平台架构组', teamId: 't1', language: 'Go', score: 74, quality: 76, security: 72, debt: 32, status: 'pending', commits: 892, contributors: 2, lastAnalyzed: '待分析' },
];

// ============ 开发者列表 ============
export const developers: Developer[] = [
  { id: 'd1', name: '陈思', username: 'chensi', role: '架构师', roleType: 'backend', team: '核心服务小组', teamId: 'g-platform-core', level: 'E3', overall: 89, commits: 412, reviews: 156, langs: ['Go', 'Python'], tags: ['核心模块贡献者', '偏后端架构'] },
  { id: 'd2', name: '林涛', username: 'lintao', role: '技术专家', roleType: 'backend', team: '交易服务小组', teamId: 'g-business-order', level: 'D2', overall: 91, commits: 523, reviews: 198, langs: ['Java', 'Kotlin'], tags: ['核心模块贡献者', '架构能力突出'] },
  { id: 'd3', name: '王琳', username: 'wanglin', role: '高级工程师', roleType: 'frontend', team: '内容体验小组', teamId: 'g-frontend-content', level: 'E3', overall: 87, commits: 387, reviews: 134, langs: ['TypeScript', 'React'], tags: ['核心模块贡献者', '前端专家', '13年经验示例'] },
  { id: 'd4', name: '赵磊', username: 'zhaolei', role: '技术专家', roleType: 'algorithm', team: '数据智能组', teamId: 't4', level: 'D3', overall: 93, commits: 612, reviews: 245, langs: ['Python', 'Rust'], tags: ['全栈能力', '成长速度快'] },
  { id: 'd5', name: '刘洋', username: 'liuyang', role: '高级工程师', roleType: 'devops', team: '基础架构组', teamId: 't5', level: 'E1', overall: 78, commits: 298, reviews: 87, langs: ['Go'], tags: ['稳定性强', '运维能力'] },
  { id: 'd6', name: '张敏', username: 'zhangmin', role: '工程师', roleType: 'backend', team: '交易服务小组', teamId: 'g-business-order', level: 'F2', overall: 72, commits: 234, reviews: 56, langs: ['Java'], tags: ['成长中', '业务理解'] },
  { id: 'd7', name: '周杰', username: 'zhoujie', role: '工程师', roleType: 'frontend', team: '内容体验小组', teamId: 'g-frontend-content', level: 'F3', overall: 75, commits: 267, reviews: 78, langs: ['TypeScript', 'Vue'], tags: ['协作能力突出'] },
  { id: 'd8', name: '吴婷', username: 'wuting', role: '高级工程师', roleType: 'algorithm', team: '数据智能组', teamId: 't4', level: 'E2', overall: 82, commits: 341, reviews: 112, langs: ['Python', 'SQL'], tags: ['数据建模', '安全意识强'] },
];

// ============ 团队列表 ============
export const teams: Team[] = [
  {
    id: 't1', name: '平台架构组', members: 8, avgScore: 84, busFactor: 3, riskCount: 1,
    capability: { code_quality: 86, architecture: 90, stability: 82, efficiency: 80, collaboration: 85, security_aware: 78, test_coverage: 75 },
  },
  {
    id: 't2', name: '业务中台组', members: 12, avgScore: 86, busFactor: 4, riskCount: 0,
    capability: { code_quality: 88, architecture: 85, stability: 87, efficiency: 84, collaboration: 88, security_aware: 82, test_coverage: 86 },
  },
  {
    id: 't3', name: '前端体验组', members: 7, avgScore: 81, busFactor: 2, riskCount: 2,
    capability: { code_quality: 84, architecture: 78, stability: 80, efficiency: 85, collaboration: 82, security_aware: 70, test_coverage: 52 },
  },
  {
    id: 't4', name: '数据智能组', members: 9, avgScore: 83, busFactor: 2, riskCount: 3,
    capability: { code_quality: 85, architecture: 84, stability: 78, efficiency: 88, collaboration: 80, security_aware: 58, test_coverage: 72 },
  },
  {
    id: 't5', name: '基础架构组', members: 6, avgScore: 76, busFactor: 2, riskCount: 2,
    capability: { code_quality: 78, architecture: 82, stability: 80, efficiency: 72, collaboration: 75, security_aware: 81, test_coverage: 68 },
  },
  {
    id: 't6', name: '安全合规组', members: 5, avgScore: 79, busFactor: 3, riskCount: 1,
    capability: { code_quality: 75, architecture: 76, stability: 85, efficiency: 70, collaboration: 82, security_aware: 92, test_coverage: 80 },
  },
];

// ============ 活跃榜单（决策总览）============
// 活跃度：commits + contributors / reviews 综合排序，trend 模拟近 7 天环比
export const activeProjects = projects
  .filter((p) => p.status !== 'failed')
  .sort((a, b) => b.commits + b.contributors * 200 - (a.commits + a.contributors * 200))
  .slice(0, 5)
  .map((p) => ({
    id: p.id,
    name: p.name,
    language: p.language,
    commits: p.commits,
    contributors: p.contributors,
    trend: p.status === 'analyzing' ? 'up' : p.score >= 80 ? 'stable' : 'down' as ActivityTrend,
  }));

export const activeDevelopers = developers
  .sort((a, b) => b.commits + b.reviews * 3 - (a.commits + a.reviews * 3))
  .slice(0, 5)
  .map((d) => ({
    id: d.id,
    name: d.name,
    role: d.role,
    team: d.team,
    commits: d.commits,
    reviews: d.reviews,
    trend: d.overall >= 85 ? 'up' : d.overall >= 70 ? 'stable' : 'down' as ActivityTrend,
  }));

export const activeTeams = teams
  .sort((a, b) => b.avgScore + b.members * 2 - (a.avgScore + a.members * 2))
  .slice(0, 5)
  .map((t) => ({
    id: t.id,
    name: t.name,
    members: t.members,
    score: t.avgScore,
    trend: t.avgScore >= 85 ? 'up' : t.avgScore >= 70 ? 'stable' : 'down' as ActivityTrend,
  }));

// 统一组织团队树：根团队（lt-*，parentId 为 null）+ 空间（t*）+ 叶团队（g-*）
export const teamSpaces: TeamSpace[] = [
  { id: 'lt-tech', name: '技术研发中心', parentId: null, description: '负责全公司技术基础设施与产品研发', status: 'active', createdAt: '2025-03-01', updatedAt: '今天 10:32', memberIds: [], projectIds: [] },
  { id: 'lt-data', name: '数据智能中心', parentId: null, description: '负责数据平台、算法与智能化能力', status: 'active', createdAt: '2025-03-01', updatedAt: '今天 10:32', memberIds: [], projectIds: [] },
  { id: 't1', name: '平台架构组', parentId: 'lt-tech', parentName: '技术研发中心', description: '负责账户、权限、消息等平台基础能力。', ownerId: 'd1', ownerName: '陈思', status: 'active', createdAt: '2025-03-12', updatedAt: '今天 10:32', memberIds: ['d1'], projectIds: ['p1', 'p8'] },
  { id: 't2', name: '业务中台组', parentId: 'lt-tech', parentName: '技术研发中心', description: '负责订单、库存及业务交易核心链路。', ownerId: 'd2', ownerName: '林涛', status: 'active', createdAt: '2025-03-18', updatedAt: '今天 09:12', memberIds: ['d2', 'd6'], projectIds: ['p2'] },
  { id: 't3', name: '前端体验组', parentId: 'lt-tech', parentName: '技术研发中心', description: '负责内容体验、设计系统与用户端工程。', ownerId: 'd3', ownerName: '王琳', status: 'active', createdAt: '2025-04-02', updatedAt: '昨天', memberIds: ['d3', 'd7'], projectIds: ['p5'] },
  { id: 't5', name: '基础架构组', parentId: 'lt-tech', parentName: '技术研发中心', description: '负责交付平台、稳定性和基础设施。', ownerId: 'd5', ownerName: '刘洋', status: 'active', createdAt: '2025-04-22', updatedAt: '昨天', memberIds: ['d5'], projectIds: ['p7'] },
  { id: 't6', name: '安全合规组', parentId: 'lt-tech', parentName: '技术研发中心', description: '负责安全基线、风险治理与合规审查。', status: 'active', createdAt: '2025-05-08', updatedAt: '2 天前', memberIds: [], projectIds: [] },
  { id: 't4', name: '数据智能组', parentId: 'lt-data', parentName: '数据智能中心', description: '负责数据平台、模型服务和智能化能力。', ownerId: 'd4', ownerName: '赵磊', status: 'active', createdAt: '2025-04-10', updatedAt: '3 小时前', memberIds: ['d4', 'd8'], projectIds: ['p3', 'p4', 'p6'] },
  { id: 'g-platform-core', name: '核心服务小组', parentId: 't1', parentName: '平台架构组', description: '账户、权限与消息核心服务小组', ownerId: 'd1', ownerName: '陈思', status: 'active', createdAt: '2025-03-12', updatedAt: '今天', memberIds: ['d1'], projectIds: ['p1', 'p8'] },
  { id: 'g-business-order', name: '交易服务小组', parentId: 't2', parentName: '业务中台组', description: '订单、库存与交易链路小组', ownerId: 'd2', ownerName: '林涛', status: 'active', createdAt: '2025-03-18', updatedAt: '今天', memberIds: ['d2', 'd6'], projectIds: ['p2'] },
  { id: 'g-frontend-content', name: '内容体验小组', parentId: 't3', parentName: '前端体验组', description: '内容体验与用户端工程小组', ownerId: 'd3', ownerName: '王琳', status: 'active', createdAt: '2025-04-02', updatedAt: '昨天', memberIds: ['d3', 'd7'], projectIds: ['p5'] },
];

// ============ 能力缺口矩阵 ============
export const capabilityGaps: CapabilityGap[] = [
  { capability: '安全意识', current: 58, target: 80, owner: '数据智能组', action: '安全培训 + 代码审查配对' },
  { capability: '测试覆盖', current: 52, target: 75, owner: '前端体验组', action: '引入覆盖率门禁 + 测试用例补齐' },
  { capability: '架构能力', current: 76, target: 85, owner: '前端体验组', action: '架构评审会 + 跨组技术分享' },
  { capability: '交付效率', current: 72, target: 80, owner: '基础架构组', action: '流程优化 + 工具链建设' },
];

// ============ 身份匹配预览 ============
export const identityMatches: IdentityMatch[] = [
  { gitName: 'chensi42', gitEmail: 'chensi@company.com', personName: '陈思', department: '平台架构组', confidence: 1.0, method: 'email' },
  { gitName: 'Lin Tao', gitEmail: 'lintao@github.com', personName: '林涛', department: '业务中台组', confidence: 0.9, method: 'employee_id' },
  { gitName: 'wanglin_dev', gitEmail: 'wl123@qq.com', personName: '王琳', department: '前端体验组', confidence: 0.75, method: 'pinyin' },
  { gitName: 'zhaolei88', gitEmail: 'zl88@163.com', personName: '赵磊', department: '数据智能组', confidence: 0.85, method: 'fuzzy' },
  { gitName: 'dependabot[bot]', gitEmail: 'support@github.com', personName: '—', department: '—', confidence: 0, method: 'email' },
];

// ============ 开发者详情 ============
export const developerDetails: Record<string, DeveloperDetail> = {
  d1: {
    ...developers[0],
    capability: { code_quality: 88, architecture: 92, stability: 85, efficiency: 82, collaboration: 87, security_aware: 80, test_coverage: 78, growth_velocity: 76 },
    teamCapabilityAvg: { code_quality: 86, architecture: 90, stability: 82, efficiency: 80, collaboration: 85, security_aware: 78, test_coverage: 75 },
    growthCurve: [
      { period: '2024 Q1', composite: 78, teamAvg: 80 },
      { period: '2024 Q2', composite: 81, teamAvg: 81 },
      { period: '2024 Q3', composite: 83, teamAvg: 82 },
      { period: '2024 Q4', composite: 85, teamAvg: 83 },
      { period: '2025 Q1', composite: 87, teamAvg: 84 },
      { period: '2025 Q2', composite: 89, teamAvg: 84 },
    ],
    behaviorEvidence: [
      { label: '提交频率', value: 8.2, unit: '次/周', benchmark: 5.5, description: '高于组织均值 49%' },
      { label: '节奏规律性', value: 0.78, unit: '', benchmark: 0.62, description: '工作时间分布稳定' },
      { label: 'Revert 比例', value: 2.1, unit: '%', benchmark: 4.8, description: '远低于均值，代码质量稳定' },
      { label: 'Hotfix 比例', value: 1.5, unit: '%', benchmark: 3.2, description: '紧急修复少，前置质量好' },
    ],
    partners: [
      { name: '林涛', username: 'lintao', sharedCommits: 42, reviewCount: 28 },
      { name: '赵磊', username: 'zhaolei', sharedCommits: 31, reviewCount: 22 },
      { name: '吴婷', username: 'wuting', sharedCommits: 18, reviewCount: 15 },
    ],
    projects: [
      { projectId: 'p1', projectName: '用户中心', projectScore: 88, projectStatus: 'completed', role: '主导贡献', commits: 156, reviews: 62, ownership: 72, moduleCount: 4, lastActiveAt: '2小时前' },
      { projectId: 'p8', projectName: '消息推送', projectScore: 74, projectStatus: 'pending', role: '架构支持', commits: 78, reviews: 26, ownership: 38, moduleCount: 1, lastActiveAt: '1天前' },
      { projectId: 'p5', projectName: '内容引擎', projectScore: 92, projectStatus: 'completed', role: '跨组协作', commits: 44, reviews: 18, ownership: 22, moduleCount: 0, lastActiveAt: '5天前' },
    ],
    modules: [
      { module: 'auth-service', projectId: 'p1', projectName: '用户中心', commits: 156, ownership: 72, complexity: 68 },
      { module: 'user-core', projectId: 'p1', projectName: '用户中心', commits: 134, ownership: 65, complexity: 55 },
      { module: 'session-mgr', projectId: 'p1', projectName: '用户中心', commits: 89, ownership: 80, complexity: 42 },
      { module: 'permission', projectId: 'p1', projectName: '用户中心', commits: 33, ownership: 45, complexity: 38 },
    ],
    aiSuggestion: '架构能力突出（92 分，团队前 10%），建议参与跨组架构评审会。安全意识（80）略低于架构水平，可补强安全 review 参与度。主导 auth-service 模块（72% 归属），建议培养备份负责人降低 Bus Factor。',
  },
  d3: {
    ...developers[2],
    // 前端 E3：13 年经验样例，使用前端专属 UI 质量/响应式维度
    capability: { code_quality: 89, architecture: 88, stability: 0, efficiency: 0, collaboration: 91, security_aware: 82, test_coverage: 86, growth_velocity: 78, ui_quality: 93, responsive: 90 },
    teamCapabilityAvg: { code_quality: 84, architecture: 78, stability: 0, efficiency: 0, collaboration: 82, security_aware: 70, test_coverage: 52 },
    growthCurve: [
      { period: '2024 Q1', composite: 80, teamAvg: 75 },
      { period: '2024 Q2', composite: 82, teamAvg: 77 },
      { period: '2024 Q3', composite: 84, teamAvg: 78 },
      { period: '2024 Q4', composite: 85, teamAvg: 79 },
      { period: '2025 Q1', composite: 86, teamAvg: 80 },
      { period: '2025 Q2', composite: 87, teamAvg: 81 },
    ],
    behaviorEvidence: [
      { label: '提交频率', value: 7.4, unit: '次/周', benchmark: 5.5, description: '长期稳定投入核心前端模块' },
      { label: '节奏规律性', value: 0.81, unit: '', benchmark: 0.62, description: '交付节奏稳定，返工较少' },
      { label: 'Revert 比例', value: 1.7, unit: '%', benchmark: 4.8, description: '前端变更稳定性高' },
      { label: 'Hotfix 比例', value: 1.0, unit: '%', benchmark: 3.2, description: '线上紧急修复低于均值' },
    ],
    partners: [
      { name: '周杰', username: 'zhoujie', sharedCommits: 76, reviewCount: 42 },
      { name: '陈思', username: 'chensi', sharedCommits: 35, reviewCount: 21 },
    ],
    projects: [
      { projectId: 'p5', projectName: '内容引擎', projectScore: 92, projectStatus: 'completed', role: '主导贡献', commits: 242, reviews: 91, ownership: 78, moduleCount: 3, lastActiveAt: '4小时前' },
      { projectId: 'p1', projectName: '用户中心', projectScore: 88, projectStatus: 'completed', role: '跨组协作', commits: 67, reviews: 18, ownership: 25, moduleCount: 0, lastActiveAt: '3天前' },
    ],
    modules: [
      { module: 'design-system', projectId: 'p5', projectName: '内容引擎', commits: 148, ownership: 78, complexity: 52 },
      { module: 'content-renderer', projectId: 'p5', projectName: '内容引擎', commits: 121, ownership: 68, complexity: 65 },
      { module: 'mobile-shell', projectId: 'p5', projectName: '内容引擎', commits: 86, ownership: 72, complexity: 58 },
    ],
    aiSuggestion: '已达到前端工程师 E3 资深工程师标准。UI 质量（93）和响应式（90）是明显优势，适合主导设计系统和复杂交互。若未来冲刺 D 级高阶能力层，建议加强跨端架构决策、前端安全治理与组织级技术影响力。',
  },
  d2: {
    ...developers[1],
    capability: { code_quality: 90, architecture: 88, stability: 89, efficiency: 86, collaboration: 90, security_aware: 84, test_coverage: 88, growth_velocity: 82 },
    teamCapabilityAvg: { code_quality: 88, architecture: 85, stability: 87, efficiency: 84, collaboration: 88, security_aware: 82, test_coverage: 86 },
    growthCurve: [
      { period: '2024 Q1', composite: 82, teamAvg: 83 },
      { period: '2024 Q2', composite: 85, teamAvg: 84 },
      { period: '2024 Q3', composite: 87, teamAvg: 85 },
      { period: '2024 Q4', composite: 88, teamAvg: 85 },
      { period: '2025 Q1', composite: 90, teamAvg: 86 },
      { period: '2025 Q2', composite: 91, teamAvg: 86 },
    ],
    behaviorEvidence: [
      { label: '提交频率', value: 10.5, unit: '次/周', benchmark: 5.5, description: '高于组织均值 91%' },
      { label: '节奏规律性', value: 0.72, unit: '', benchmark: 0.62, description: '分布较稳定' },
      { label: 'Revert 比例', value: 1.8, unit: '%', benchmark: 4.8, description: '代码质量很高' },
      { label: 'Hotfix 比例', value: 1.2, unit: '%', benchmark: 3.2, description: '紧急修复极少' },
    ],
    partners: [
      { name: '陈思', username: 'chensi', sharedCommits: 42, reviewCount: 35 },
      { name: '张敏', username: 'zhangmin', sharedCommits: 28, reviewCount: 19 },
    ],
    projects: [
      { projectId: 'p2', projectName: '订单系统', projectScore: 90, projectStatus: 'completed', role: '主导贡献', commits: 198, reviews: 78, ownership: 68, moduleCount: 3, lastActiveAt: '1小时前' },
      { projectId: 'p4', projectName: '支付平台', projectScore: 65, projectStatus: 'analyzing', role: '架构协作', commits: 102, reviews: 45, ownership: 34, moduleCount: 0, lastActiveAt: '2天前' },
    ],
    modules: [
      { module: 'order-core', projectId: 'p2', projectName: '订单系统', commits: 198, ownership: 68, complexity: 72 },
      { module: 'payment-gw', projectId: 'p2', projectName: '订单系统', commits: 142, ownership: 55, complexity: 65 },
      { module: 'inventory', projectId: 'p2', projectName: '订单系统', commits: 88, ownership: 60, complexity: 48 },
    ],
    aiSuggestion: '全面均衡型开发者，7 维均在 84+，协作能力（90）尤为突出。Review 参与度高（198 次），是团队的知识传递者。建议承担新人 mentor 角色。',
  },
};

export function getDeveloperDetail(id: string): DeveloperDetail {
  const known = developerDetails[id];
  const developer = developers.find((item) => item.id === id) || developers[0];
  const base: DeveloperDetail = known || {
    ...developer,
    capability: { code_quality: developer.overall, architecture: developer.overall - 3, stability: developer.overall - 5, efficiency: developer.overall - 2, collaboration: developer.overall - 1, security_aware: developer.overall - 6, test_coverage: developer.overall - 4, growth_velocity: developer.overall - 8 },
    teamCapabilityAvg: { code_quality: 80, architecture: 80, stability: 78, efficiency: 80, collaboration: 80, security_aware: 76, test_coverage: 76 },
    growthCurve: [],
    behaviorEvidence: [],
    partners: [],
    modules: [],
    projects: [],
    aiSuggestion: '该开发者的项目参与明细将在完成更多仓库贡献归集后展示。',
  };
  // 动态注入 roleStandard（避免模块顶层 TDZ）
  if (!base.roleStandard) {
    base.roleStandard = getRoleStandard(base.roleType, base.level);
  }
  return base;
}

// ============ 项目详情 ============
const userCenterInsights: AIReviewInsight[] = [
  {
    id: 'ins-jwt-algorithm', title: 'JWT 校验未限制签名算法', module: 'auth-service', type: 'security', category: 'security', severity: 'high', level: 'warning', riskScore: 91, confidence: 0.94, status: 'open',
    filePath: 'services/auth/token.ts', symbol: 'verifyToken', startLine: 42, endLine: 58, source: 'SAST + AI Review', firstSeenAt: '2026-07-18', lastSeenAt: '2026-07-26', assignee: '陈思',
    evidence: '3 处 JWT 校验未检查签名算法', codeExcerpt: 'jwt.verify(token, publicKey, options)', impact: '潜在算法混淆攻击，可能绕过身份校验。', action: '强制 RS256 算法白名单，并增加拒绝非白名单算法的测试。', verification: '安全规则重扫通过，新增算法拒绝单测。',
  },
  {
    id: 'ins-user-service', title: 'UserService 过度聚合', module: 'user-core', type: 'maintainability', category: 'complexity', severity: 'medium', level: 'info', riskScore: 68, confidence: 0.88, status: 'acknowledged',
    filePath: 'modules/user/UserService.ts', symbol: 'UserService', startLine: 1, endLine: 1200, source: 'Complexity Analyzer + AI Review', firstSeenAt: '2026-06-12', lastSeenAt: '2026-07-26', assignee: '刘洋',
    evidence: '单文件 1200 行，查询、写入与权限逻辑高度耦合。', codeExcerpt: 'export class UserService { /* 42 public methods */ }', impact: '维护成本高，认知负载重，变更回归范围扩大。', action: '拆分为 UserQuery、UserCommand 与 PermissionFacade 三个服务。', verification: '模块复杂度低于 60，关键 API 回归测试覆盖。',
  },
  {
    id: 'ins-redis-pool', title: 'Redis 连接未复用', module: 'session-mgr', type: 'performance', category: 'reliability', severity: 'high', level: 'warning', riskScore: 82, confidence: 0.91, status: 'in_progress',
    filePath: 'services/session/redis-client.ts', symbol: 'getSession', startLine: 18, endLine: 35, source: 'Performance Rule + AI Review', firstSeenAt: '2026-07-03', lastSeenAt: '2026-07-26', assignee: '周杰',
    evidence: '每次请求新建 Redis 客户端，缺少连接池和超时控制。', codeExcerpt: 'const client = createClient({ url: redisUrl })', impact: 'P99 延迟偏高（180ms），高峰期可能耗尽连接。', action: '引入连接池、连接复用、超时和哨兵故障转移策略。', verification: '压测 P99 低于 80ms，连接数保持在容量阈值内。',
  },
  {
    id: 'ins-env-debug', title: '生产环境允许 Debug 日志', module: 'gateway-config', type: 'configuration', category: 'configuration', severity: 'medium', level: 'warning', riskScore: 72, confidence: 0.79, status: 'open',
    filePath: 'deploy/values-prod.yaml', startLine: 24, endLine: 24, source: 'Config Scanner', firstSeenAt: '2026-07-26', lastSeenAt: '2026-07-26',
    evidence: 'production values 中 LOG_LEVEL 设置为 debug。', codeExcerpt: 'LOG_LEVEL: debug', impact: '可能记录敏感请求上下文并增加生产 I/O 开销。', action: '生产环境改为 info，并通过 CI 阻止 debug 配置进入发布包。', verification: '部署清单重扫无生产 debug 配置。',
  },
];

const userCenterModuleRisks: ModuleRisk[] = [
  { id: 'module-auth', name: 'auth-service', path: 'services/auth', score: 84, severity: 'high', criticalCount: 0, issueCount: 2, complexity: 68, debtLoad: 18, owner: '陈思', backupOwner: '刘洋', ownership: 72, lastChanged: '2 小时前', categories: [{ category: 'security', count: 1 }, { category: 'logic', count: 1 }] },
  { id: 'module-session', name: 'session-mgr', path: 'services/session', score: 78, severity: 'high', criticalCount: 0, issueCount: 2, complexity: 57, debtLoad: 12, owner: '周杰', ownership: 48, lastChanged: '昨天', categories: [{ category: 'performance', count: 1 }, { category: 'reliability', count: 1 }] },
  { id: 'module-user', name: 'user-core', path: 'modules/user', score: 65, severity: 'medium', criticalCount: 0, issueCount: 3, complexity: 83, debtLoad: 10, owner: '刘洋', backupOwner: '陈思', ownership: 65, lastChanged: '3 天前', categories: [{ category: 'complexity', count: 2 }, { category: 'maintainability', count: 1 }] },
  { id: 'module-gateway', name: 'gateway-config', path: 'deploy', score: 58, severity: 'medium', criticalCount: 0, issueCount: 1, complexity: 12, debtLoad: 4, ownership: 0, lastChanged: '今天', categories: [{ category: 'configuration', count: 1 }] },
];

const userCenterFixes: FixPriority[] = [
  { id: 'fix-jwt', insightId: 'ins-jwt-algorithm', module: 'auth-service', title: '限制 JWT 签名算法', severity: 'high', priority: 'P0', debt: 18, effort: '3 人日', impact: '消除身份校验绕过风险', expectedGain: 7, status: 'open', assignee: '陈思', dueDate: '7 月 31 日' },
  { id: 'fix-redis', insightId: 'ins-redis-pool', module: 'session-mgr', title: '引入 Redis 连接池', severity: 'high', priority: 'P1', debt: 12, effort: '2 人日', impact: 'P99 延迟预计降至 80ms', expectedGain: 4, status: 'in_progress', assignee: '周杰', dueDate: '8 月 2 日' },
  { id: 'fix-user-service', insightId: 'ins-user-service', module: 'user-core', title: '拆分 UserService', severity: 'medium', priority: 'P2', debt: 10, effort: '5 人日', impact: '降低认知负载和回归范围', expectedGain: 3, status: 'acknowledged', assignee: '刘洋', dueDate: '8 月 16 日' },
];

const orderInsights: AIReviewInsight[] = [
  {
    id: 'ins-decimal', title: '金额计算使用浮点数', module: 'payment-gw', type: 'security', category: 'logic', severity: 'high', level: 'warning', riskScore: 79, confidence: 0.9, status: 'open',
    filePath: 'payment/MoneyCalculator.java', symbol: 'calculateFee', startLine: 33, endLine: 47, source: 'Logic Rule + AI Review', firstSeenAt: '2026-07-20', lastSeenAt: '2026-07-26', assignee: '林涛',
    evidence: '金额计算未使用 Decimal/BigDecimal。', codeExcerpt: 'double fee = amount * rate;', impact: '浮点精度误差可能导致订单金额不一致。', action: '统一使用 BigDecimal，并增加边界金额和舍入方式测试。', verification: '金额精度规则通过，边界测试覆盖。',
  },
  {
    id: 'ins-state-machine', title: '订单状态机是可复用最佳实践', module: 'order-core', type: 'quality', category: 'quality', severity: 'info', level: 'info', riskScore: 12, confidence: 0.96, status: 'resolved',
    filePath: 'order/OrderStateMachine.kt', symbol: 'OrderStateMachine', startLine: 1, endLine: 208, source: 'AI Review', firstSeenAt: '2026-07-26', lastSeenAt: '2026-07-26',
    evidence: '状态转换完整，异常分支和单元测试覆盖充分。', impact: '维护成本低，可作为同类领域实现模板。', action: '沉淀为团队订单领域建模范式。', verification: '架构评审通过并已输出模块文档。',
  },
];

const orderModuleRisks: ModuleRisk[] = [
  { id: 'module-payment', name: 'payment-gw', path: 'payment', score: 73, severity: 'high', criticalCount: 0, issueCount: 1, complexity: 45, debtLoad: 14, owner: '林涛', backupOwner: '张敏', ownership: 55, lastChanged: '5 小时前', categories: [{ category: 'logic', count: 1 }] },
  { id: 'module-order', name: 'order-core', path: 'order', score: 24, severity: 'low', criticalCount: 0, issueCount: 0, complexity: 38, debtLoad: 3, owner: '林涛', backupOwner: '张敏', ownership: 68, lastChanged: '昨天', categories: [{ category: 'quality', count: 0 }] },
  { id: 'module-inventory', name: 'inventory', path: 'inventory', score: 41, severity: 'medium', criticalCount: 0, issueCount: 1, complexity: 51, debtLoad: 4, owner: '张敏', ownership: 42, lastChanged: '6 天前', categories: [{ category: 'maintainability', count: 1 }] },
];

const orderFixes: FixPriority[] = [
  { id: 'fix-decimal', insightId: 'ins-decimal', module: 'payment-gw', title: '替换为 BigDecimal 金额模型', severity: 'high', priority: 'P1', debt: 14, effort: '2 人日', impact: '消除金额精度风险', expectedGain: 4, status: 'open', assignee: '林涛', dueDate: '8 月 4 日' },
  { id: 'fix-inventory', module: 'inventory', title: '提取库存规则策略', severity: 'medium', priority: 'P2', debt: 4, effort: '1 人日', impact: '提升可读性', expectedGain: 1, status: 'acknowledged', assignee: '张敏', dueDate: '8 月 9 日' },
];

export const projectDetails: Record<string, ProjectDetail> = {
  p1: {
    ...projects[0],
    dimensions: [
      { label: '代码质量', score: 90, benchmark: 78, trend: 'up', description: 'AI Review 通过率 92%，lint 合规率 96%' },
      { label: '安全性', score: 85, benchmark: 75, trend: 'stable', description: '无高危漏洞，密钥检测通过' },
      { label: '测试覆盖', score: 82, benchmark: 68, trend: 'up', description: '行覆盖 82%，分支覆盖 71%' },
      { label: '技术债', score: 78, benchmark: 72, trend: 'down', description: '复杂度集中在 auth 模块，待重构' },
      { label: '交付稳定性', score: 88, benchmark: 80, trend: 'up', description: '近 30 天无回滚，MTTR 12 分钟' },
    ],
    aiInsights: userCenterInsights, moduleRisks: userCenterModuleRisks, fixPriorities: userCenterFixes,
    reviewSummary: { total: 8, critical: 0, open: 3, newSinceLastScan: 2, inProgress: 1, resolved: 4 },
    analysisMeta: { branch: 'main', commit: '7f3a2ce', analysisVersion: '2026.07', scannedAt: '今天 10:32', coverage: 96, filesScanned: 842, confidence: 0.91 },
    contributorList: [
      { name: '陈思', username: 'chensi', commits: 156, reviews: 62, ownership: 72 },
      { name: '刘洋', username: 'liuyang', commits: 89, reviews: 31, ownership: 38 },
      { name: '周杰', username: 'zhoujie', commits: 67, reviews: 18, ownership: 25 },
    ],
    debtTrend: [
      { month: '2月', debt: 28, complexity: 65 }, { month: '3月', debt: 26, complexity: 63 }, { month: '4月', debt: 25, complexity: 62 },
      { month: '5月', debt: 24, complexity: 60 }, { month: '6月', debt: 23, complexity: 58 }, { month: '7月', debt: 22, complexity: 57 },
    ],
  },
  p2: {
    ...projects[1],
    dimensions: [
      { label: '代码质量', score: 92, benchmark: 78, trend: 'up', description: 'AI Review 通过率 95%' },
      { label: '安全性', score: 88, benchmark: 75, trend: 'up', description: 'CodeQL 零高危' },
      { label: '测试覆盖', score: 89, benchmark: 68, trend: 'up', description: '行覆盖 89%' },
      { label: '技术债', score: 85, benchmark: 72, trend: 'up', description: '持续下降' },
      { label: '交付稳定性', score: 94, benchmark: 80, trend: 'up', description: '零回滚' },
    ],
    aiInsights: orderInsights, moduleRisks: orderModuleRisks, fixPriorities: orderFixes,
    reviewSummary: { total: 2, critical: 0, open: 1, newSinceLastScan: 1, inProgress: 0, resolved: 1 },
    analysisMeta: { branch: 'main', commit: '5d92ab1', analysisVersion: '2026.07', scannedAt: '今天 09:12', coverage: 98, filesScanned: 1264, confidence: 0.95 },
    contributorList: [
      { name: '林涛', username: 'lintao', commits: 198, reviews: 78, ownership: 68 },
      { name: '张敏', username: 'zhangmin', commits: 112, reviews: 34, ownership: 42 },
    ],
    debtTrend: [
      { month: '2月', debt: 22, complexity: 60 }, { month: '3月', debt: 20, complexity: 58 }, { month: '4月', debt: 19, complexity: 56 },
      { month: '5月', debt: 18, complexity: 55 }, { month: '6月', debt: 18, complexity: 54 }, { month: '7月', debt: 18, complexity: 53 },
    ],
  },
};

export function getProjectDetail(id: string): ProjectDetail | null {
  return projectDetails[id] || null;
}

// ============ 角色配置（5 角色 × 各自维度集）============
export const roleConfigs: RoleConfig[] = [
  {
    key: 'frontend', name: '前端工程师',
    dimensions: ['code_quality', 'architecture', 'ui_quality', 'responsive', 'collaboration', 'security_aware', 'test_coverage', 'growth_velocity'],
  },
  {
    key: 'backend', name: '后端工程师',
    dimensions: ['code_quality', 'architecture', 'stability', 'efficiency', 'collaboration', 'security_aware', 'test_coverage', 'growth_velocity'],
  },
  {
    key: 'devops', name: '运维工程师',
    dimensions: ['automation', 'monitoring', 'stability', 'efficiency', 'collaboration', 'security_aware', 'doc_quality', 'growth_velocity'],
  },
  {
    key: 'algorithm', name: '算法工程师',
    dimensions: ['code_quality', 'modeling', 'experiment_efficiency', 'stability', 'collaboration', 'security_aware', 'test_coverage', 'growth_velocity'],
  },
  {
    key: 'qa', name: '测试工程师',
    dimensions: ['code_quality', 'test_design', 'coverage', 'stability', 'collaboration', 'security_aware', 'automation', 'growth_velocity'],
  },
];

export const DIMENSION_LABELS: Record<string, string> = {
  code_quality: '代码质量', architecture: '架构能力', stability: '稳定性',
  efficiency: '交付效率', collaboration: '协作能力', security_aware: '安全意识',
  test_coverage: '测试覆盖', growth_velocity: '成长速度',
  ui_quality: 'UI 质量', responsive: '响应式',
  automation: '自动化', monitoring: '监控', doc_quality: '文档质量',
  modeling: '建模能力', experiment_efficiency: '实验效率',
  test_design: '测试设计', coverage: '覆盖率',
};

// ============ 能力标准表（角色 × 职级 -> 各维度标准阈值）============
// D > E > F > G；同一大级内 3 > 2 > 1。D 级为稀缺高阶能力层。
// E3 对应长期独立负责的资深工程师（如 13 年经验前端），不是“满分能力”门槛。
const LEVEL_BASE: Record<Level, number> = {
  D1: 88, D2: 92, D3: 96,
  E1: 72, E2: 76, E3: 80,
  F1: 60, F2: 64, F3: 68,
  G1: 48, G2: 52, G3: 56,
};

// 每个维度相对 base 的偏移（有些维度要求更高，如安全意识；有些更低，如成长速度）
const DIMENSION_OFFSET: Record<string, number> = {
  code_quality: 5, architecture: 0, stability: 3, efficiency: 2,
  collaboration: 0, security_aware: 8, test_coverage: -2, growth_velocity: -5,
  ui_quality: 0, responsive: -3, automation: 0, monitoring: 2, doc_quality: -5,
  modeling: 0, experiment_efficiency: 3, test_design: 5, coverage: 0,
};

export const ALL_LEVELS: Level[] = [
  'D3','D2','D1',
  'E3','E2','E1',
  'F3','F2','F1',
  'G3','G2','G1',
];

/** 获取某角色某级别的标准阈值向量 */
export function getRoleStandard(role: Role, level: Level): Record<string, number> {
  const config = roleConfigs.find((r) => r.key === role);
  if (!config) return {};
  const base = LEVEL_BASE[level] || 60;
  const result: Record<string, number> = {};
  for (const dim of config.dimensions) {
    const offset = DIMENSION_OFFSET[dim] || 0;
    result[dim] = Math.min(100, Math.max(0, base + offset));
  }
  return result;
}

/** 完整标准表（管理页用）*/
export const roleStandards: Record<Role, Record<Level, Record<string, number>>> = {
  frontend: Object.fromEntries(ALL_LEVELS.map((l) => [l, getRoleStandard('frontend', l)])) as Record<Level, Record<string, number>>,
  backend: Object.fromEntries(ALL_LEVELS.map((l) => [l, getRoleStandard('backend', l)])) as Record<Level, Record<string, number>>,
  devops: Object.fromEntries(ALL_LEVELS.map((l) => [l, getRoleStandard('devops', l)])) as Record<Level, Record<string, number>>,
  algorithm: Object.fromEntries(ALL_LEVELS.map((l) => [l, getRoleStandard('algorithm', l)])) as Record<Level, Record<string, number>>,
  qa: Object.fromEntries(ALL_LEVELS.map((l) => [l, getRoleStandard('qa', l)])) as Record<Level, Record<string, number>>,
};

// ============ Git 仓库管理 mock 数据 ============
export interface RepoItem {
  id: string;
  name: string;
  path: string;
  sourceType: 'remote';
  provider?: 'github' | 'gitlab' | 'gitee' | 'gitea' | 'bitbucket' | 'generic';
  remoteUrl?: string;
  branch: string;
  teamId: string;
  projectId?: string;
  status: 'synced' | 'syncing' | 'failed';
  lastSync: string;
  commits: number;
  contributors: number;
}

export const repoList: RepoItem[] = [
  { id: 'r1', name: '用户中心', path: '/data/repos/user-center', sourceType: 'remote', provider: 'gitlab', remoteUrl: 'https://gitlab.example.com/platform/user-center.git', branch: 'main', teamId: 't1', projectId: 'p1', status: 'synced', lastSync: '2分钟前', commits: 1847, contributors: 4 },
  { id: 'r2', name: '订单系统', path: '/data/repos/order-sys', sourceType: 'remote', provider: 'github', remoteUrl: 'https://github.com/acme/order-system.git', branch: 'main', teamId: 't2', projectId: 'p2', status: 'synced', lastSync: '1小时前', commits: 3214, contributors: 6 },
  { id: 'r3', name: '数据网关', path: '/data/repos/data-gateway', sourceType: 'remote', provider: 'gitee', remoteUrl: 'https://gitee.com/acme/data-gateway.git', branch: 'develop', teamId: 't4', projectId: 'p3', status: 'synced', lastSync: '3小时前', commits: 2456, contributors: 7 },
  { id: 'r4', name: '支付平台', path: '/data/repos/payment', sourceType: 'remote', provider: 'gitlab', remoteUrl: 'https://gitlab.example.com/data/payment.git', branch: 'main', teamId: 't4', projectId: 'p4', status: 'syncing', lastSync: '同步中', commits: 4102, contributors: 4 },
  { id: 'r5', name: '内容引擎', path: '/data/repos/content-engine', sourceType: 'remote', provider: 'github', remoteUrl: 'https://github.com/acme/content-engine.git', branch: 'main', teamId: 't3', projectId: 'p5', status: 'synced', lastSync: '4小时前', commits: 2891, contributors: 5 },
  { id: 'r6', name: '搜索中台', path: '/data/repos/search', sourceType: 'remote', provider: 'generic', remoteUrl: 'https://git.example.com/search.git', branch: 'main', teamId: 't4', projectId: 'p6', status: 'failed', lastSync: '2天前', commits: 1567, contributors: 3 },
];

// ============ 大模型配置 mock 数据 ============
export interface ModelProvider {
  key: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  status: 'connected' | 'unconfigured';
  models: string[];
}

export const modelProviders: ModelProvider[] = [
  { key: 'openai', name: 'OpenAI', apiKey: 'sk-****...****8a3f', baseUrl: 'https://api.openai.com/v1', status: 'connected', models: ['gpt-4o', 'gpt-4o-mini', 'text-embedding-3-large'] },
  { key: 'anthropic', name: 'Anthropic', apiKey: 'sk-ant-****...****2b7c', baseUrl: 'https://api.anthropic.com', status: 'connected', models: ['claude-sonnet-4', 'claude-opus-4'] },
  { key: 'custom', name: '自定义（兼容 API）', apiKey: '', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', status: 'unconfigured', models: [] },
];

export interface TaskRoute {
  task: string;
  provider: string;
  model: string;
  desc: string;
}

export const taskRoutes: TaskRoute[] = [
  { task: '代码审查', provider: 'Anthropic', model: 'claude-sonnet-4', desc: 'PR diff 分析 + 5 维评分' },
  { task: '安全审计', provider: 'OpenAI', model: 'gpt-4o', desc: '漏洞检测 + 密钥扫描' },
  { task: '文档生成', provider: 'Anthropic', model: 'claude-sonnet-4', desc: '模块文档 + 类 DeepWiki' },
  { task: '评论评估', provider: 'OpenAI', model: 'gpt-4o-mini', desc: 'Review 质量打分' },
];

// ============ 向量模型配置 mock 数据 ============
export interface VectorCollection {
  name: string;
  vectors: number;
  size: string;
  dimension: number;
}

export const vectorCollections: VectorCollection[] = [
  { name: 'user-center-code', vectors: 18432, size: '128 MB', dimension: 1024 },
  { name: 'order-sys-code', vectors: 32104, size: '256 MB', dimension: 1024 },
  { name: 'data-gateway-code', vectors: 24560, size: '198 MB', dimension: 1024 },
  { name: 'payment-code', vectors: 41002, size: '340 MB', dimension: 1024 },
];

export const embeddingModels = [
  { name: 'bge-m3 (本地)', dimension: 1024, status: 'active' },
  { name: 'text-embedding-3-large (OpenAI)', dimension: 3072, status: 'inactive' },
  { name: '自定义', dimension: 0, status: 'inactive' },
];

// ============ 代码图谱 mock 数据 ============
export const graphModules = [
  { id: 'api-gateway', label: 'api-gateway', layer: 'edge', x: 50, y: 12, loc: '8.2k', health: 88 },
  { id: 'auth', label: 'auth-service', layer: 'service', x: 22, y: 34, loc: '5.1k', health: 84 },
  { id: 'order', label: 'order-service', layer: 'service', x: 50, y: 38, loc: '12.4k', health: 79 },
  { id: 'payment', label: 'payment-core', layer: 'service', x: 78, y: 34, loc: '9.7k', health: 91 },
  { id: 'user', label: 'user-repo', layer: 'data', x: 20, y: 66, loc: '3.4k', health: 82 },
  { id: 'ledger', label: 'ledger-store', layer: 'data', x: 52, y: 72, loc: '6.8k', health: 74 },
  { id: 'cache', label: 'cache-layer', layer: 'data', x: 80, y: 66, loc: '2.1k', health: 90 },
  { id: 'mq', label: 'event-bus', layer: 'infra', x: 50, y: 90, loc: '4.3k', health: 86 },
];

export const graphEdges = [
  { source: 'api-gateway', target: 'auth' },
  { source: 'api-gateway', target: 'order' },
  { source: 'api-gateway', target: 'payment' },
  { source: 'auth', target: 'user' },
  { source: 'order', target: 'ledger' },
  { source: 'order', target: 'payment' },
  { source: 'order', target: 'cache' },
  { source: 'payment', target: 'ledger' },
  { source: 'payment', target: 'cache' },
  { source: 'ledger', target: 'mq' },
  { source: 'order', target: 'mq' },
];

export const layerColors: Record<string, string> = {
  edge: 'var(--chart-1)',
  service: 'var(--chart-2)',
  data: 'var(--chart-3)',
  infra: 'var(--chart-4)',
};

// ============ 团队分析模型 mock（技能矩阵 / 冰山 / SWOT / 招聘建议 / 趋势预测）============
// 以「业务中台组」为样板，保证 mock 模式下 5 个 tab 均有完整可信展示。

export function mockTeamForecast(teamId: string): TeamForecast {
  return {
    teamId,
    teamName: '业务中台组',
    onlyObserved: false,
    dimensions: ['code_quality', 'architecture', 'stability', 'efficiency', 'collaboration', 'security_aware', 'test_coverage'],
    dimensionScores: { code_quality: 88, architecture: 85, stability: 87, efficiency: 84, collaboration: 88, security_aware: 82, test_coverage: 86 },
    observations: [
      { period: '2月', score: 79 },
      { period: '3月', score: 81 },
      { period: '4月', score: 82 },
      { period: '5月', score: 84 },
      { period: '6月', score: 85 },
      { period: '7月', score: 86 },
    ],
    forecast: [
      { period: 'T+1', score: 87, trend: 'up' },
      { period: 'T+2', score: 88, trend: 'up' },
      { period: 'T+3', score: 88, trend: 'stable' },
      { period: 'T+4', score: 89, trend: 'up' },
    ],
    model: 'linear-regression',
  };
}

const TEAM_DIM_LABELS: Record<string, string> = {
  code_quality: '代码质量', architecture: '架构能力', stability: '稳定性',
  efficiency: '交付效率', collaboration: '协作能力', security_aware: '安全意识', test_coverage: '测试覆盖',
};

export function mockTeamSkillsMatrix(teamId: string): SkillsMatrix {
  const dimensions = ['code_quality', 'architecture', 'stability', 'efficiency', 'collaboration', 'security_aware', 'test_coverage'];
  const members: SkillsMatrixMember[] = [
    { id: 'tm-1', name: '林涛', role: '技术专家', level: 'D2', scores: { code_quality: 92, architecture: 90, stability: 88, efficiency: 86, collaboration: 90, security_aware: 85, test_coverage: 88 } },
    { id: 'tm-2', name: '陈航', role: '高级工程师', level: 'E2', scores: { code_quality: 88, architecture: 84, stability: 85, efficiency: 87, collaboration: 86, security_aware: 80, test_coverage: 84 } },
    { id: 'tm-3', name: '周明', role: '高级工程师', level: 'E3', scores: { code_quality: 90, architecture: 88, stability: 86, efficiency: 85, collaboration: 88, security_aware: 83, test_coverage: 87 } },
    { id: 'tm-4', name: '赵婷', role: '高级工程师', level: 'E1', scores: { code_quality: 86, architecture: 82, stability: 88, efficiency: 84, collaboration: 89, security_aware: 84, test_coverage: 85 } },
    { id: 'tm-5', name: '刘宇', role: '工程师', level: 'F3', scores: { code_quality: 84, architecture: 78, stability: 82, efficiency: 86, collaboration: 85, security_aware: 76, test_coverage: 80 } },
    { id: 'tm-6', name: '李娜', role: '工程师', level: 'F2', scores: { code_quality: 82, architecture: 76, stability: 84, efficiency: 83, collaboration: 87, security_aware: 78, test_coverage: 82 } },
    { id: 'tm-7', name: '张敏', role: '工程师', level: 'F2', scores: { code_quality: 80, architecture: 74, stability: 80, efficiency: 82, collaboration: 86, security_aware: 72, test_coverage: 78 } },
    { id: 'tm-8', name: '孙磊', role: '工程师', level: 'F1', scores: { code_quality: 78, architecture: 72, stability: 76, efficiency: 80, collaboration: 84, security_aware: 70, test_coverage: 74 } },
  ];
  const teamAverage: Record<string, number> = {};
  for (const dim of dimensions) {
    const vals = members.map((m) => m.scores[dim]).filter((v): v is number => typeof v === 'number');
    teamAverage[dim] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return {
    teamId,
    teamName: '业务中台组',
    dimensions,
    dimensionLabels: { ...TEAM_DIM_LABELS },
    members,
    teamAverage,
    memberCount: members.length,
  };
}

export function mockTeamIceberg(teamId: string): Iceberg {
  return {
    teamId,
    teamName: '业务中台组',
    explicit: [
      { label: '代码质量', score: 88, description: '8 名成员有效数据' },
      { label: '协作能力', score: 88, description: '8 名成员有效数据' },
      { label: '稳定性', score: 87, description: '8 名成员有效数据' },
      { label: '架构能力', score: 85, description: '8 名成员有效数据' },
      { label: '交付效率', score: 84, description: '8 名成员有效数据' },
    ],
    implicit: [
      { label: '提交节奏稳定性', score: 78, value: 0.87, unit: '占比', benchmark: 0.8, description: '样本 8 人' },
      { label: '代码审查参与度', score: 75, value: 4.2, unit: '次/PR', benchmark: 3.5, description: '样本 8 人' },
      { label: '协作响应时长', score: 72, value: 2.1, unit: '小时', benchmark: 3.0, description: '样本 8 人' },
      { label: '变更回滚率', score: 68, value: 0.05, unit: '比例', benchmark: 0.08, description: '样本 8 人' },
    ],
    memberCount: 8,
  };
}

export function mockTeamSwot(teamId: string): SwotResult {
  return {
    teamId,
    teamName: '业务中台组',
    swot: {
      strengths: [
        '订单系统健康度 90 分，交付效率与代码质量双高，交易核心链路稳固',
        'Bus Factor 4，关键模块知识备份充分，无单点风险',
        '协作能力维度 88 分，跨职能响应在 6 个团队中领先',
      ],
      weaknesses: [
        '架构能力 85 分略低于头部团队，分布式纵深不足',
        '安全意识 82 分，支付相关模块防护待加固',
        '新人（F1-F2 职级）架构维度均分 74，承接核心模块需培养周期',
      ],
      opportunities: [
        '交易量增长可推动容量规划与架构升级，沉淀中台能力',
        '可复用订单系统的工程实践向搜索中台输出',
        '引入安全门禁后预期安全维度 3 期内提升至 88+',
      ],
      threats: [
        '支付平台技术债 45 分，若不治理将向交易链路传导',
        '竞品交易链路升级，架构纵深不足可能影响迭代速度',
        'F1-F3 工程师占比偏高，骨干流失会拉低整体均分',
      ],
    },
  };
}

export function mockTeamHiringAdvice(teamId: string): HiringAdvice {
  return {
    teamId,
    teamName: '业务中台组',
    summary: '业务中台组整体能力均衡（均分 86），订单系统健康度 90 分表现突出；但架构能力（85）与安全意识（82）相对薄弱，随交易链路复杂度上升，需补充架构纵深与安全专项能力。',
    positions: [
      {
        role: '高级后端架构师',
        priority: 'high',
        headcount: 1,
        reason: '订单系统架构能力 85，随交易量增长需加强分布式架构与容量规划纵深，现有 E3 以上骨干仅 3 人。',
        skills: ['分布式架构', 'Java/Kotlin', '高并发设计', '容量规划', '分布式事务'],
      },
      {
        role: '应用安全工程师',
        priority: 'medium',
        headcount: 1,
        reason: '安全意识维度 82，支付与交易链路需专项安全审查与防护加固，当前无专职安全岗。',
        skills: ['应用安全', 'OWASP Top10', '代码审计', '密钥管理', 'API 安全'],
      },
    ],
    internalTraining: [
      {
        direction: '测试覆盖向 90+ 冲刺',
        reason: '测试覆盖维度 86 已达标，可由林涛带教张敏/孙磊向 90+ 提升，无需外招测试岗。',
      },
    ],
  };
}
