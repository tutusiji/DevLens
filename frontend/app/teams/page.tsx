/**
 * ④ 团队分析
 * 顶部全团队对比（雷达 + 柱状）+ 团队卡 + 能力缺口矩阵
 * 默认所有团队亮起，点击切换显示/隐藏
 */
'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Users, AlertTriangle, BusIcon, Network, Eye, EyeOff, UserPlus, Loader2, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageHeader, staggerContainer, cardItem } from '@/components/widgets';
import { CapabilityRadar, GroupedBars } from '@/components/charts';
import { ForecastCard } from '@/components/forecast-card';
import { api } from '@/lib/api';
import { scoreColor } from '@/lib/utils';
import type { Team, CapabilityGap, TeamForecast } from '@/lib/types';

const CAPABILITY_LABELS: Record<string, string> = {
  code_quality: '代码质量', architecture: '架构能力', stability: '稳定性',
  efficiency: '交付效率', collaboration: '协作能力', security_aware: '安全意识', test_coverage: '测试覆盖',
};

const DIM_KEYS = Object.keys(CAPABILITY_LABELS);

// 6 个团队 6 种颜色
const TEAM_COLORS = [
  '#6366f1', // indigo
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#ec4899', // pink
  '#10b981', // emerald
  '#8b5cf6', // violet
];

