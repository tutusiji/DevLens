/**
 * ④ 团队分析
 * 顶部全团队对比（雷达 + 柱状）+ 团队卡 + 能力缺口矩阵
 * 默认所有团队亮起，点击切换显示/隐藏
 */
'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Users, AlertTriangle, BusIcon, Network, Eye, EyeOff, UserPlus, Loader2, X, Grid3x3, Mountain, Compass } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageHeader, staggerContainer, cardItem } from '@/components/widgets';
import { CapabilityRadar, GroupedBars } from '@/components/charts';
import { ForecastCard } from '@/components/forecast-card';
import { api } from '@/lib/api';
import { scoreColor } from '@/lib/utils';
import type { Team, CapabilityGap, TeamForecast, SkillsMatrix, Iceberg, SwotResult } from '@/lib/types';

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

function scoreTone(score: number): string {
  if (score >= 80) return 'bg-success text-white';
  if (score >= 65) return 'bg-success/70 text-white';
  if (score >= 50) return 'bg-warning/70 text-foreground';
  if (score >= 35) return 'bg-destructive/60 text-white';
  return 'bg-destructive text-white';
}

/** 技能矩阵：成员 × 维度 热力表 */
function SkillsMatrixView({ data }: { data: SkillsMatrix }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{data.memberCount} 名成员 · {data.dimensions.length} 个能力维度 · 团队均值列在底部</p>
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[480px] text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="sticky left-0 bg-muted/30 px-3 py-2 text-left font-medium">成员</th>
              {data.dimensions.map((dim) => (
                <th key={dim} className="px-2 py-2 text-center font-medium">{data.dimensionLabels[dim]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.members.map((m) => (
              <tr key={m.id} className="border-b border-border/40 last:border-0">
                <td className="sticky left-0 bg-background px-3 py-1.5">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-[10px] text-muted-foreground">{m.role || '—'} · {m.level || '—'}</div>
                </td>
                {data.dimensions.map((dim) => {
                  const score = m.scores[dim];
                  return (
                    <td key={dim} className="px-2 py-1.5 text-center">
                      {score !== undefined && score !== null ? (
                        <span className={`inline-flex h-6 min-w-[34px] items-center justify-center rounded font-mono text-[11px] font-semibold ${scoreTone(score)}`}>
                          {score}
                        </span>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t border-border/60 bg-muted/20">
              <td className="px-3 py-2 font-medium">团队均值</td>
              {data.dimensions.map((dim) => (
                <td key={dim} className="px-2 py-2 text-center font-mono font-semibold">
                  {data.teamAverage[dim] > 0 ? data.teamAverage[dim] : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 冰山模型：显性（水上）vs 隐性（水下） */
function IcebergView({ data }: { data: Iceberg }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Mountain className="h-4 w-4" />显性能力 · 水面以上</div>
        <p className="mt-1 text-xs text-muted-foreground">可直接观察的技能与知识，决定"能不能做"</p>
        <div className="mt-3 space-y-2">
          {(data.explicit ?? []).map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs">{item.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
                <div className="h-full rounded-full bg-primary" style={{ width: `${item.score}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-xs">{item.score}</span>
            </div>
          ))}
          {(data.explicit ?? []).length === 0 && <p className="text-xs text-muted-foreground">暂无显性能力数据</p>}
        </div>
      </div>
      <div className="rounded-xl border border-border/25 bg-background p-4 shadow-inner">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Mountain className="h-4 w-4 rotate-180" />隐性特质 · 水面以下</div>
        <p className="mt-1 text-xs text-muted-foreground">行为模式、协作与稳定性，决定"能走多远"</p>
        <div className="mt-3 space-y-2">
          {(data.implicit ?? []).map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs">{item.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, item.score))}%` }} />
              </div>
              <span className="w-20 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                {item.value}{item.unit}（基准 {item.benchmark || '—'}）
              </span>
            </div>
          ))}
          {(data.implicit ?? []).length === 0 && <p className="text-xs text-muted-foreground">暂无行为证据数据，完成开发者实测评估后可解锁隐性层分析</p>}
        </div>
      </div>
    </div>
  );
}

/** SWOT 四象限 */
function SwotView({ data }: { data: SwotResult }) {
  const quadrants: Array<{ key: 'strengths' | 'weaknesses' | 'opportunities' | 'threats'; title: string; tone: string; items: string[] }> = [
    { key: 'strengths', title: '优势 Strengths', tone: 'border-success/30 bg-success/5 text-success', items: data.swot.strengths ?? [] },
    { key: 'weaknesses', title: '劣势 Weaknesses', tone: 'border-destructive/30 bg-destructive/5 text-destructive', items: data.swot.weaknesses ?? [] },
    { key: 'opportunities', title: '机会 Opportunities', tone: 'border-primary/30 bg-primary/5 text-primary', items: data.swot.opportunities ?? [] },
    { key: 'threats', title: '威胁 Threats', tone: 'border-warning/30 bg-warning/5 text-warning', items: data.swot.threats ?? [] },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {quadrants.map((q) => (
        <div key={q.key} className={`rounded-xl border p-4 ${q.tone}`}>
          <div className="text-sm font-semibold">{q.title}</div>
          <ul className="mt-2 space-y-1.5">
            {q.items.map((item, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-current" />{item}</li>
            ))}
          </ul>
          {q.items.length === 0 && <p className="mt-2 text-xs opacity-60">暂无数据</p>}
        </div>
      ))}
    </div>
  );
}

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
  // 分析模型弹窗
  const [analysisTeam, setAnalysisTeam] = React.useState<Team | null>(null);
  const [analysisModel, setAnalysisModel] = React.useState<'skills' | 'iceberg' | 'swot' | 'hiring'>('skills');
  const [skills, setSkills] = React.useState<SkillsMatrix | null>(null);
  const [iceberg, setIceberg] = React.useState<Iceberg | null>(null);
  const [swot, setSwot] = React.useState<SwotResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = React.useState(false);
  const [analysisError, setAnalysisError] = React.useState('');

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

  const openAnalysis = async (team: Team, model: typeof analysisModel) => {
    setAnalysisTeam(team);
    setAnalysisModel(model);
    setAdviceError('');
    setAnalysisError('');
    setTeamForecast(null);
    setSkills(null);
    setIceberg(null);
    setSwot(null);
    setAnalysisLoading(true);

    const loadForecast = api.getTeamForecast(team.id)
      .then((fc) => setTeamForecast(fc))
      .catch(() => setTeamForecast(null));
    const loadMain = model === 'skills'
      ? api.getTeamSkillsMatrix(team.id).then((s) => setSkills(s))
      : model === 'iceberg'
        ? api.getTeamIceberg(team.id).then((i) => setIceberg(i))
        : model === 'swot'
          ? api.getTeamSwot(team.id).then((sw) => setSwot(sw))
          : api.getTeamHiringAdvice(team.id).then((res) => setAdvice(res.advice));

    Promise.all([loadForecast, loadMain])
      .catch((e) => setAnalysisError(e instanceof Error ? e.message : '加载团队分析失败'))
      .finally(() => setAnalysisLoading(false));
  };

  const switchAnalysis = (team: Team, model: typeof analysisModel) => {
    setAnalysisModel(model);
    setAnalysisError('');
    setAnalysisLoading(true);
    const loader = model === 'skills'
      ? api.getTeamSkillsMatrix(team.id).then((s) => setSkills(s))
      : model === 'iceberg'
        ? api.getTeamIceberg(team.id).then((i) => setIceberg(i))
        : model === 'swot'
          ? api.getTeamSwot(team.id).then((sw) => setSwot(sw))
          : api.getTeamHiringAdvice(team.id).then((res) => setAdvice(res.advice));
    loader
      .catch((e) => setAnalysisError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setAnalysisLoading(false));
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
                onClick={(e: React.MouseEvent<HTMLElement>) => {
                  // 按钮基于 HeroUI onPress，stopPropagation 不影响原生冒泡；
                  // 通过目标元素判断，避免点击操作按钮时误触发整卡切换。
                  const target = e.target as HTMLElement;
                  if (target.closest('button, a, input, select, label')) return;
                  toggleTeam(team.id);
                }}
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
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
                    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void openAnalysis(team, 'skills')}>
                      <Grid3x3 className="h-3 w-3" />技能矩阵
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void openAnalysis(team, 'iceberg')}>
                      <Mountain className="h-3 w-3" />冰山
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void openAnalysis(team, 'swot')}>
                      <Compass className="h-3 w-3" />SWOT
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void openAnalysis(team, 'hiring')}>
                      <UserPlus className="h-3 w-3" />招聘建议
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ============ 团队分析弹窗（技能矩阵 / 冰山 / SWOT / 招聘建议） ============ */}
      {analysisTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAnalysisTeam(null)}>
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{analysisTeam.name} · 团队分析</h3>
                <p className="text-sm text-muted-foreground">切换分析模型查看不同视角</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setAnalysisTeam(null)}><X className="h-4 w-4" /></Button>
            </div>

            {/* 模型切换 */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {([
                ['skills', '技能矩阵', Grid3x3],
                ['iceberg', '冰山模型', Mountain],
                ['swot', 'SWOT', Compass],
                ['hiring', '招聘建议', UserPlus],
              ] as const).map(([key, label, Icon]) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={analysisModel === key ? 'default' : 'ghost'}
                  className="h-8 gap-1.5 px-3 text-xs"
                  onClick={() => void switchAnalysis(analysisTeam, key)}
                >
                  <Icon className="h-3.5 w-3.5" />{label}
                </Button>
              ))}
            </div>

            {analysisLoading ? (
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在加载 {analysisModel === 'skills' ? '技能矩阵' : analysisModel === 'iceberg' ? '冰山模型' : analysisModel === 'swot' ? 'SWOT 分析' : '招聘建议'}…
              </div>
            ) : analysisError ? (
              <p className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{analysisError}</p>
            ) : (
              <div className="mt-5">
                {analysisModel === 'skills' && skills && <SkillsMatrixView data={skills} />}
                {analysisModel === 'iceberg' && iceberg && <IcebergView data={iceberg} />}
                {analysisModel === 'swot' && swot && <SwotView data={swot} />}
                {analysisModel === 'hiring' && (
                  <div className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/20 p-4 text-sm leading-relaxed">{advice || '暂无招聘建议，请重试。'}</div>
                )}
              </div>
            )}

            {forecastLoading ? (
              <div className="mt-4 h-40 rounded-xl skeleton" />
            ) : teamForecast && analysisModel !== 'hiring' ? (
              <div className="mt-4">
                <ForecastCard projectId={teamForecast.teamId} observations={teamForecast.observations} forecast={teamForecast.forecast} model={teamForecast.model} />
              </div>
            ) : null}
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
