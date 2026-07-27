/**
 * ④ 团队分析
 * 团队对比雷达（多 series）+ 团队卡 + 能力缺口矩阵 + stagger
 */
'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Users, AlertTriangle, BusIcon, Network } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageHeader, staggerContainer, cardItem } from '@/components/widgets';
import { FilterBar, EmptyState } from '@/components/filter-bar';
import { CapabilityRadar, LineTrend } from '@/components/charts';
import { api } from '@/lib/api';
import { scoreColor } from '@/lib/utils';
import type { Team, CapabilityGap } from '@/lib/types';

const CAPABILITY_LABELS: Record<string, string> = {
  code_quality: '代码质量', architecture: '架构能力', stability: '稳定性',
  efficiency: '交付效率', collaboration: '协作能力', security_aware: '安全意识', test_coverage: '测试覆盖',
};

const TEAM_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

export default function TeamsPage() {
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [gaps, setGaps] = React.useState<CapabilityGap[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sortBy, setSortBy] = React.useState('avgScore');
  const [selectedForCompare, setSelectedForCompare] = React.useState<string[]>([]); // 团队 id 列表

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

  const toggleCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return [...prev.slice(1), id]; // 最多 3 个
      return [...prev, id];
    });
  };

  // 对比图的数据按选择顺序生成，保证团队卡片、雷达和折线使用同一颜色。
  const compareTeams = React.useMemo(() => (
    selectedForCompare
      .map((id) => teams.find((team) => team.id === id))
      .filter((team): team is Team => Boolean(team))
  ), [teams, selectedForCompare]);

  const compareSeries = React.useMemo(() => {
    return compareTeams.map((team, index) => ({
      name: team.name,
      data: Object.fromEntries(
        Object.entries(team.capability).map(([key, value]) => [CAPABILITY_LABELS[key], value])
      ),
      color: TEAM_COLORS[index % TEAM_COLORS.length],
    }));
  }, [compareTeams]);

  // 将 7 个能力维度作为横轴，每个团队映射为一条线，方便读取逐维分差。
  const compareLineData = React.useMemo(() => (
    Object.entries(CAPABILITY_LABELS).map(([key, dimension]) => ({
      dimension,
      ...Object.fromEntries(compareTeams.map((team) => [team.name, team.capability[key as keyof Team['capability']] as number])),
    }))
  ), [compareTeams]);

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

      <FilterBar
        sortOptions={[
          { value: 'avgScore', label: '按均分' },
          { value: 'busFactor', label: '按 Bus Factor' },
          { value: 'riskCount', label: '按风险数' },
          { value: 'members', label: '按人数' },
        ]}
        sortValue={sortBy}
        onSortChange={setSortBy}
        summary={
          <>
            <span>共 <span className="font-mono tabular-nums font-medium">{teams.length}</span> 个团队</span>
            <span className="text-muted-foreground">·</span>
            <span>总人数 <span className="font-mono tabular-nums font-medium">{teams.reduce((s, t) => s + t.members, 0)}</span></span>
            <span className="text-muted-foreground">·</span>
            <span>总风险 <span className="font-mono tabular-nums font-medium text-destructive">{teams.reduce((s, t) => s + t.riskCount, 0)}</span></span>
          </>
        }
      />

      {/* 团队对比雷达（选了 2+ 个才显示）*/}
      {compareSeries.length >= 2 && (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-primary" />
                  团队能力对比
                </CardTitle>
                <CardDescription className="mt-1">
                  已选 {compareSeries.length} 个团队叠加对比（最多 3 个）
                </CardDescription>
              </div>
              <button
                onClick={() => setSelectedForCompare([])}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                清除选择
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-5 flex flex-wrap gap-x-4 gap-y-2 text-xs">
              {compareSeries.map((series) => (
                <div key={series.name} className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: series.color }} />
                  <span>{series.name}</span>
                </div>
              ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-2">
                  <h3 className="text-sm font-medium">能力轮廓</h3>
                  <p className="text-xs text-muted-foreground">从整体形状识别团队能力结构</p>
                </div>
                <CapabilityRadar series={compareSeries} height={320} />
              </div>
              <div className="min-w-0">
                <div className="mb-2">
                  <h3 className="text-sm font-medium">逐维线性对比</h3>
                  <p className="text-xs text-muted-foreground">横轴为能力维度，折线交叉表示各团队优势维度不同</p>
                </div>
                <LineTrend
                  data={compareLineData}
                  xKey="dimension"
                  series={compareSeries.map((series) => ({ key: series.name, name: series.name, color: series.color }))}
                  height={320}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 团队卡片墙 */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((team) => {
          const isSelected = selectedForCompare.includes(team.id);
          const colorIdx = selectedForCompare.indexOf(team.id);
          return (
            <motion.div key={team.id} variants={cardItem}>
              <Card
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isSelected ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/40'
                }`}
                onClick={() => toggleCompare(team.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {isSelected && (
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ background: TEAM_COLORS[colorIdx % TEAM_COLORS.length] }}
                          />
                        )}
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
                  {/* Bus Factor 醒目展示 */}
                  <div className="mb-3 flex items-center justify-between rounded-lg bg-muted/40 p-3">
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
                  {/* 7 维雷达 */}
                  <CapabilityRadar
                    series={[{
                      name: team.name,
                      data: Object.fromEntries(
                        Object.entries(team.capability).map(([k, v]) => [CAPABILITY_LABELS[k], v])
                      ),
                      color: isSelected ? TEAM_COLORS[colorIdx % TEAM_COLORS.length] : 'var(--chart-1)',
                    }]}
                    height={200}
                  />
                  <div className="mt-2 text-center text-[10px] text-muted-foreground">
                    {isSelected ? '已加入对比' : '点击卡片加入对比'}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* 能力缺口矩阵表 */}
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