export default function TeamsPage() {
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [gaps, setGaps] = React.useState<CapabilityGap[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sortBy, setSortBy] = React.useState('avgScore');
  // 默认所有团队都亮
  const [hiddenTeams, setHiddenTeams] = React.useState<Set<string>>(new Set());
  // P5：招聘建议弹窗
  const [adviceTeam, setAdviceTeam] = React.useState<Team | null>(null);
  const [advice, setAdvice] = React.useState('');
  const [adviceLoading, setAdviceLoading] = React.useState(false);
  const [adviceError, setAdviceError] = React.useState('');
  const [teamForecast, setTeamForecast] = React.useState<TeamForecast | null>(null);
  const [forecastLoading, setForecastLoading] = React.useState(false);

  React.useEffect(() => {
    Promise.all([api.getTeams(), api.getCapabilityGaps()]).then(([t, g]) => {
      setTeams(t); setGaps(g); setLoading(false);
    });
  }, []);

  const sorted = React.useMemo(() => {
    return [...teams].sort((a, b) => {
      if (sortBy === 'avgScore') return b.avgScore - a.avgScore;
      if (sortBy === 'busFactor') return a.busFactor - b.busFactor;
      if (sortBy === 'riskCount') return b.riskCount - a.riskCount;
      if (sortBy === 'members') return b.members - a.members;
      return 0;
    });
  }, [teams, sortBy]);

  // 活跃团队 = 未被隐藏的
  const activeTeams = React.useMemo(() => 
    teams.filter((t) => !hiddenTeams.has(t.id)), 
  [teams, hiddenTeams]);

  const toggleTeam = (id: string) => {
    setHiddenTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openHiringAdvice = async (team: Team) => {
    setAdviceTeam(team);
    setAdvice('');
    setAdviceError('');
    setTeamForecast(null);
    setAdviceLoading(true);
    setForecastLoading(true);
    api.getTeamHiringAdvice(team.id)
      .then((res) => setAdvice(res.advice))
      .catch((e) => setAdviceError(e instanceof Error ? e.message : '生成招聘建议失败'))
      .finally(() => setAdviceLoading(false));
    api.getTeamForecast(team.id)
      .then((fc) => setTeamForecast(fc))
      .catch(() => setTeamForecast(null))
      .finally(() => setForecastLoading(false));
  };

  // 雷达图 series
  const radarSeries = React.useMemo(() => {
    return activeTeams.map((team, index) => {
      const colorIdx = teams.findIndex((t) => t.id === team.id);
      return {
        name: team.name,
        data: Object.fromEntries(
          Object.entries(team.capability).map(([key, value]) => [CAPABILITY_LABELS[key], value])
        ),
        color: TEAM_COLORS[colorIdx % TEAM_COLORS.length],
      };
    });
  }, [activeTeams, teams]);

  // 柱状图数据：每个能力维度一组柱子
  const barData = React.useMemo(() => {
    return DIM_KEYS.map((key) => {
      const row: Record<string, string | number> = { dimension: CAPABILITY_LABELS[key] };
      activeTeams.forEach((team) => {
        row[team.name] = team.capability[key as keyof Team['capability']] as number;
      });
      return row;
    });
  }, [activeTeams]);

  const barSeries = React.useMemo(() => {
    return activeTeams.map((team) => {
      const colorIdx = teams.findIndex((t) => t.id === team.id);
      return {
        key: team.name,
        name: team.name,
        color: TEAM_COLORS[colorIdx % TEAM_COLORS.length],
      };
    });
  }, [activeTeams, teams]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton rounded" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-96 skeleton rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="团队分析" description="从个人能力聚合团队画像，识别 Bus Factor 与能力缺口" />

      {/* ============ 顶部：全团队对比 ============ */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" />
                全团队能力对比
              </CardTitle>
              <CardDescription className="mt-1">
                点击下方标签切换团队显示 · 当前 {activeTeams.length}/{teams.length} 个团队参与对比
              </CardDescription>
            </div>
          </div>
          {/* 团队切换标签 */}
          <div className="mt-4 flex flex-wrap gap-2">
            {teams.map((team, index) => {
              const isActive = !hiddenTeams.has(team.id);
              const color = TEAM_COLORS[index % TEAM_COLORS.length];
              return (
                <button
                  key={team.id}
                  onClick={() => toggleTeam(team.id)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-muted/40 text-foreground' 
                      : 'bg-transparent text-muted-foreground/50 hover:text-muted-foreground'
                  }`}
                  style={isActive ? { boxShadow: `inset 0 0 0 1px ${color}40` } : {}}
                >
                  <span
                    className="h-3 w-3 rounded-full transition-all"
                    style={{
                      background: isActive ? color : 'transparent',
                      boxShadow: isActive ? `0 0 8px ${color}80` : `inset 0 0 0 1px ${color}60`,
                    }}
                  />
                  <span className="font-medium">{team.name}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{team.avgScore}</span>
                  {isActive ? <Eye className="h-3 w-3 text-muted-foreground/60" /> : <EyeOff className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
          {activeTeams.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              所有团队已隐藏，点击上方标签恢复显示
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-3">
                  <h3 className="text-sm font-medium">能力轮廓</h3>
                  <p className="text-xs text-muted-foreground">多团队叠加，形状越饱满说明能力越均衡</p>
                </div>
                <CapabilityRadar series={radarSeries} height={340} />
              </div>
              <div className="min-w-0">
                <div className="mb-3">
                  <h3 className="text-sm font-medium">逐维对比</h3>
                  <p className="text-xs text-muted-foreground">每个维度并排比较，直观看强弱项</p>
                </div>
                <GroupedBars data={barData} xKey="dimension" series={barSeries} height={340} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============ 团队卡片墙 ============ */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((team) => {
          const colorIdx = teams.findIndex((t) => t.id === team.id);
          const color = TEAM_COLORS[colorIdx % TEAM_COLORS.length];
          const isActive = !hiddenTeams.has(team.id);
          return (
            <motion.div key={team.id} variants={cardItem}>
              <Card
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isActive ? '' : 'opacity-50 grayscale'
                }`}
                onClick={() => toggleTeam(team.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full transition-all"
                          style={{
                            background: isActive ? color : 'transparent',
                            boxShadow: isActive ? `0 0 8px ${color}80` : `inset 0 0 0 1px ${color}60`,
                          }}
                        />
                        {team.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Users className="h-3 w-3" />
                        <span className="font-mono tabular-nums">{team.members}</span> 人
                        <span>·</span>
                        均分 <span className="font-mono tabular-nums" style={{ color: scoreColor(team.avgScore) }}>{team.avgScore}</span>
                      </CardDescription>
                    </div>
                    {team.riskCount > 0 && (
                      <Badge variant="danger"><AlertTriangle className="h-3 w-3" />{team.riskCount}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Bus Factor */}
                  <div className="mb-3 flex items-center justify-between rounded-xl bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <BusIcon className="h-5 w-5 text-warning" />
                      <div>
                        <div className="text-xs text-muted-foreground">Bus Factor</div>
                        <div className="text-xs text-muted-foreground/70">关键人流失阈值</div>
                      </div>
                    </div>
                    <span
                      className="font-mono text-3xl font-bold tabular-nums"
                      style={{ color: team.busFactor <= 2 ? 'var(--destructive)' : team.busFactor <= 3 ? 'var(--warning)' : 'var(--success)' }}
                    >
                      {team.busFactor}
                    </span>
                  </div>
                  {/* 雷达图 */}
                  <CapabilityRadar
                    series={[{
                      name: team.name,
                      data: Object.fromEntries(
                        Object.entries(team.capability).map(([k, v]) => [CAPABILITY_LABELS[k], v])
                      ),
                      color: color,
                    }]}
                    height={200}
                  />
                  <div className="mt-2 text-center text-[10px] text-muted-foreground">
                    {isActive ? '点击隐藏对比' : '点击恢复对比'}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={(e) => { e.stopPropagation(); void openHiringAdvice(team); }}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    生成招聘建议
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ============ 招聘建议弹窗（P5） ============ */}
      {adviceTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAdviceTeam(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{adviceTeam.name} · 招聘建议</h3>
                <p className="text-sm text-muted-foreground">基于团队能力缺口由 AI 生成</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setAdviceTeam(null)}><X className="h-4 w-4" /></Button>
            </div>

            {forecastLoading ? (
              <div className="mt-4 h-44 rounded-xl skeleton" />
            ) : teamForecast ? (
              <div className="mt-4">
                <ForecastCard projectId={teamForecast.teamId} observations={teamForecast.observations} forecast={teamForecast.forecast} model={teamForecast.model} />
              </div>
            ) : null}

            <div className="mt-4">
              {adviceLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在生成招聘建议…
                </div>
              ) : adviceError ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{adviceError}</p>
              ) : (
                <div className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/20 p-4 text-sm leading-relaxed">{advice}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ 能力缺口矩阵 ============ */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>能力缺口矩阵</CardTitle>
          <CardDescription>各团队当前能力与目标差距，及建设动作</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>能力维度</TableHead>
                <TableHead className="text-right">当前</TableHead>
                <TableHead className="text-right">目标</TableHead>
                <TableHead className="text-right">差距</TableHead>
                <TableHead>负责团队</TableHead>
                <TableHead>建设动作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gaps.map((gap) => {
                const diff = gap.target - gap.current;
                return (
                  <TableRow key={gap.capability}>
                    <TableCell className="font-medium">{CAPABILITY_LABELS[gap.capability] || gap.capability}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums" style={{ color: scoreColor(gap.current) }}>{gap.current}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{gap.target}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={diff > 20 ? 'danger' : diff > 10 ? 'warning' : 'secondary'} className="font-mono">-{diff}</Badge>
                    </TableCell>
                    <TableCell>{gap.owner}</TableCell>
                    <TableCell className="text-accent">{gap.action}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
