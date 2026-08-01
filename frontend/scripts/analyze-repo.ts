#!/usr/bin/env tsx
/**
 * 真实 Git 仓库分析 -> 生成 ProjectDetail JSON
 * 用法:
 *   tsx scripts/analyze-repo.ts <repoUrlOrPath> <projectId> <projectName> [teamId] [branch]
 * 示例:
 *   tsx scripts/analyze-repo.ts https://gitee.com/dromara/forest.git p-forest forest t1 master
 *   tsx scripts/analyze-repo.ts /home/tutuos/CodeLab/calendar-task-manager p-cal "日历任务管理" t1 main
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Project,
  ProjectDetail,
  AIReviewInsight,
  ModuleRisk,
  FixPriority,
  ProjectDimension,
  ContributorRanking,
  DebtTrendPoint,
  ReviewCategory,
  InsightStatus,
} from '../lib/types';
import { collectGitMeta, sampleCoreFiles, type GitMeta } from './lib/git-collect';
import { chatJSON, llmModel } from './lib/llm';

const DATA_DIR = join(__dirname, '..', 'data', 'analyzed-projects');
const REPO_CACHE = '/tmp/devlens-repos';

const REVIEW_CATEGORIES: ReviewCategory[] = [
  'quality', 'security', 'performance', 'maintainability', 'architecture',
  'reliability', 'logic', 'complexity', 'configuration', 'dependency', 'testing', 'delivery',
];

function ensureRepo(
  repoUrlOrPath: string,
  name: string,
  branch: string,
): string {
  if (existsSync(repoUrlOrPath) && existsSync(join(repoUrlOrPath, '.git'))) {
    return repoUrlOrPath; // 本地仓库
  }
  const localPath = join(REPO_CACHE, name);
  execSync(`rm -rf ${JSON.stringify(localPath)}`, { stdio: 'ignore' });
  console.log(`▶ clone ${repoUrlOrPath} -> ${localPath}`);
  execSync(
    `git clone --quiet ${JSON.stringify(repoUrlOrPath)} ${JSON.stringify(localPath)}`,
    { stdio: 'inherit', timeout: 180000 },
  );
  if (branch && branch !== 'main' && branch !== 'master') {
    try {
      execSync(
        `git -C ${JSON.stringify(localPath)} checkout ${JSON.stringify(branch)}`,
        { stdio: 'ignore' },
      );
    } catch {
      // 分支不存在忽略
    }
  }
  return localPath;
}

interface LLMAnalysisResult {
  score: number;
  quality: number;
  security: number;
  debt: number;
  summary: string;
  dimensions: {
    label: string;
    score: number;
    benchmark: number;
    trend: 'up' | 'down' | 'stable';
    description: string;
  }[];
  aiInsights: Array<{
    title: string;
    module: string;
    category: ReviewCategory;
    severity: AIReviewInsight['severity'];
    riskScore: number;
    confidence: number;
    status: InsightStatus;
    filePath: string;
    symbol?: string;
    startLine?: number;
    endLine?: number;
    evidence: string;
    codeExcerpt?: string;
    impact: string;
    action: string;
    verification: string;
  }>;
  moduleRisks: Array<{
    name: string;
    path: string;
    score: number;
    severity: ModuleRisk['severity'];
    issueCount: number;
    complexity: number;
    debtLoad: number;
    owner?: string;
    ownership: number;
    categories: { category: ReviewCategory; count: number }[];
  }>;
  fixPriorities: Array<{
    module: string;
    title: string;
    severity: FixPriority['severity'];
    priority: FixPriority['priority'];
    effort: string;
    impact: string;
    expectedGain: number;
    status: InsightStatus;
  }>;
}

async function analyze(
  meta: GitMeta,
  samples: { path: string; content: string }[],
  projectName: string,
): Promise<LLMAnalysisResult> {
  const gitStats = `仓库: ${projectName}
分支: ${meta.branch} @ ${meta.commitShort} (${meta.commitMessage})
总 commits: ${meta.totalCommits}
文件数: ${meta.fileCount} (代码文件 ${meta.codeFiles.length})
贡献者: ${meta.contributors.length} 人
核心贡献者: ${meta.contributors
    .slice(0, 5)
    .map((c) => `${c.name}(${c.commits} commits)`)
    .join(', ')}
语言: ${meta.languages
    .slice(0, 5)
    .map((l) => `${l.lang}:${l.count}`)
    .join(', ')}
模块:
  ${meta.modules
    .slice(0, 8)
    .map(
      (m) =>
        `${m.name}(文件${m.fileCount}/commits${m.commits}/复杂度${m.complexity}/主owner ${m.topOwner} ${m.topOwnerOwnership}%)`,
    )
    .join('\n  ')}`;

  const codeSamples = samples
    .map((s) => `--- ${s.path} ---\n${s.content}`)
    .join('\n\n');

  const prompt = `你是资深代码架构师，分析下面的真实 Git 仓库，输出严格 JSON（不要 markdown 代码块、不要解释文字）。

${gitStats}

抽样核心代码:
${codeSamples}

基于真实代码和 git 统计，生成项目评估报告。要求:
- aiInsights: 5-8 条基于真实代码的发现（安全/复杂度热点/最佳实践/配置问题等），filePath/symbol/行号尽量真实，evidence/action 具体，codeExcerpt 摘录关键代码
- moduleRisks: 对 top 模块评分（基于复杂度/owner 集中度/问题数）
- dimensions: 代码质量/安全性/测试覆盖/技术债/交付稳定性 5 维（0-100，benchmark 为组织均值）
- fixPriorities: 3-5 条修复建议（P0-P3）
- score/quality/security/debt: 综合分（0-100，debt 越低越好）

JSON schema:
{"score":number,"quality":number,"security":number,"debt":number,"summary":"一句话评价","dimensions":[{"label":string,"score":number,"benchmark":number,"trend":"up|down|stable","description":string}],"aiInsights":[{"title":string,"module":string,"category":string,"severity":"critical|high|medium|low|info","riskScore":number,"confidence":number,"status":"open|acknowledged|in_progress|resolved|accepted_risk|false_positive","filePath":string,"symbol":string,"startLine":number,"endLine":number,"evidence":string,"codeExcerpt":string,"impact":string,"action":string,"verification":string}],"moduleRisks":[{"name":string,"path":string,"score":number,"severity":"critical|high|medium|low","issueCount":number,"complexity":number,"debtLoad":number,"owner":string,"ownership":number,"categories":[{"category":string,"count":number}]}],"fixPriorities":[{"module":string,"title":string,"severity":"critical|high|medium|low","priority":"P0|P1|P2|P3","effort":string,"impact":string,"expectedGain":number,"status":"open|acknowledged|in_progress|resolved|accepted_risk|false_positive"}]}

category 枚举: ${REVIEW_CATEGORIES.join('|')}
只输出 JSON 对象。`;

  return chatJSON<LLMAnalysisResult>(
    [{ role: 'user', content: prompt }],
    16000,
  );
}

function buildProjectDetail(
  projectId: string,
  name: string,
  teamId: string,
  meta: GitMeta,
  result: LLMAnalysisResult,
): ProjectDetail {
  const lang = meta.languages[0]?.lang || 'unknown';
  const topContributor = meta.contributors[0];
  const secondContributor = meta.contributors[1];

  const contributorList: ContributorRanking[] = meta.contributors
    .slice(0, 8)
    .map((c, i) => ({
      name: c.name,
      username: c.email.split('@')[0] || c.name,
      commits: c.commits,
      reviews: Math.round(c.commits * 0.3),
      ownership: Math.min(
        85,
        Math.round((c.commits / Math.max(1, meta.totalCommits)) * 100 * 2),
      ) || (i === 0 ? 40 : 10),
    }));

  const insights: AIReviewInsight[] = result.aiInsights.map((ins, i) => ({
    id: `ins-${projectId}-${i + 1}`,
    type: ins.category,
    level:
      ins.severity === 'critical'
        ? 'critical'
        : ins.severity === 'high'
          ? 'warning'
          : 'info',
    source: 'AI Review + Git Analysis',
    firstSeenAt: meta.recentCommits[0]?.date?.slice(0, 10) || '2026-07',
    lastSeenAt: meta.recentCommits[0]?.date?.slice(0, 10) || '2026-07-31',
    codeExcerpt: ins.codeExcerpt,
    symbol: ins.symbol,
    startLine: ins.startLine,
    endLine: ins.endLine,
    assignee: topContributor?.name,
    ...ins,
    filePath: ins.filePath || '',
  })) as AIReviewInsight[];

  const moduleRisks: ModuleRisk[] = result.moduleRisks.map((m, i) => ({
    id: `mod-${projectId}-${i + 1}`,
    backupOwner: secondContributor?.name,
    owner:
      m.owner ||
      meta.modules.find((x) => x.name === m.name)?.topOwner ||
      topContributor?.name,
    lastChanged: meta.recentCommits[0]?.date?.slice(0, 10) || '最近',
    criticalCount: m.severity === 'critical' ? m.issueCount : 0,
    ...m,
  })) as ModuleRisk[];

  const fixPriorities: FixPriority[] = result.fixPriorities.map((f, i) => ({
    id: `fix-${projectId}-${i + 1}`,
    insightId: undefined,
    debt: Math.round((f.expectedGain || 1) * 3),
    dueDate: undefined,
    assignee: topContributor?.name,
    ...f,
  })) as FixPriority[];

  const reviewSummary = {
    total: insights.length,
    critical: insights.filter((i) => i.severity === 'critical').length,
    open: insights.filter((i) => i.status === 'open').length,
    newSinceLastScan: insights.filter((i) => i.status === 'open').length,
    inProgress: insights.filter((i) => i.status === 'in_progress').length,
    resolved: insights.filter((i) => i.status === 'resolved').length,
  };

  const analysisMeta = {
    branch: meta.branch,
    commit: meta.commitShort,
    analysisVersion: `${llmModel} · ${new Date().toISOString().slice(0, 7)}`,
    scannedAt: new Date().toISOString().slice(0, 10),
    coverage: Math.min(
      99,
      Math.round((meta.codeFiles.length / Math.max(1, meta.fileCount)) * 100),
    ),
    filesScanned: meta.codeFiles.length,
    confidence: 0.85,
  };

  const debtTrend: DebtTrendPoint[] = ['2月', '3月', '4月', '5月', '6月', '7月'].map(
    (month, i) => ({
      month,
      debt: Math.max(10, result.debt - i * 2),
      complexity: Math.max(20, 60 - i * 3),
    }),
  );

  const project: Project = {
    id: projectId,
    name,
    group: '开源分析',
    teamId,
    language: lang,
    score: result.score,
    quality: result.quality,
    security: result.security,
    debt: result.debt,
    status: 'completed',
    commits: meta.totalCommits,
    contributors: meta.contributors.length,
    lastAnalyzed: new Date().toISOString().slice(0, 10),
  };

  return {
    ...project,
    dimensions: result.dimensions as ProjectDimension[],
    aiInsights: insights,
    contributorList,
    debtTrend,
    fixPriorities,
    moduleRisks,
    reviewSummary,
    analysisMeta,
  };
}

function updateIndex(project: Project) {
  mkdirSync(DATA_DIR, { recursive: true });
  const indexPath = join(DATA_DIR, 'index.json');
  let list: Project[] = [];
  if (existsSync(indexPath)) {
    try {
      list = JSON.parse(readFileSync(indexPath, 'utf8'));
    } catch {
      // 损坏则重建
    }
  }
  list = list.filter((p) => p.id !== project.id);
  list.push(project);
  writeFileSync(indexPath, JSON.stringify(list, null, 2));
}

async function main() {
  const [repoUrlOrPath, projectId, projectName, teamId = 't1', branch = ''] =
    process.argv.slice(2);
  if (!repoUrlOrPath || !projectId || !projectName) {
    console.error(
      '用法: tsx scripts/analyze-repo.ts <repoUrlOrPath> <projectId> <projectName> [teamId] [branch]',
    );
    process.exit(1);
  }
  console.log(`▶ 分析 ${projectName} (${projectId})`);
  const repoPath = ensureRepo(repoUrlOrPath, projectId, branch);
  console.log('▶ 采集 git 元数据...');
  const meta = collectGitMeta(repoPath);
  console.log(
    `  commits=${meta.totalCommits} 贡献者=${meta.contributors.length} 文件=${meta.fileCount} 模块=${meta.modules.length}`,
  );
  const samples = sampleCoreFiles(repoPath, meta);
  console.log(
    `  抽样 ${samples.length} 个核心文件，LLM 分析中（deepseek-v4-pro）...`,
  );
  const result = await analyze(meta, samples, projectName);
  console.log(
    `  LLM 完成: score=${result.score}, insights=${result.aiInsights.length}, modules=${result.moduleRisks.length}`,
  );
  const detail = buildProjectDetail(projectId, projectName, teamId, meta, result);
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    join(DATA_DIR, `${projectId}.json`),
    JSON.stringify(detail, null, 2),
  );
  updateIndex(detail);
  console.log(
    `✓ 已写入 data/analyzed-projects/${projectId}.json + index.json`,
  );
}

main().catch((e) => {
  console.error('✗ 分析失败:', e);
  process.exit(1);
});
