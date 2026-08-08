/**
 * 决策总览 v3.0 - Bento Grid 去框化风格
 * Hero 主角区域 + 不对称网格布局
 * 三位一体热力图矩阵 + 风险预警色条卡片
 * 活跃榜单 2:1:1 不对称比例
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FolderGit2, Users, Network,
  AlertTriangle, ShieldAlert, BusFront, TrendingDown, Bug,
  RefreshCw, ChevronRight,
  GitCommit, Eye, Code2, TrendingUp, Minus, ArrowUpRight,
  Grid3x3, Activity,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader, OrganizationHealthSummary, ProgressBar, staggerContainer, cardItem } from '@/components/widgets';
import { AreaTrend } from '@/components/charts';
import { TrinityMatrix } from '@/components/trinity-matrix';
import { api } from '@/lib/api';
import { cn, scoreColor } from '@/lib/utils';
import type { StatItem, TrinityMatrix as TrinityMatrixData, HealthTrendPoint, RiskAlert, DataSource, RiskLevel, ActiveProject, ActiveDeveloper, ActiveTeam, ActivityTrend, ArchitectureDesign } from '@/lib/types';

const RISK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  skill_gap: ShieldAlert,
  bus_factor: BusFront,
  high_variance: TrendingDown,
  tech_debt: Bug,
};

const RISK_TYPE_LABEL: Record<string, string> = {
  skill_gap: '能力缺口',
  bus_factor: '关键人风险',
  high_variance: '能力失衡',
  tech_debt: '技术债',
};

function levelVariant(level: RiskLevel): 'danger' | 'warning' | 'secondary' {
  if (level === 'high') return 'danger';
  if (level === 'medium') return 'warning';
  return 'secondary';
}

const TREND_CONFIG: Record<ActivityTrend, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  up: { icon: TrendingUp, label: '上升', color: 'var(--success)' },
  down: { icon: TrendingDown, label: '下降', color: 'var(--destructive)' },
  stable: { icon: Minus, label: '持平', color: 'var(--muted-foreground)' },
};

function TrendBadge({ trend }: { trend: ActivityTrend }) {
  const config = TREND_CONFIG[trend];
  const Icon = config.icon;
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: config.color }}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function architectureCompleteness(design: ArchitectureDesign): number {
  if (design.analysisStatus !== 'ready') return 0;

  const layerCoverage = Math.min(design.layers.length / 4, 1);
  const componentCoverage = Math.min(design.components.length / 12, 1);
  const relationCoverage = Math.min(design.relations.length / 12, 1);
  const decisionCoverage = Math.min(design.decisions.length / 3, 1);

  return Math.round(
    (layerCoverage * 0.3 + componentCoverage * 0.25 + relationCoverage * 0.25 + decisionCoverage * 0.2) * 100,
  );
}

export default function HomePage() {
  const [stats, setStats] = React.useState<StatItem[]>([]);
  const [matrix, setMatrix] = React.useState<TrinityMatrixData | null>(null);
  const [trend, setTrend] = React.useState<HealthTrendPoint[]>([]);
  const [risks, setRisks] = React.useState<RiskAlert[]>([]);
  const [sources, setSources] = React.useState<DataSource[]>([]);
  const [activeProjects, setActiveProjects] = React.useState<ActiveProject[]>([]);
  const [activeDevelopers, setActiveDevelopers] = React.useState<ActiveDeveloper[]>([]);
  const [activeTeams, setActiveTeams] = React.useState<ActiveTeam[]>([]);
  const [architectureDesigns, setArchitectureDesigns] = React.useState<ArchitectureDesign[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      api.getOverview(),
      api.getTrinityMatrix(),
      api.getHealthTrend(),
      api.getRiskAlerts(),
      api.getDataSources(),
      api.getActiveProjects(),
      api.getActiveDevelopers(),
      api.getActiveTeams(),
      api.getArchitectureDesigns(),
    ]).then(([s, m, t, r, ds, ap, ad, at, architecture]) => {
      setStats(s);
      setMatrix(m);
      setTrend(t);
      setRisks(r);
      setSources(ds);
      setActiveProjects(ap);
      setActiveDevelopers(ad);
      setActiveTeams(at);
      setArchitectureDesigns(architecture.designs);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-56 skeleton rounded-2xl" />
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 h-96 skeleton rounded-2xl lg:col-span-5" />
          <div className="col-span-12 grid grid-cols-2 gap-4 lg:col-span-7">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 skeleton rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const orgHealth = stats.find((s) => s.label === '平均健康度')?.value ?? 0;
  const healthTrend = stats.find((s) => s.label === '平均健康度')?.delta ?? 0;
  const highRiskCount = risks.filter((r) => r.level === 'high').length;
  const projectStat = stats.find((s) => s.label === '接入项目');
  const developerStat = stats.find((s) => s.label === '开发者');
  const teamStat = stats.find((s) => s.label === '团队');
  const hasProjects = (projectStat?.value || 0) > 0;
  const readyArchitectureDesigns = architectureDesigns.filter((design) => design.analysisStatus === 'ready');
  const architectureCoverage = architectureDesigns.length
    ? Math.round((readyArchitectureDesigns.length / architectureDesigns.length) * 100)
    : 0;
  const architectureCompletenessAverage = readyArchitectureDesigns.length
    ? Math.round(readyArchitectureDesigns.reduce((sum, design) => sum + architectureCompleteness(design), 0) / readyArchitectureDesigns.length)
    : 0;

  return (
    <div className="overview-page">
      <div className="overview-page__ambient" aria-hidden="true" />
      <div className="overview-page__header">
        <div className="overview-page__eyebrow">DECISION OVERVIEW <span>·</span> ORGANIZATION SIGNALS</div>
        <PageHeader
          title="决策总览"
          description="项目 · 团队 · 人员三位一体评估，从 Git 仓库推导组织能力"
          compact
          actions={
            <div className="flex items-center gap-2 rounded-xl glass-light px-3 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="text-xs text-muted-foreground">数据更新于 2 分钟前</span>
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground transition-colors hover:text-foreground" />
            </div>
          }
        />
      </div>

      {/* ============ 决策摘要：健康度、风险、组织规模与架构覆盖 ============ */}
      <OrganizationHealthSummary
        score={orgHealth}
        trend={healthTrend}
        target={85}
        highRiskCount={highRiskCount}
        projectCount={projectStat?.value || 0}
        developerCount={developerStat?.value || 0}
        teamCount={teamStat?.value || 0}
        architectureReady={readyArchitectureDesigns.length}
        architectureTotal={architectureDesigns.length}
        architectureCompleteness={architectureCompletenessAverage}
        architectureCoverage={architectureCoverage}
        onArchitectureClick={() => { window.location.assign('/architecture-design'); }}
      />

      <motion.div
        className="mt-4 grid grid-cols-12 gap-4 lg:gap-5"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {/* 三位一体矩阵（带下钻，跨 8 列） */}
        <motion.div variants={cardItem} className="col-span-12 lg:col-span-8">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-primary" />
                    三位一体评估矩阵
                  </CardTitle>
                  <CardDescription className="mt-1">
                    点击单元格查看团队 × 项目详情
                  </CardDescription>
                </div>
                <Badge variant="outline">团队 × 项目</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {matrix && matrix.rows.length > 0 && matrix.cols.length > 0 ? (
                <TrinityMatrix
                  data={matrix}
                  onSelect={() => {}}
                />
              ) : (
                <EmptyState
                  icon={Grid3x3}
                  title="暂无团队与项目数据"
                  description="接入仓库并完成分析后，将自动生成团队 × 项目覆盖矩阵"
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 风险预警（紧凑列表，右侧 4 列） */}
        <motion.div variants={cardItem} className="col-span-12 lg:col-span-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  风险预警
                </CardTitle>
                <Badge variant="danger">{highRiskCount} 高危</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {risks.length === 0 ? (
                <EmptyState
                  icon={ShieldAlert}
                  title="暂无风险预警"
                  description={hasProjects ? '当前各项目运行平稳，暂无识别到的风险' : '接入项目并完成分析后将自动识别 Bus Factor、技术债与能力缺口'}
                  compact
                />
              ) : (
                <>
                  {risks.slice(0, 4).map((risk) => {
                    const RiskIcon = RISK_ICONS[risk.type] || AlertTriangle;
                    const barClass = risk.level === 'high' ? 'risk-bar-high' : risk.level === 'medium' ? 'risk-bar-medium' : 'risk-bar-low';
                    return (
                      <div
                        key={risk.id}
                        className={`flex items-start gap-3 rounded-2xl bg-muted/15 p-3 transition-all hover:bg-muted/25 cursor-pointer ${barClass}`}
                      >
                        <div className={cn(
                          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                          risk.level === 'high' ? 'bg-destructive/15' : risk.level === 'medium' ? 'bg-warning/15' : 'bg-muted/30'
                        )}>
                          <RiskIcon className={cn(
                            'h-5 w-5',
                            risk.level === 'high' ? 'text-destructive' : risk.level === 'medium' ? 'text-warning' : 'text-muted-foreground'
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{risk.title}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={levelVariant(risk.level)} className="text-[10px]">
                              {risk.level === 'high' ? '高危' : risk.level === 'medium' ? '中危' : '低危'}
                            </Badge>
                            <span className="text-xs text-muted-foreground/70">{risk.time}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <button className="flex w-full items-center justify-center gap-1.5 pt-2 text-sm text-primary hover:underline cursor-pointer transition-colors">
                    查看全部 {risks.length} 条
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 健康度趋势图（底部宽格，跨 8 列） */}
        <motion.div variants={cardItem} className="col-span-12 lg:col-span-8">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    健康度趋势
                  </CardTitle>
                  <CardDescription className="mt-1">质量 / 安全 / 健康度</CardDescription>
                </div>
                <div className="flex items-center gap-2 rounded-2xl glass-light px-1 py-1">
                  {['7天', '30天', '90天'].map((label, i) => (
                    <button
                      key={label}
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                        i === 1 ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {trend.length > 0 ? (
                <AreaTrend
                  data={trend}
                  xKey="month"
                  series={[
                    { key: 'quality', name: '代码质量', color: 'var(--primary)' },
                    { key: 'security', name: '安全', color: 'var(--secondary)', dashed: true },
                    { key: 'health', name: '健康度', color: 'var(--success)' },
                  ]}
                  height={260}
                />
              ) : (
                <EmptyState
                  icon={Activity}
                  title="暂无趋势数据"
                  description="完成项目分析后，将按月生成质量 / 安全 / 健康度趋势"
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 数据源覆盖率（右下，跨 4 列） */}
        <motion.div variants={cardItem} className="col-span-12 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <ellipse cx="12" cy="13" rx="10" ry="5" />
                  <path d="M2.05 10.94A10.43 10.43 0 0 0 7.84" />
                  <path d="M21.95 10.94a10.43 10.43 0 0 1-4.21-4.21" />
                </svg>
                数据源覆盖率
              </CardTitle>
              <CardDescription>各数据源接入情况</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sources.map((src) => (
                <div key={src.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{src.name}</span>
                    <Badge
                      variant={src.status === 'connected' ? 'success' : src.status === 'partial' ? 'warning' : 'danger'}
                    >
                      {src.status === 'connected' ? '已接入' : src.status === 'partial' ? '部分' : '未接入'}
                    </Badge>
                  </div>
                  <ProgressBar
                    value={src.coverage}
                    showValue={false}
                    indicatorClassName={
                      src.coverage >= 90 ? 'bg-success' : src.coverage >= 60 ? 'bg-warning' : 'bg-destructive'
                    }
                    glow
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* ============ 活跃榜单 ============ */}
      <motion.div
        className="mt-8 grid gap-4 lg:grid-cols-3"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {/* 活跃项目 */}
        <motion.div variants={cardItem}>
          <Card className="flex flex-col h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderGit2 className="h-5 w-5 text-primary" />
                  活跃项目
                </CardTitle>
                <Link href="/projects" className="text-sm text-primary hover:underline">
                  查看全部 <ArrowUpRight className="inline h-4 w-4" />
                </Link>
              </div>
              <CardDescription>近 30 天 commits / contributors 综合排序</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {activeProjects.length === 0 ? (
                <EmptyState icon={FolderGit2} title="暂无活跃项目" description="接入 Git 仓库后将自动汇总活跃项目" compact />
              ) : activeProjects.map((project, index) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="flex items-center gap-3 rounded-2xl p-3 transition-all hover:bg-muted/30">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/20 font-mono text-sm font-bold text-muted-foreground">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{project.name}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">{project.language}</Badge>
                      </div>
                      <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <GitCommit className="h-3.5 w-3.5" />
                          <span className="font-mono tabular-nums">{project.commits.toLocaleString()}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          <span className="font-mono tabular-nums">{project.contributors}</span>
                        </span>
                      </div>
                    </div>
                    <TrendBadge trend={project.trend} />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* 活跃开发者 */}
        <motion.div variants={cardItem}>
          <Card className="flex flex-col h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Code2 className="h-5 w-5 text-primary" />
                  活跃开发者
                </CardTitle>
                <Link href="/developers" className="text-sm text-primary hover:underline">
                  查看全部 <ArrowUpRight className="inline h-4 w-4" />
                </Link>
              </div>
              <CardDescription>commits + reviews 综合活跃度排序</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {activeDevelopers.length === 0 ? (
                <EmptyState icon={Code2} title="暂无活跃开发者" description="接入仓库后将按 commits + reviews 汇总活跃度" compact />
              ) : activeDevelopers.slice(0, 4).map((dev, index) => (
                <Link key={dev.id} href={`/developers/${dev.id}`}>
                  <div className="flex items-center gap-3 rounded-2xl p-3 transition-all hover:bg-muted/30">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted/20 font-mono text-sm font-bold text-muted-foreground">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{dev.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{dev.role}</Badge>
                      </div>
                      <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <GitCommit className="h-3.5 w-3.5" />
                          <span className="font-mono tabular-nums">{dev.commits}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5" />
                          <span className="font-mono tabular-nums">{dev.reviews}</span>
                        </span>
                      </div>
                    </div>
                    <TrendBadge trend={dev.trend} />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* 活跃团队 */}
        <motion.div variants={cardItem}>
          <Card className="flex flex-col h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Network className="h-5 w-5 text-primary" />
                  活跃团队
                </CardTitle>
                <Link href="/teams" className="text-sm text-primary hover:underline">
                  查看全部 <ArrowUpRight className="inline h-4 w-4" />
                </Link>
              </div>
              <CardDescription>团队规模 + 平均健康度综合排序</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {activeTeams.length === 0 ? (
                <EmptyState icon={Network} title="暂无活跃团队" description="创建团队并归属开发者后将自动汇总" compact />
              ) : activeTeams.slice(0, 3).map((team, index) => (
                <Link key={team.id} href="/teams">
                  <div className="flex items-center gap-3 rounded-2xl p-3 transition-all hover:bg-muted/30">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted/20 font-mono text-sm font-bold text-muted-foreground">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{team.name}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          <span className="font-mono tabular-nums">{team.members}</span> 人
                        </span>
                        <span className="font-mono tabular-nums font-medium" style={{ color: scoreColor(team.score) }}>{team.score}</span>
                      </div>
                    </div>
                    <TrendBadge trend={team.trend} />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
