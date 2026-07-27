/**
 * 开发者画像详情页
 * 8 维能力雷达 + 成长曲线 + 行为证据 + 协作伙伴 + 主导模块 + AI 建议
 */
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, GitCommit, Eye, TrendingUp, Sparkles, Users2, Box, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader, ScoreRing, ProgressBar } from '@/components/widgets';
import { CapabilityRadar, LineTrend } from '@/components/charts';
import { DiceBearAvatar } from '@/components/dicebear-avatar';
import { api } from '@/lib/api';
import { developers, roleConfigs, getRoleStandard, DIMENSION_LABELS } from '@/lib/mock-data';
import { scoreColor } from '@/lib/utils';
import type { DeveloperDetail, Level } from '@/lib/types';

// 职级 Badge 颜色：D 高阶紫、E 资深绿、F 中高级琥珀、G 成长次级
function levelVariant(level: Level): 'default' | 'accent' | 'secondary' | 'success' {
  const prefix = level[0];
  if (prefix === 'D') return 'accent';
  if (prefix === 'E') return 'success';
  if (prefix === 'F') return 'default';
  return 'secondary';
}

// 达标率计算：个人能力 >= 标准的维度数 / 总维度数
function calcPassRate(capability: Record<string, any>, standard: Record<string, number>): { passed: number; total: number; rate: number } {
  const dims = Object.keys(standard);
  const passed = dims.filter((d) => Number(capability[d] || 0) >= standard[d]).length;
  return { passed, total: dims.length, rate: Math.round((passed / dims.length) * 100) };
}

const TREND_ICON = { up: '↑', down: '↓', stable: '→' };
const TREND_COLOR = { up: 'var(--success)', down: 'var(--destructive)', stable: 'var(--muted-foreground)' };

