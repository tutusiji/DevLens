/**
 * ④ 团队分析
 * 顶部全团队对比（雷达 + 柱状）+ 团队卡 + 能力缺口矩阵
 * 默认所有团队亮起，点击切换显示/隐藏
 */
'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Users, AlertTriangle, BusIcon, Network, Eye, EyeOff, UserPlus, Loader2, X, Grid3x3, Mountain, Compass, Settings2, Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageHeader, staggerContainer, cardItem } from '@/components/widgets';
import { CapabilityRadar, GroupedBars } from '@/components/charts';
import { ForecastCard } from '@/components/forecast-card';
import { api } from '@/lib/api';
import { scoreColor } from '@/lib/utils';
import type { Team, CapabilityGap, TeamForecast, SkillsMatrix, Iceberg, SwotResult, SkillGroup, Skill, SkillGroupAnalysisType } from '@/lib/types';

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

function heatColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'bg-muted/30 text-muted-foreground/40';
  if (score >= 85) return 'bg-emerald-500 text-white';
  if (score >= 70) return 'bg-emerald-400/80 text-emerald-950';
  if (score >= 55) return 'bg-amber-400/80 text-amber-950';
  if (score >= 40) return 'bg-orange-500/80 text-white';
  return 'bg-rose-600 text-white';
}

