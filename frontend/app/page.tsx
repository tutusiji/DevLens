/**
 * 决策总览
 * 面向管理决策的组织健康、风险与执行信号工作台。
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FolderGit2, Users, Network, HeartPulse,
  AlertTriangle, ShieldAlert, BusFront, TrendingDown, Bug,
  RefreshCw, Activity, ChevronRight,
  GitCommit, Eye, Code2, TrendingUp, Minus, ArrowUpRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressBar, HealthHero, staggerContainer, cardItem } from '@/components/widgets';
import { AreaTrend } from '@/components/charts';
import { TrinityMatrix } from '@/components/trinity-matrix';
import { DerivationChain } from '@/components/derivation-chain';
import { api } from '@/lib/api';
import { cn, scoreColor } from '@/lib/utils';
import type { StatItem, TrinityMatrix as TrinityMatrixData, HealthTrendPoint, RiskAlert, DataSource, RiskLevel, ActiveProject, ActiveDeveloper, ActiveTeam, ActivityTrend } from '@/lib/types';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'folder-git-2': FolderGit2,
  users: Users,
  network: Network,
  'heart-pulse': HeartPulse,
};

const RISK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  skill_gap: ShieldAlert,
  bus_factor: BusFront,
  high_variance: TrendingDown,
  tech_debt: Bug,
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

export default function HomePage() {
  const [stats, setStats] = React.useState<StatItem[]>([]);
  const [matrix, setMatrix] = React.useState<TrinityMatrixData | null>(null);
  const [trend, setTrend] = React.useState<HealthTrendPoint[]>([]);
  const [risks, setRisks] = React.useState<RiskAlert[]>([]);
  const [sources, setSources] = React.useState<DataSource[]>([]);
  const [activeProjects, setActiveProjects] = React.useState<ActiveProject[]>([]);
  const [activeDevelopers, setActiveDevelopers] = React.useState<ActiveDeveloper[]>([]);
  const [activeTeams, setActiveTeams] = React.useState<ActiveTeam[]>([]);
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
    ]).then(([s, m, t, r, ds, ap, ad, at]) => {
      setStats(s);
      setMatrix(m);
      setTrend(t);
      setRisks(r);
      setSources(ds);
      setActiveProjects(ap);
      setActiveDevelopers(ad);
      setActiveTeams(at);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-48 skeleton" />
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="h-80 skeleton lg:col-span-7" />
          <div className="h-80 skeleton lg:col-span-5" />
        </div>
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 skeleton" />)}
        </div>
      </div>
    );
  }

  const orgHealth = stats.find((s) => s.label === '平均健康度')?.value || 78.4;
  const healthTrend = 3.2; /* 模拟趋势数据 */
  const highRiskCount = risks.filter((r) => r.level === 'high').length;
  const kpis = stats.filter((s) => s.label !== '平均健康度');

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="border-b border-border pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Activity className="h-4 w-4" />
              组织工程效能
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">决策总览</h1>
              <p className="mt-1 text-sm text-muted-foreground">项目 · 团队 · 人员三位一体评估，从 Git 仓库推导组织能力</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-2 border border-border bg-card px-3 py-2 text-muted-foreground">
              <span className="h-2 w-2 bg-success" aria-hidden="true" />
              数据更新于 2 分钟前
            </span>
            <button
              type="button"
              aria-label="刷新数据"
              className="inline-flex h-9 w-9 items-center justify-center border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <section aria-label="关键指标" className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border lg:grid-cols-4">
        {kpis.map((stat) => {
          const Icon = ICONS[stat.icon];
          const improving = stat.delta >= 0;
          const DeltaIcon = improving ? TrendingUp : TrendingDown;

          return (
            <div key={stat.label} className="bg-card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </div>
              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{stat.value}</span>
                {stat.unit && <span className="text-sm text-muted-foreground">{stat.unit}</span>}
              </div>
              <div className={cn('mt-2 flex items-center gap-1.5 text-xs', improving ? 'text-success' : 'text-destructive')}>
                <DeltaIcon className="h-3.5 w-3.5" />
                <span className="font-medium tabular-nums">{improving ? '+' : ''}{stat.delta}%</span>
                <span className="text-muted-foreground">较上月</span>
              </div>
            </div>
          );
        })}
      </section>

      <motion.section
        aria-label="优先决策事项"
        className="grid gap-4 lg:grid-cols-12 lg:gap-5"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={cardItem} className="lg:col-span-7">
          <HealthHero score={orgHealth} trend={healthTrend} target={85} />
        </motion.div>

        <motion.div variants={cardItem} className="lg:col-span-5">
          <Card className="h-full">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    风险预警
                  </CardTitle>
                  <CardDescription className="mt-1">优先处理影响组织稳定性的事项</CardDescription>
                </div>
                <Badge variant="danger">{highRiskCount} 高危</Badge>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {risks.slice(0, 4).map((risk) => {
                const RiskIcon = RISK_ICONS[risk.type] || AlertTriangle;
                const levelClass = risk.level === 'high'
                  ? 'border-l-destructive'
                  : risk.level === 'medium'
                    ? 'border-l-warning'
                    : 'border-l-muted-foreground';

                return (
                  <article key={risk.id} className={cn('border-l-4 px-4 py-3.5 sm:px-5', levelClass)}>
                    <div className="flex items-start gap-3">
                      <RiskIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-medium text-foreground">{risk.title}</h3>
                          <Badge variant={levelVariant(risk.level)} className="text-[10px]">
                            {risk.level === 'high' ? '高危' : risk.level === 'medium' ? '中危' : '低危'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{risk.time}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{risk.description}</p>
                        <p className="mt-1 text-xs font-medium text-foreground">建议：{risk.action}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </CardContent>
            <div className="border-t border-border p-3">
              <button type="button" className="flex w-full items-center justify-center gap-1.5 py-1 text-sm font-medium text-primary transition-colors hover:text-foreground">
                查看全部 {risks.length} 条
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </Card>
        </motion.div>
      </motion.section>

      <section aria-label="数据推导过程" className="border-y border-border py-4">
        <DerivationChain />
      </section>

      <motion.section
        aria-label="组织分析"
        className="grid gap-4 lg:grid-cols-12 lg:gap-5"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={cardItem} className="lg:col-span-8">
          <Card>
            <CardHeader className="border-b border-border">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-primary" />
                    三位一体评估矩阵
                  </CardTitle>
                  <CardDescription className="mt-1">点击单元格查看团队 × 项目详情</CardDescription>
                </div>
                <Badge variant="outline">团队 × 项目</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {matrix && <TrinityMatrix data={matrix} onSelect={() => {}} />}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardItem} className="lg:col-span-4">
          <Card className="h-full">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2">
                <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <ellipse cx="12" cy="13" rx="10" ry="5" />
                  <path d="M2.05 10.94A10.43 10.43 0 0 0 7.84" />
                  <path d="M21.95 10.94a10.43 10.43 0 0 1-4.21-4.21" />
                </svg>
                数据源覆盖率
              </CardTitle>
              <CardDescription>各数据源接入情况</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {sources.map((src) => (
                <div key={src.name}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span>{src.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">{src.coverage}%</span>
                      <Badge variant={src.status === 'connected' ? 'success' : src.status === 'partial' ? 'warning' : 'danger'}>
                        {src.status === 'connected' ? '已接入' : src.status === 'partial' ? '部分' : '未接入'}
                      </Badge>
                    </div>
                  </div>
                  <ProgressBar
                    value={src.coverage}
                    showValue={false}
                    indicatorClassName={src.coverage >= 90 ? 'bg-success' : src.coverage >= 60 ? 'bg-warning' : 'bg-destructive'}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardItem} className="lg:col-span-8">
          <Card>
            <CardHeader className="border-b border-border">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    健康度趋势
                  </CardTitle>
                  <CardDescription className="mt-1">质量 / 安全 / 健康度</CardDescription>
                </div>
                <div className="inline-flex w-fit border border-border bg-card p-1">
                  {['7天', '30天', '90天'].map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium transition-colors',
                        index === 1 ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </motion.div>
      </motion.section>

      <motion.section
        aria-labelledby="activity-ranking-title"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 id="activity-ranking-title" className="text-base font-semibold text-foreground">活跃榜单</h2>
            <p className="mt-1 text-sm text-muted-foreground">识别当前的项目、人员与团队投入</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
          <motion.div variants={cardItem}>
            <Card className="flex h-full flex-col">
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FolderGit2 className="h-5 w-5 text-primary" />
                    活跃项目
                  </CardTitle>
                  <Link href="/projects" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-foreground">
                    查看全部 <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
                <CardDescription>近 30 天 commits / contributors 综合排序</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 divide-y divide-border p-0">
                {activeProjects.map((project, index) => (
                  <Link key={project.id} href={`/projects/${project.id}`} className="block transition-colors hover:bg-muted/50">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{project.name}</span>
                          <Badge variant="outline" className="font-mono text-[10px]">{project.language}</Badge>
                        </div>
                        <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5"><GitCommit className="h-3.5 w-3.5" />{project.commits.toLocaleString()}</span>
                          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{project.contributors}</span>
                        </div>
                      </div>
                      <TrendBadge trend={project.trend} />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={cardItem}>
            <Card className="flex h-full flex-col">
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Code2 className="h-5 w-5 text-primary" />
                    活跃开发者
                  </CardTitle>
                  <Link href="/developers" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-foreground">
                    查看全部 <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
                <CardDescription>commits + reviews 综合活跃度排序</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 divide-y divide-border p-0">
                {activeDevelopers.slice(0, 4).map((dev, index) => (
                  <Link key={dev.id} href={`/developers/${dev.id}`} className="block transition-colors hover:bg-muted/50">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{dev.name}</span>
                          <Badge variant="secondary" className="text-[10px]">{dev.role}</Badge>
                        </div>
                        <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5"><GitCommit className="h-3.5 w-3.5" />{dev.commits}</span>
                          <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" />{dev.reviews}</span>
                        </div>
                      </div>
                      <TrendBadge trend={dev.trend} />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={cardItem}>
            <Card className="flex h-full flex-col">
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Network className="h-5 w-5 text-primary" />
                    活跃团队
                  </CardTitle>
                  <Link href="/teams" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-foreground">
                    查看全部 <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
                <CardDescription>团队规模 + 平均健康度综合排序</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 divide-y divide-border p-0">
                {activeTeams.slice(0, 3).map((team, index) => (
                  <Link key={team.id} href="/teams" className="block transition-colors hover:bg-muted/50">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <span className="truncate text-sm font-medium">{team.name}</span>
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{team.members} 人</span>
                          <span className="font-mono font-medium tabular-nums" style={{ color: scoreColor(team.score) }}>{team.score}</span>
                        </div>
                      </div>
                      <TrendBadge trend={team.trend} />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
