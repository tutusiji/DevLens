/**
 * DevLens API 客户端
 * MVP 阶段：USE_MOCK=true 时直接返回 mock 数据
 * 后续：设 NEXT_PUBLIC_API_URL 后自动走真实接口，零改动切换
 */
import {
  overviewStats, trinityMatrix, healthTrend, riskAlerts, dataSources,
  projects, developers, teams, capabilityGaps, identityMatches,
  getDeveloperDetail, getProjectDetail, teamSpaces, teamGroups,
  activeProjects, activeDevelopers, activeTeams,
} from './mock-data';

import type {
  AnalysisRun, ProjectCreateRequest, ProjectDetail, RepositoryImportResult,
  TeamGroup, TeamSpace,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const USE_MOCK = !process.env.NEXT_PUBLIC_API_URL; // 未配置则用 mock

/** 真实 fetch 封装（后续启用） */
async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

/** mock 延迟模拟网络（让 skeleton 态可见） */
function mockDelay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

const mockRunStartedAt = new Map<string, number>();

export const api = {
  // 首页
  getOverview: () => mockDelay(overviewStats),
  getTrinityMatrix: () => mockDelay(trinityMatrix),
  getHealthTrend: () => mockDelay(healthTrend),
  getRiskAlerts: () => mockDelay(riskAlerts),
  getDataSources: () => mockDelay(dataSources),
  getActiveProjects: () => mockDelay(activeProjects),
  getActiveDevelopers: () => mockDelay(activeDevelopers),
  getActiveTeams: () => mockDelay(activeTeams),

  // 项目与仓库导入
  getProjects: () => mockDelay(projects),
  createProject: (body: ProjectCreateRequest): Promise<RepositoryImportResult> => {
    const repository = body.repoType === 'remote' ? body.repoUrl || '' : body.repoPath || '';
    const runId = `run-${Date.now()}`;
    mockRunStartedAt.set(runId, Date.now());
    const result: RepositoryImportResult = {
      projectId: 'p-new',
      runId,
      sourceType: body.repoType,
      provider: body.provider,
      repository,
      branch: body.branch,
      status: 'queued',
    };
    return USE_MOCK
      ? mockDelay(result)
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

  // 团队空间（UI-first mock 边界）
  getTeamSpaces: () => mockDelay(teamSpaces),
  getTeamGroups: (teamId: string) => mockDelay(teamGroups.filter((group) => group.teamId === teamId)),
  createTeamSpace: (body: Pick<TeamSpace, 'name' | 'description' | 'ownerId' | 'ownerName'>) =>
    USE_MOCK ? mockDelay({ id: `team-${Date.now()}`, status: 'active' as const, createdAt: '刚刚', updatedAt: '刚刚', memberIds: body.ownerId ? [body.ownerId] : [], projectIds: [], ...body }) : fetchAPI<TeamSpace>('/team-spaces', { method: 'POST', body: JSON.stringify(body) }),
  createTeamGroup: (body: Omit<TeamGroup, 'id' | 'memberIds' | 'projectIds'>) =>
    USE_MOCK ? mockDelay({ id: `group-${Date.now()}`, memberIds: [], projectIds: [], ...body }) : fetchAPI<TeamGroup>('/team-groups', { method: 'POST', body: JSON.stringify(body) }),

  // 开发者
  getDevelopers: () => mockDelay(developers),
  getDeveloperDetail: (id: string) => mockDelay(getDeveloperDetail(id)),

  // 团队
  getTeams: () => mockDelay(teams),
  getCapabilityGaps: () => mockDelay(capabilityGaps),

  // 项目详情
  getProjectDetail: (id: string) =>
    USE_MOCK ? mockDelay(getProjectDetail(id)) : fetchAPI<ProjectDetail | null>(`/projects/${id}`),

  // 接入
  getIdentityMatches: () => mockDelay(identityMatches),
};

export type Api = typeof api;