/** 技能矩阵：成员 × 维度 矩阵热力图（色块网格） */
function SkillsMatrixView({ data }: { data: SkillsMatrix }) {
  const dims = data.dimensions;
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {data.memberCount} 名成员 · {dims.length} 个能力维度 · 色块越绿越强
      </p>
      <div className="overflow-x-auto rounded-xl border border-border/60 p-3">
        <div className="min-w-[520px]">
          {/* 维度表头 */}
          <div className="flex">
            <div className="w-32 shrink-0 pr-2" />
            {dims.map((dim) => (
              <div key={dim} className="flex-1 text-center text-[10px] font-medium text-muted-foreground">
                {data.dimensionLabels[dim]}
              </div>
            ))}
          </div>
          {/* 成员行 */}
          <div className="mt-1 space-y-1">
            {data.members.map((m) => (
              <div key={m.id} className="flex items-center">
                <div className="w-32 shrink-0 truncate pr-2">
                  <div className="truncate text-xs font-medium">{m.name}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{m.role || '—'} · {m.level || '—'}</div>
                </div>
                <div className="flex flex-1 gap-1">
                  {dims.map((dim) => {
                    const score = m.scores[dim];
                    return (
                      <div
                        key={dim}
                        title={`${m.name} · ${data.dimensionLabels[dim]}: ${score ?? '无数据'}`}
                        className={`flex h-9 flex-1 items-center justify-center rounded font-mono text-xs font-semibold transition-transform hover:scale-105 ${heatColor(score)}`}
                      >
                        {score ?? '—'}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {/* 团队均值行 */}
          <div className="mt-2 flex items-center border-t border-border/60 pt-2">
            <div className="w-32 shrink-0 truncate pr-2 text-xs font-semibold">团队均值</div>
            <div className="flex flex-1 gap-1">
              {dims.map((dim) => {
                const avg = data.teamAverage[dim];
                return (
                  <div key={dim} className={`flex h-7 flex-1 items-center justify-center rounded font-mono text-[11px] ${avg > 0 ? 'bg-primary/15 font-semibold text-primary' : 'bg-muted/30 text-muted-foreground/40'}`}>
                    {avg > 0 ? avg : '—'}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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

/** SWOT 四格图（标准 2×2：内部分析 S/W 在上，外部环境 O/T 在下） */
function SwotView({ data }: { data: SwotResult }) {
  const quadrants: Array<{ key: 'strengths' | 'weaknesses' | 'opportunities' | 'threats'; corner: string; title: string; tone: string; items: string[] }> = [
    { key: 'strengths', corner: 'S', title: '优势 Strengths', tone: 'text-success', items: data.swot.strengths ?? [] },
    { key: 'weaknesses', corner: 'W', title: '劣势 Weaknesses', tone: 'text-destructive', items: data.swot.weaknesses ?? [] },
    { key: 'opportunities', corner: 'O', title: '机会 Opportunities', tone: 'text-primary', items: data.swot.opportunities ?? [] },
    { key: 'threats', corner: 'T', title: '威胁 Threats', tone: 'text-warning', items: data.swot.threats ?? [] },
  ];
  return (
    <div>
      {/* 轴标签 */}
      <div className="mb-1 flex justify-between px-1 text-[10px] font-medium text-muted-foreground">
        <span>有利 / 有利因素</span>
        <span>不利 / 不利因素</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {quadrants.map((q) => (
          <div key={q.key} className="rounded-lg border border-border/70 bg-muted/10 p-3">
            <div className="flex items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold ${q.tone}`}>{q.corner}</span>
              <span className="text-xs font-semibold">{q.title}</span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {q.items.map((item, i) => (
                <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-foreground/90">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
                  {item}
                </li>
              ))}
            </ul>
            {q.items.length === 0 && <p className="mt-2 text-xs text-muted-foreground/60">暂无数据</p>}
          </div>
        ))}
      </div>
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
  // Skill 驱动：规则组编辑抽屉
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const [ruleGroup, setRuleGroup] = React.useState<SkillGroup | null>(null);
  const [ruleSkills, setRuleSkills] = React.useState<Skill[]>([]);
  const [ruleGroups, setRuleGroups] = React.useState<SkillGroup[]>([]);
  const [promptDraft, setPromptDraft] = React.useState('');
  const [savingRules, setSavingRules] = React.useState(false);
  const [rulesError, setRulesError] = React.useState('');

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

  const openRulesEditor = async (analysisType: SkillGroupAnalysisType) => {
    setRulesError('');
    setRuleSkills([]);
    setPromptDraft('');
    setRulesOpen(true);
    try {
      const groups = await api.getSkillGroups();
      setRuleGroups(groups);
      const group = groups.find((g) => g.analysisType === analysisType);
      setRuleGroup(group || null);
      setPromptDraft(group?.promptTemplate || '');
      if (group) {
        const skills = await api.getSkills();
        setRuleSkills(skills.filter((s) => (group.skillIds || []).includes(s.id)));
      }
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : '加载规则组失败');
    }
  };

  const saveRules = async () => {
    if (!ruleGroup) return;
    setSavingRules(true);
    setRulesError('');
    try {
      await api.updateSkillGroup(ruleGroup.id, { promptTemplate: promptDraft });
      setRulesOpen(false);
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : '保存规则失败');
    } finally {
      setSavingRules(false);
    }
  };

  const toggleRuleEnabled = async (skill: Skill) => {
    if (!ruleGroup) return;
    const nextEnabled = skill.enabled ? 0 : 1;
    setRuleSkills((prev) => prev.map((s) => s.id === skill.id ? { ...s, enabled: nextEnabled } : s));
    try {
      await api.updateSkill(skill.id, { enabled: nextEnabled });
    } catch {
      // 回滚
      setRuleSkills((prev) => prev.map((s) => s.id === skill.id ? { ...s, enabled: skill.enabled } : s));
    }
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
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void openRulesEditor(analysisModel as SkillGroupAnalysisType)}>
                  <Settings2 className="h-3.5 w-3.5" />
                  编辑规则组
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setAnalysisTeam(null)}><X className="h-4 w-4" /></Button>
              </div>
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

      {/* ============ 规则组编辑抽屉（Skill 驱动） ============ */}
      {rulesOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/40" onClick={() => setRulesOpen(false)}>
          <div
            className="flex h-full w-full max-w-md flex-col bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-base font-semibold">编辑规则组</h3>
                <p className="text-xs text-muted-foreground">该模块的评估规则（Skill 资产），修改立即生效于后续分析</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setRulesOpen(false)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {ruleGroup ? (
                <>
                  <div className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{ruleGroup.name}</span>
                      <Badge variant="secondary" className="font-mono text-[10px]">{ruleGroup.analysisType}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{ruleGroup.description}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Prompt 模板</label>
                    <p className="text-[11px] text-muted-foreground">支持 {`{team_name}`}、{`{member_lines}`}、{`{gap_lines}`}、{`{rules}`} 等占位符</p>
                    <textarea
                      value={promptDraft}
                      onChange={(e) => setPromptDraft(e.target.value)}
                      rows={10}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">组内规则（{ruleSkills.length}）</label>
                    <p className="text-[11px] text-muted-foreground">启停即时生效；如需编辑规则正文请前往「Skill 管理」</p>
                    <div className="space-y-1.5">
                      {ruleSkills.map((s) => (
                        <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 p-2.5 hover:bg-muted/40">
                          <input
                            type="checkbox"
                            checked={s.enabled === 1}
                            onChange={() => void toggleRuleEnabled(s)}
                            className="h-4 w-4 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium">{s.name}</div>
                            <div className="truncate text-[11px] text-muted-foreground">{s.ruleContent}</div>
                          </div>
                          <Badge variant={s.enabled === 1 ? 'success' : 'secondary'} className="text-[10px]">{s.enabled === 1 ? '启用' : '停用'}</Badge>
                        </label>
                      ))}
                      {ruleSkills.length === 0 && <p className="text-xs text-muted-foreground">该组暂无规则</p>}
                    </div>
                  </div>
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  该分析模块暂无规则组，请先在「Skill 管理」创建 analysis_type 对应的编组。
                </p>
              )}

              {rulesError && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{rulesError}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <Button variant="outline" onClick={() => setRulesOpen(false)}>取消</Button>
              <Button variant="accent" disabled={savingRules || !ruleGroup} onClick={() => void saveRules()}>
                {savingRules ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                保存规则
              </Button>
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
