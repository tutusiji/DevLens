/**
 * ① 决策总览（首页）- Bento Grid 布局
 * 主角卡 + StatCard + 三位一体矩阵(可下钻) + 趋势(时间选择) + 风险 + 数据源 + 活跃榜单
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FolderGit2, Users, Network, HeartPulse,
  AlertTriangle, ShieldAlert, BusIcon, TrendingDown, Bug,
  RefreshCw, Activity, ChevronRight, Sparkles,
  GitCommit, Eye, Code2, TrendingUp, TrendingDown as TrendingDownIcon, Minus, ArrowUpRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { PageHeader, StatCard, ScoreRing, ProgressBar } from '@/components/widgets';
import { AreaTrend } from '@/components/charts';
import { TrinityMatrix } from '@/components/trinity-matrix';
import { api } from '@/lib/api';
import { scoreColor } from '@/lib/utils';
import type { StatItem, TrinityMatrix as TrinityMatrixData, HealthTrendPoint, RiskAlert, DataSource, RiskLevel, ActiveProject, ActiveDeveloper, ActiveTeam, ActivityTrend } from '@/lib/types';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'folder-git-2': FolderGit2,
  users: Users,
  network: Network,
  'heart-pulse': HeartPulse,
};

const RISK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  skill_gap: ShieldAlert,
  bus_factor: BusIcon,
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

function levelLabel(level: RiskLevel): string {
  return { high: '高危', medium: '中危', low: '低危' }[level];
}

const TREND_CONFIG: Record<ActivityTrend, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  up: { icon: TrendingUp, label: '上升', color: 'var(--success)' },
  down: { icon: TrendingDownIcon, label: '下降', color: 'var(--destructive)' },
  stable: { icon: Minus, label: '持平', color: 'var(--muted-foreground)' },
};

function TrendBadge({ trend }: { trend: ActivityTrend }) {
  const config = TREND_CONFIG[trend];
  const Icon = config.icon;
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: config.color }}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

type TimeRange = '7d' | '30d' | '90d';

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
  const [timeRange, setTimeRange] = React.useState<TimeRange>('30d');
  const [drillCell, setDrillCell] = React.useState<{ team: string; project: string; score: number; members: number; owner?: string } | null>(null);

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
      <div className="space-y-4">
        <div className="h-8 w-48 skeleton rounded" />
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 h-48 skeleton rounded-xl lg:col-span-5" />
          <div className="col-span-12 grid grid-cols-2 gap-4 lg:col-span-7">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-32 skeleton rounded-xl" />)}
          </div>
          <div className="col-span-12 h-96 skeleton rounded-xl" />
          <div className="col-span-12 h-64 skeleton rounded-xl lg:col-span-4" />
          <div className="col-span-12 h-64 skeleton rounded-xl lg:col-span-4" />
          <div className="col-span-12 h-64 skeleton rounded-xl lg:col-span-4" />
        </div>
      </div>
    );
  }

  const orgHealth = stats.find((s) => s.label === '平均健康度')?.value || 78.4;
  const highRiskCount = risks.filter((r) => r.level === 'high').length;

  return (
    <>
      <PageHeader
        title="决策总览"
        description="项目 · 团队 · 人员三位一体评估，从 Git 仓库推导组织能力"
        actions={
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-xs text-muted-foreground">数据更新于 2 分钟前</span>
            <RefreshCw className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
          </div>
        }
      />

      {/* ============ Bento Grid 布局 ============ */}
      <div className="grid grid-cols-12 gap-4">
        {/* 主角卡：组织健康度（2x2 大格） */}
        <Card className="col-span-12 row-span-1 lg:col-span-5 lg:row-span-2">
          <CardContent className="flex h-full flex-col items-center justify-center p-6">
            <div className="mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">组织健康度</span>
            </div>
            <ScoreRing score={orgHealth} size={180} stroke={12} label="综合评分" sublabel="近 30 天" />
            <div className="mt-4 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-success">↑</span>
                <span className="font-mono tabular-nums text-success">+3.2</span>
                <span className="text-muted-foreground">较上月</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">目标</span>
                <span className="font-mono tabular-nums">85.0</span>
              </div>
            </div>
            <div className="mt-3 w-full max-w-xs">
              <ProgressBar
                value={orgHealth}
                max={100}
                showValue={false}
                indicatorClassName={orgHealth >= 85 ? 'bg-success' : orgHealth >= 70 ? 'bg-warning' : 'bg-destructive'}
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>当前 {orgHealth.toFixed(1)}</span>
                <span>目标 85.0</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4 个 StatCard（收窄，2x2） */}
        {stats.filter((s) => s.label !== '平均健康度').map((s) => {
          const Icon = ICONS[s.icon];
          return (
            <div key={s.label} className="col-span-6 lg:col-span-3 lg:row-span-1">
              <StatCard
                label={s.label}
                value={s.value}
                unit={s.unit}
                delta={s.delta}
                trend={s.trend}
                icon={Icon}
              />
            </div>
          );
        })}

        {/* 三位一体矩阵（带下钻，大格） */}
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-primary" />
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
            {matrix && (
              <TrinityMatrix
                data={matrix}
                onSelect={(team, project, score) => {
                  // 找到对应 cell 数据
                  const ri = matrix.rows.indexOf(team);
                  const ci = matrix.cols.indexOf(project);
                  const cell = matrix.cells[ri]?.[ci];
                  if (cell) setDrillCell({ team, project, score, members: cell.members, owner: cell.owner });
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* 风险预警（紧凑列表，右侧） */}
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                风险预警
              </CardTitle>
              <Badge variant="danger">{highRiskCount} 高危</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {risks.slice(0, 4).map((risk) => {
              const RiskIcon = RISK_ICONS[risk.type] || AlertTriangle;
              return (
                <div
                  key={risk.id}
                  className="flex items-start gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted/40 cursor-pointer"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-destructive/10">
                    <RiskIcon className="h-3.5 w-3.5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium">{risk.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant={levelVariant(risk.level)} className="text-[10px] px-1.5 py-0">
                        {levelLabel(risk.level)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{risk.time}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <button className="flex w-full items-center justify-center gap-1 pt-1 text-xs text-primary hover:underline cursor-pointer">
              查看全部 {risks.length} 条
              <ChevronRight className="h-3 w-3" />
            </button>
          </CardContent>
        </Card>

        {/* 健康度趋势（底部宽格，带时间选择器） */}
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>健康度趋势</CardTitle>
                <CardDescription className="mt-1">质量 / 安全 / 健康度</CardDescription>
              </div>
              <Segmented
                size="sm"
                value={timeRange}
                onChange={setTimeRange}
                options={[
                  { value: '7d', label: '7天' },
                  { value: '30d', label: '30天' },
                  { value: '90d', label: '90天' },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent>
            <AreaTrend
              data={trend}
              xKey="month"
              series={[
                { key: 'quality', name: '代码质量', color: 'var(--chart-1)' },
                { key: 'security', name: '安全', color: 'var(--chart-2)', dashed: true },
                { key: 'health', name: '健康度', color: 'var(--chart-4)' },
              ]}
              height={240}
            />
          </CardContent>
        </Card>

        {/* 数据源覆盖率（右下） */}
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader>
            <CardTitle>数据源覆盖率</CardTitle>
            <CardDescription>各数据源接入情况</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sources.map((src) => (
              <div key={src.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{src.name}</span>
                  <Badge
                    variant={src.status === 'connected' ? 'success' : src.status === 'partial' ? 'warning' : 'danger'}
                    className="text-[10px] px-1.5 py-0"
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
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ============ 活跃榜单 ============ */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* 活跃项目 */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderGit2 className="h-4 w-4 text-primary" />
                活跃项目
              </CardTitle>
              <Link href="/projects" className="text-xs text-primary hover:underline">
                查看全部 <ArrowUpRight className="inline h-3 w-3" />
              </Link>
            </div>
            <CardDescription>近 30 天 commits / contributors 综合排序</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            {activeProjects.map((project, index) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5 transition-colors hover:bg-muted/40">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-muted font-mono text-[10px] text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{project.name}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">{project.language}</Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <GitCommit className="h-3 w-3" />
                        <span className="font-mono tabular-nums">{project.commits.toLocaleString()}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
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

        {/* 活跃开发者 */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Code2 className="h-4 w-4 text-primary" />
                活跃开发者
              </CardTitle>
              <Link href="/developers" className="text-xs text-primary hover:underline">
                查看全部 <ArrowUpRight className="inline h-3 w-3" />
              </Link>
            </div>
            <CardDescription>commits + reviews 综合活跃度排序</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            {activeDevelopers.map((dev, index) => (
              <Link key={dev.id} href={`/developers/${dev.id}`}>
                <div className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5 transition-colors hover:bg-muted/40">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-muted font-mono text-[10px] text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{dev.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{dev.role}</Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <GitCommit className="h-3 w-3" />
                        <span className="font-mono tabular-nums">{dev.commits}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span className="font-mono tabular-nums">{dev.reviews}</span>
                      </span>
                      <span className="truncate">{dev.team}</span>
                    </div>
                  </div>
                  <TrendBadge trend={dev.trend} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* 活跃团队 */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="h-4 w-4 text-primary" />
                活跃团队
              </CardTitle>
              <Link href="/teams" className="text-xs text-primary hover:underline">
                查看全部 <ArrowUpRight className="inline h-3 w-3" />
              </Link>
            </div>
            <CardDescription>团队规模 + 平均健康度综合排序</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            {activeTeams.map((team, index) => (
              <Link key={team.id} href="/teams">
                <div className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5 transition-colors hover:bg-muted/40">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-muted font-mono text-[10px] text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{team.name}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span className="font-mono tabular-nums">{team.members}</span> 人
                      </span>
                      <span className="flex items-center gap-1">
                        均分
                        <span className="font-mono tabular-nums" style={{ color: scoreColor(team.score) }}>{team.score}</span>
                      </span>
                    </div>
                  </div>
                  <TrendBadge trend={team.trend} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ============ 矩阵下钻抽屉 ============ */}
      <Sheet
        open={!!drillCell}
        onClose={() => setDrillCell(null)}
        title={drillCell ? `${drillCell.team} × ${drillCell.project}` : ''}
        description={drillCell ? `综合评分 ${drillCell.score} · ${drillCell.members} 人参与` : ''}
        width="md"
      >
        {drillCell && (
          <div className="space-y-5">
            {/* 评分概览 */}
            <div className="flex items-center gap-4 rounded-lg bg-muted/40 p-4">
              <ScoreRing score={drillCell.score} size={90} stroke={7} label="综合评分" />
              <div className="flex-1 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">参与人数</span>
                  <span className="font-mono tabular-nums">{drillCell.members}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">负责人</span>
                  <span className="font-medium">{drillCell.owner || '未指定'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">评估等级</span>
                  <Badge variant={drillCell.score >= 85 ? 'success' : drillCell.score >= 70 ? 'warning' : 'danger'}>
                    {drillCell.score >= 85 ? '优秀' : drillCell.score >= 70 ? '良好' : '风险'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* 成员贡献分布（模拟） */}
            <div>
              <h4 className="mb-2 text-sm font-medium">成员贡献分布</h4>
              <div className="space-y-2">
                {Array.from({ length: drillCell.members }).map((_, i) => {
                  const pct = Math.round(100 / (i + 2) * (drillCell.members - i) / drillCell.members);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/20" />
                      <span className="flex-1 text-sm">成员 {i + 1}</span>
                      <div className="w-24">
                        <ProgressBar value={pct} showValue={false} />
                      </div>
                      <span className="w-10 text-right font-mono text-xs tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 跳转按钮 */}
            <div className="flex gap-2 pt-2">
              <a
                href={`/projects`}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border py-2 text-sm hover:bg-muted cursor-pointer transition-colors"
              >
                查看项目详情
                <ChevronRight className="h-3 w-3" />
              </a>
              <a
                href={`/teams`}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border py-2 text-sm hover:bg-muted cursor-pointer transition-colors"
              >
                查看团队详情
                <ChevronRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