export default function DeveloperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [detail, setDetail] = React.useState<DeveloperDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.getDeveloperDetail(id).then((d) => {
      setDetail(d);
      setLoading(false);
    });
  }, [id]);

  if (loading || !detail) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton rounded" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-64 skeleton rounded-xl lg:col-span-2" />
          <div className="h-64 skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/developers')}>
          <ArrowLeft className="h-4 w-4" />
          返回开发者列表
        </Button>
      </div>

      {/* ============ 头部：头像 + 基本信息 + 综合评分 ============ */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
            <DiceBearAvatar seed={detail.username} size={80} />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="font-mono text-2xl font-bold">{detail.name}</h1>
                <Badge variant={levelVariant(detail.level)} className="font-mono">{detail.level}</Badge>
                <Badge variant="accent">{detail.role}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{detail.team}</span>
                <span>·</span>
                <span className="font-mono">@{detail.username}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <GitCommit className="h-3 w-3" /> {detail.commits} commits
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {detail.reviews} reviews
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {detail.tags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ScoreRing score={detail.overall} size={120} stroke={8} label="综合评分" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============ 能力雷达 + 达标率 + 行为证据 ============ */}
      {(() => {
        const roleConfig = roleConfigs.find((r) => r.key === detail.roleType) || roleConfigs[1];
        const standard = detail.roleStandard || getRoleStandard(detail.roleType, detail.level);
        const passRate = calcPassRate(detail.capability, standard);
        return (
      <div className="mb-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {roleConfig.name}能力模型
                </CardTitle>
                <CardDescription className="mt-1">
                  个人能力 vs {detail.level} 级标准（{roleConfig.name}）
                </CardDescription>
              </div>
              {/* 达标率 Badge */}
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
                <span className="text-xs text-muted-foreground">达标率</span>
                <span className="font-mono text-lg font-bold tabular-nums" style={{ color: scoreColor(passRate.rate) }}>
                  {passRate.rate}%
                </span>
                <span className="text-xs text-muted-foreground">({passRate.passed}/{passRate.total})</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CapabilityRadar
              height={320}
              series={[
                {
                  name: '个人能力',
                  data: Object.fromEntries(
                    roleConfig.dimensions.map((dim) => [DIMENSION_LABELS[dim], (detail.capability as any)[dim] || 0])
                  ),
                  color: 'var(--chart-1)',
                },
                {
                  name: `${detail.level} 标准`,
                  data: Object.fromEntries(
                    roleConfig.dimensions.map((dim) => [DIMENSION_LABELS[dim], standard[dim] || 0])
                  ),
                  color: 'var(--chart-3)',
                },
              ]}
            />
            {/* 维度达标明细 */}
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {roleConfig.dimensions.map((dim) => {
                const personal = (detail.capability as any)[dim] || 0;
                const std = standard[dim] || 0;
                const passed = personal >= std;
                return (
                  <div key={dim} className="rounded border border-border/60 p-2">
                    <div className="text-[10px] text-muted-foreground">{DIMENSION_LABELS[dim]}</div>
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-sm font-bold tabular-nums" style={{ color: scoreColor(personal) }}>{personal}</span>
                      <span className="text-[10px] text-muted-foreground">/ {std}</span>
                    </div>
                    <div className={`text-[10px] ${passed ? 'text-success' : 'text-destructive'}`}>
                      {passed ? '✓ 达标' : `差 ${std - personal}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              行为证据
            </CardTitle>
            <CardDescription>从 Git 行为推导的能力信号</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.behaviorEvidence.map((ev) => {
              const isPercent = ev.unit === '%';
              const isRatio = ev.unit === '';
              const displayVal = isRatio ? ev.value.toFixed(2) : isPercent ? `${ev.value}%` : `${ev.value} ${ev.unit}`;
              const benchVal = isRatio ? ev.benchmark.toFixed(2) : isPercent ? `${ev.benchmark}%` : `${ev.benchmark} ${ev.unit}`;
              const better = ev.label.includes('Revert') || ev.label.includes('Hotfix')
                ? ev.value < ev.benchmark
                : ev.value > ev.benchmark;
              return (
                <div key={ev.label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{ev.label}</span>
                    <span className="font-mono text-sm tabular-nums" style={{ color: better ? 'var(--success)' : 'var(--warning)' }}>
                      {displayVal}
                    </span>
                  </div>
                  <ProgressBar
                    value={isRatio ? ev.value * 100 : ev.value}
                    max={isRatio ? 1 : ev.benchmark * 1.8}
                    showValue={false}
                    indicatorClassName={better ? 'bg-success' : 'bg-warning'}
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{ev.description}</span>
                    <span className="text-muted-foreground">均值 {benchVal}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
        );
      })()}

      {/* ============ 成长曲线 + AI 建议 ============ */}
      <div className="mb-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>成长曲线</CardTitle>
            <CardDescription>综合评分 vs 团队均值，近 6 个季度</CardDescription>
          </CardHeader>
          <CardContent>
            <LineTrend
              data={detail.growthCurve}
              xKey="period"
              series={[
                { key: 'composite', name: '个人综合分', color: 'var(--chart-1)' },
                { key: 'teamAvg', name: '团队均值', color: 'var(--chart-2)', dashed: true },
              ]}
              height={220}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-accent/30 bg-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              AI 成长建议
            </CardTitle>
            <CardDescription>基于能力模型与行为数据的个性化建议</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground/90">{detail.aiSuggestion}</p>
          </CardContent>
        </Card>
      </div>

      {/* ============ 主导模块 + 协作伙伴 ============ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-4 w-4 text-primary" />
              主导模块
            </CardTitle>
            <CardDescription>按归属占比排序</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.modules.map((m) => (
              <div key={m.module} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{m.module}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{m.commits} commits</span>
                    <span style={{ color: scoreColor(m.complexity) }}>复杂度 {m.complexity}</span>
                  </div>
                </div>
                <ProgressBar
                  value={m.ownership}
                  indicatorClassName={m.ownership >= 70 ? 'bg-destructive' : m.ownership >= 50 ? 'bg-warning' : 'bg-primary'}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-4 w-4 text-primary" />
              协作伙伴
            </CardTitle>
            <CardDescription>常共改文件 / 互评代码的开发者</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.partners.map((p) => (
              <Link
                key={p.username}
                href={`/developers/${developers.find((d) => d.username === p.username)?.id || ''}`}
                className="flex items-center gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/40"
              >
                <DiceBearAvatar seed={p.username} size={40} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    共改 {p.sharedCommits} · 互评 {p.reviewCount}
                  </div>
                </div>
                <div className="flex gap-4 text-xs">
                  <div className="text-center">
                    <div className="font-mono tabular-nums text-foreground">{p.sharedCommits}</div>
                    <div className="text-muted-foreground">共改</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono tabular-nums text-foreground">{p.reviewCount}</div>
                    <div className="text-muted-foreground">互评</div>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
