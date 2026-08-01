/**
 * Project Intelligence 项目详情工作台
 * 概览、AI Review、模块风险与修复计划均由可替换的项目详情数据驱动。
 */
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity, AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, CircleDot,
  ClipboardCheck, Code2, DatabaseZap, FileCode2, FileSearch, FolderKanban, Gauge,
  Layers3, Play, RefreshCw, ShieldAlert, Sparkles, TrendingUp, UserRound,
  Wrench, Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaTrend, GroupedBars } from '@/components/charts';
import { DiceBearAvatar } from '@/components/dicebear-avatar';
import { EmptyState, FilterBar } from '@/components/filter-bar';
import { ProgressBar, ScoreRing, StatCard } from '@/components/widgets';
import { api } from '@/lib/api';
import { scoreColor } from '@/lib/utils';
import type { AIReviewInsight, FixPriority, InsightStatus, ModuleRisk, ProjectDetail, ReviewCategory } from '@/lib/types';

const TREND_ARROW = { up: '↑', down: '↓', stable: '→' };
const TREND_COLOR = { up: 'var(--success)', down: 'var(--destructive)', stable: 'var(--muted-foreground)' };

const CATEGORY_META: Record<ReviewCategory, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  quality: { label: '代码质量', icon: FileCode2 },
  security: { label: '安全', icon: ShieldAlert },
  performance: { label: '性能', icon: Zap },
  maintainability: { label: '可维护性', icon: Wrench },
  architecture: { label: '架构', icon: Layers3 },
  reliability: { label: '可靠性', icon: Activity },
  logic: { label: '逻辑', icon: Code2 },
  complexity: { label: '复杂度', icon: Gauge },
  configuration: { label: '配置', icon: FileSearch },
  dependency: { label: '依赖', icon: FolderKanban },
  testing: { label: '测试', icon: ClipboardCheck },
  delivery: { label: '交付', icon: Play },
};

const STATUS_META: Record<InsightStatus, { label: string; variant: 'danger' | 'warning' | 'success' | 'secondary' | 'outline' }> = {
  open: { label: '待处理', variant: 'danger' },
  acknowledged: { label: '已确认', variant: 'warning' },
  in_progress: { label: '处理中', variant: 'warning' },
  resolved: { label: '已解决', variant: 'success' },
  accepted_risk: { label: '接受风险', variant: 'secondary' },
  false_positive: { label: '误报', variant: 'outline' },
};

// 整改状态流转：open → acknowledged → in_progress → resolved（可分支接受风险/误报，终态可重新打开）
const INSIGHT_TRANSITIONS: Record<InsightStatus, InsightStatus[]> = {
  open: ['acknowledged', 'in_progress', 'accepted_risk', 'false_positive'],
  acknowledged: ['in_progress', 'accepted_risk', 'false_positive'],
  in_progress: ['resolved', 'accepted_risk', 'false_positive'],
  resolved: ['open'],
  accepted_risk: ['open'],
  false_positive: ['open'],
};

const SEVERITY_META: Record<AIReviewInsight['severity'] | ModuleRisk['severity'], { label: string; variant: 'danger' | 'warning' | 'success' | 'secondary' }> = {
  critical: { label: '严重', variant: 'danger' },
  high: { label: '高', variant: 'warning' },
  medium: { label: '中', variant: 'secondary' },
  low: { label: '低', variant: 'success' },
  info: { label: '提示', variant: 'secondary' },
};

function StatusBadge({ status }: { status: InsightStatus }) {
  const meta = STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function SeverityBadge({ severity }: { severity: AIReviewInsight['severity'] | ModuleRisk['severity'] }) {
  const meta = SEVERITY_META[severity];
  return <Badge variant={meta.variant}>{meta.label}风险</Badge>;
}

function CategoryBadge({ category }: { category: ReviewCategory }) {
  const Icon = CATEGORY_META[category].icon;
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icon className="h-3 w-3" />
      {CATEGORY_META[category].label}
    </Badge>
  );
}

function InsightPreview({ insight, onSelect }: { insight: AIReviewInsight; onSelect: () => void }) {
  const Icon = CATEGORY_META[insight.category].icon;
  return (
    <button
      onClick={onSelect}
      className="w-full rounded-lg border border-border/60 bg-background/60 p-4 text-left transition-all hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{insight.title}</span>
            <SeverityBadge severity={insight.severity} />
            <CategoryBadge category={insight.category} />
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">{insight.evidence}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-foreground/80">{insight.module}</span>
            <span>风险 {insight.riskScore}</span>
            <span>置信度 {Math.round(insight.confidence * 100)}%</span>
            <StatusBadge status={insight.status} />
          </div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </button>
  );
}

function InsightSheet({ insight, onClose, onUpdate }: { insight: AIReviewInsight | null; onClose: () => void; onUpdate: (insightId: string, patch: { status?: InsightStatus; assignee?: string }) => void }) {
  const [assignee, setAssignee] = React.useState('');
  React.useEffect(() => { setAssignee(insight?.assignee || ''); }, [insight?.id, insight?.assignee]);
  return (
    <Sheet open={Boolean(insight)} onClose={onClose} title={insight?.title} description={insight ? `${insight.source} · 最后发现于 ${insight.lastSeenAt}` : undefined} width="lg">
      {insight && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <SeverityBadge severity={insight.severity} />
            <CategoryBadge category={insight.category} />
            <StatusBadge status={insight.status} />
            <Badge variant="outline">风险 {insight.riskScore}</Badge>
            <Badge variant="outline">置信度 {Math.round(insight.confidence * 100)}%</Badge>
          </div>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">定位</h3>
            <div className="rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs leading-6">
              <div>{insight.filePath}{insight.startLine ? `:${insight.startLine}-${insight.endLine}` : ''}</div>
              {insight.symbol && <div className="text-muted-foreground">{insight.symbol}</div>}
            </div>
          </section>
          {insight.codeExcerpt && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">证据摘要</h3>
              <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-100">{insight.codeExcerpt}</pre>
            </section>
          )}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">发现说明</h3>
            <p className="text-sm leading-6 text-muted-foreground">{insight.evidence}</p>
          </section>
          <section className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <h3 className="text-sm font-semibold text-destructive">影响范围</h3>
            <p className="mt-1 text-sm leading-6">{insight.impact}</p>
          </section>
          <section className="rounded-lg border border-success/20 bg-success/5 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" />建议修复</h3>
            <p className="mt-1 text-sm leading-6">{insight.action}</p>
            <p className="mt-3 border-t border-success/15 pt-3 text-xs text-muted-foreground">验证方式：{insight.verification}</p>
          </section>
          <section className="space-y-3 rounded-lg border border-border/60 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Wrench className="h-4 w-4" />整改状态</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">状态流转：</span>
              {INSIGHT_TRANSITIONS[insight.status].map((next) => (
                <Button key={next} size="sm" variant={next === 'resolved' ? 'default' : 'outline'} onClick={() => onUpdate(insight.id, { status: next })}>{STATUS_META[next].label}</Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                className="h-8 max-w-[220px]"
                placeholder="指派责任人"
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
              />
              <Button size="sm" variant="outline" disabled={assignee === (insight.assignee || '')} onClick={() => onUpdate(insight.id, { assignee: assignee.trim() || undefined })}>保存责任人</Button>
              {insight.assignee && <span className="text-xs text-muted-foreground">当前：{insight.assignee}</span>}
            </div>
          </section>
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
            <span>首次发现：{insight.firstSeenAt}</span>
            <span>责任人：{insight.assignee || '未分配'}</span>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function ModuleSheet({ module, onClose, onViewReview }: { module: ModuleRisk | null; onClose: () => void; onViewReview: (moduleName: string) => void }) {
  return (
    <Sheet open={Boolean(module)} onClose={onClose} title={module?.name} description={module?.path} width="md">
      {module && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <SeverityBadge severity={module.severity} />
            <Badge variant="outline">风险分 {module.score}</Badge>
            <Badge variant="outline">{module.issueCount} 项发现</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['复杂度', module.complexity], ['债务负载', module.debtLoad],
              ['归属集中度', module.ownership], ['高危问题', module.criticalCount],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="mt-1 font-mono text-xl font-semibold">{value}{label === '归属集中度' ? '%' : ''}</div>
              </div>
            ))}
          </div>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">责任覆盖</h3>
            <div className="rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Owner</span><span>{module.owner || '未分配'}</span></div>
              <div className="mt-2 flex justify-between"><span className="text-muted-foreground">备份 Owner</span><span>{module.backupOwner || '缺失'}</span></div>
              <div className="mt-2 flex justify-between"><span className="text-muted-foreground">最近变更</span><span>{module.lastChanged}</span></div>
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">风险构成</h3>
            <div className="flex flex-wrap gap-2">
              {module.categories.map((item) => <Badge key={item.category} variant="outline">{CATEGORY_META[item.category].label} {item.count}</Badge>)}
            </div>
          </section>
          <Button className="w-full" onClick={() => onViewReview(module.name)}>查看该模块 Review</Button>
        </div>
      )}
    </Sheet>
  );
}

function OverviewTab({ detail, fixes, onSelectInsight, onSelectFix, onOpenReview }: {
  detail: ProjectDetail;
  fixes: FixPriority[];
  onSelectInsight: (insight: AIReviewInsight) => void;
  onSelectFix: (fix: FixPriority) => void;
  onOpenReview: () => void;
}) {
  const previewInsights = detail.aiInsights.filter((insight) => insight.status !== 'resolved').slice(0, 3);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="高危问题" value={detail.reviewSummary.critical + detail.aiInsights.filter((item) => item.severity === 'high' && item.status !== 'resolved').length} unit="项" delta={detail.reviewSummary.newSinceLastScan} icon={AlertTriangle} />
        <StatCard label="待处理" value={fixes.filter((fix) => !['resolved', 'false_positive', 'accepted_risk'].includes(fix.status)).length} unit="项" delta={-1} icon={CircleDot} />
        <StatCard label="本轮新增" value={detail.reviewSummary.newSinceLastScan} unit="项" delta={detail.reviewSummary.newSinceLastScan} icon={Sparkles} />
        <StatCard label="扫描覆盖率" value={detail.analysisMeta.coverage} unit="%" delta={2} icon={FileSearch} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>评估维度</CardTitle><CardDescription>项目评分与组织基准对比</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {detail.dimensions.map((dim) => (
              <div key={dim.label} className="space-y-1.5 rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{dim.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-lg font-bold tabular-nums" style={{ color: scoreColor(dim.score) }}>{dim.score}</span>
                    <span className="text-xs" style={{ color: TREND_COLOR[dim.trend] }}>{TREND_ARROW[dim.trend]}</span>
                  </div>
                </div>
                <ProgressBar value={dim.score} indicatorClassName={dim.score >= 80 ? 'bg-success' : dim.score >= 70 ? 'bg-warning' : 'bg-destructive'} />
                <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{dim.description}</span><span className="shrink-0 text-muted-foreground">基准 {dim.benchmark}</span></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />债务负载趋势</CardTitle><CardDescription>债务负载与复杂度指数，近 6 个月</CardDescription></CardHeader>
          <CardContent><AreaTrend data={detail.debtTrend} xKey="month" series={[{ key: 'debt', name: '债务负载', color: 'var(--chart-5)' }, { key: 'complexity', name: '复杂度', color: 'var(--chart-3)', dashed: true }]} height={220} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="border-accent/30 bg-accent/5 xl:col-span-3">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" />AI Review 焦点</CardTitle><CardDescription>优先处理未关闭的风险发现</CardDescription></div>
            <Button variant="ghost" size="sm" onClick={onOpenReview}>查看全部</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {previewInsights.length ? previewInsights.map((insight) => <InsightPreview key={insight.id} insight={insight} onSelect={() => onSelectInsight(insight)} />) : <EmptyState icon={CheckCircle2} title="没有待处理洞察" description="本轮分析没有需要跟进的风险问题。" />}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-4 w-4 text-primary" />优先修复</CardTitle><CardDescription>按影响与成本综合排序</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {fixes.slice(0, 3).map((fix) => (
              <button key={fix.id} onClick={() => onSelectFix(fix)} className="flex w-full items-center gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/50">
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant={fix.priority === 'P0' ? 'danger' : fix.priority === 'P1' ? 'warning' : 'secondary'}>{fix.priority}</Badge><span className="truncate font-mono text-sm">{fix.module}</span></div><p className="mt-1 text-xs text-muted-foreground">{fix.title}</p></div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>贡献者排行</CardTitle><CardDescription>按提交量排序，显示核心模块归属</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {detail.contributorList.map((contributor, index) => (
            <div key={contributor.username} className="flex items-center gap-3 rounded-lg border border-border/60 p-3"><span className="w-4 text-center font-mono text-sm text-muted-foreground">{index + 1}</span><DiceBearAvatar seed={contributor.username} size={36} /><div className="min-w-0 flex-1"><div className="text-sm font-medium">{contributor.name}</div><div className="text-xs text-muted-foreground">{contributor.commits} commits · {contributor.reviews} reviews</div></div><div className="w-16"><ProgressBar value={contributor.ownership} showValue={false} indicatorClassName="bg-primary" /><div className="mt-1 text-right text-[10px] text-muted-foreground">{contributor.ownership}%</div></div></div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewTab({ detail, insights, onSelectInsight }: { detail: ProjectDetail; insights: AIReviewInsight[]; onSelectInsight: (insight: AIReviewInsight) => void }) {
  const [query, setQuery] = React.useState('');
  const [filters, setFilters] = React.useState({ severity: 'all', category: 'all', module: 'all', status: 'all' });
  const [sort, setSort] = React.useState('risk');
  const [view, setView] = React.useState('table');
  const modules = [...new Set(detail.aiInsights.map((insight) => insight.module))];
  const filtered = React.useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    return insights.filter((insight) => {
      const matchesQuery = !normalizedQuery || [insight.title, insight.module, insight.filePath, insight.evidence].join(' ').toLowerCase().includes(normalizedQuery);
      return matchesQuery
        && (filters.severity === 'all' || insight.severity === filters.severity)
        && (filters.category === 'all' || insight.category === filters.category)
        && (filters.module === 'all' || insight.module === filters.module)
        && (filters.status === 'all' || insight.status === filters.status);
    }).sort((a, b) => sort === 'latest' ? b.lastSeenAt.localeCompare(a.lastSeenAt) : b.riskScore - a.riskScore);
  }, [filters, insights, query, sort]);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="全部发现" value={detail.reviewSummary.total} unit="项" delta={detail.reviewSummary.newSinceLastScan} icon={FileSearch} />
        <StatCard label="待处理" value={insights.filter((item) => item.status === 'open').length} unit="项" delta={0} icon={AlertTriangle} />
        <StatCard label="处理中" value={insights.filter((item) => item.status === 'in_progress').length} unit="项" delta={1} icon={RefreshCw} />
        <StatCard label="已验证" value={insights.filter((item) => item.status === 'resolved').length} unit="项" delta={1} icon={CheckCircle2} />
      </div>
      <Card>
        <CardHeader><CardTitle>AI Review 收件箱</CardTitle><CardDescription>按风险、模块与治理状态筛选；点击查看可定位证据与验证方式。</CardDescription></CardHeader>
        <CardContent>
          <FilterBar
            searchPlaceholder="搜索问题、模块或文件路径..." searchValue={query} onSearchChange={setQuery}
            filters={[
              { key: 'severity', label: '严重性', options: ['critical', 'high', 'medium', 'low', 'info'].map((value) => ({ value, label: SEVERITY_META[value as AIReviewInsight['severity']].label })) },
              { key: 'category', label: '类别', options: Object.entries(CATEGORY_META).map(([value, meta]) => ({ value, label: meta.label })) },
              { key: 'module', label: '模块', options: modules.map((value) => ({ value, label: value })) },
              { key: 'status', label: '状态', options: Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label })) },
            ]}
            filterValues={filters} onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
            sortOptions={[{ value: 'risk', label: '按风险分排序' }, { value: 'latest', label: '按最近发现排序' }]} sortValue={sort} onSortChange={setSort}
            viewMode={view} onViewModeChange={setView} viewModes={[{ value: 'table', label: '表格' }, { value: 'cards', label: '卡片' }]}
            summary={<><span>显示 <b className="font-mono">{filtered.length}</b> / {insights.length} 项</span><span className="text-muted-foreground">数据来自 {detail.analysisMeta.analysisVersion} 分析批次</span></>}
          />
          {!filtered.length ? <EmptyState icon={FileSearch} title="没有匹配的洞察" description="调整筛选条件，或查看全部分析结果。" /> : view === 'cards' ? (
            <div className="space-y-3">{filtered.map((insight) => <InsightPreview key={insight.id} insight={insight} onSelect={() => onSelectInsight(insight)} />)}</div>
          ) : (
            <Table className="min-w-[1000px]"><TableHeader><TableRow><TableHead>严重性</TableHead><TableHead>问题</TableHead><TableHead>模块 / 文件</TableHead><TableHead>类别</TableHead><TableHead className="text-right">风险 / 置信度</TableHead><TableHead>状态</TableHead><TableHead>责任人</TableHead><TableHead>最近发现</TableHead></TableRow></TableHeader><TableBody>{filtered.map((insight) => (
              <TableRow key={insight.id} tabIndex={0} role="button" onClick={() => onSelectInsight(insight)} onKeyDown={(event) => { if (event.key === 'Enter') onSelectInsight(insight); }} className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <TableCell><SeverityBadge severity={insight.severity} /></TableCell><TableCell><div className="max-w-[220px] font-medium">{insight.title}</div><div className="mt-1 line-clamp-1 max-w-[220px] text-xs text-muted-foreground">{insight.evidence}</div></TableCell><TableCell><div className="font-mono text-xs">{insight.module}</div><div className="mt-1 max-w-[180px] truncate text-xs text-muted-foreground">{insight.filePath}</div></TableCell><TableCell><CategoryBadge category={insight.category} /></TableCell><TableCell className="text-right"><div className="font-mono font-semibold" style={{ color: insight.riskScore >= 80 ? 'var(--destructive)' : 'var(--warning)' }}>{insight.riskScore}</div><div className="text-xs text-muted-foreground">{Math.round(insight.confidence * 100)}%</div></TableCell><TableCell><StatusBadge status={insight.status} /></TableCell><TableCell>{insight.assignee || <span className="text-muted-foreground">未分配</span>}</TableCell><TableCell className="text-muted-foreground">{insight.lastSeenAt}</TableCell>
              </TableRow>
            ))}</TableBody></Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModulesTab({ detail, onSelectModule }: { detail: ProjectDetail; onSelectModule: (module: ModuleRisk) => void }) {
  const chartData = detail.moduleRisks.slice(0, 5).map((module) => {
    const totals = Object.fromEntries(module.categories.map((category) => [category.category, category.count]));
    return { name: module.name, security: totals.security || 0, quality: totals.quality || 0, performance: totals.performance || 0, maintainability: (totals.maintainability || 0) + (totals.complexity || 0) };
  });
  const uncovered = detail.moduleRisks.filter((module) => !module.owner || !module.backupOwner).length;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="风险模块" value={detail.moduleRisks.filter((module) => module.issueCount > 0).length} unit="个" delta={1} icon={Layers3} />
        <StatCard label="覆盖缺口" value={uncovered} unit="个" delta={uncovered} icon={UserRound} />
        <StatCard label="复杂度热点" value={Math.max(...detail.moduleRisks.map((module) => module.complexity))} unit="分" delta={4} icon={Gauge} />
        <StatCard label="最大债务负载" value={Math.max(...detail.moduleRisks.map((module) => module.debtLoad))} unit="项" delta={-2} icon={TrendingUp} />
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader><CardTitle>模块风险优先级</CardTitle><CardDescription>风险、复杂度、债务和 Owner 覆盖共同决定处置顺序。</CardDescription></CardHeader>
          <CardContent><Table className="min-w-[820px]"><TableHeader><TableRow><TableHead>模块</TableHead><TableHead>风险</TableHead><TableHead className="text-right">问题</TableHead><TableHead className="text-right">复杂度</TableHead><TableHead className="text-right">债务</TableHead><TableHead>Owner 覆盖</TableHead><TableHead>最近变更</TableHead></TableRow></TableHeader><TableBody>{detail.moduleRisks.slice().sort((a, b) => b.score - a.score).map((module) => (
            <TableRow key={module.id} tabIndex={0} role="button" onClick={() => onSelectModule(module)} onKeyDown={(event) => { if (event.key === 'Enter') onSelectModule(module); }} className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><TableCell><div className="font-mono text-sm">{module.name}</div><div className="text-xs text-muted-foreground">{module.path}</div></TableCell><TableCell><SeverityBadge severity={module.severity} /></TableCell><TableCell className="text-right font-mono">{module.issueCount}</TableCell><TableCell className="text-right font-mono">{module.complexity}</TableCell><TableCell className="text-right font-mono">{module.debtLoad}</TableCell><TableCell><div className="text-xs">{module.owner || '缺 Owner'}{module.backupOwner ? ` / ${module.backupOwner}` : ' / 缺备份'}</div><ProgressBar value={module.ownership} showValue={false} indicatorClassName={module.backupOwner ? 'bg-success' : 'bg-warning'} /></TableCell><TableCell className="text-muted-foreground">{module.lastChanged}</TableCell></TableRow>
          ))}</TableBody></Table></CardContent>
        </Card>
        <Card className="xl:col-span-2"><CardHeader><CardTitle>风险类别分布</CardTitle><CardDescription>Top 模块按问题类别聚合</CardDescription></CardHeader><CardContent><GroupedBars data={chartData} xKey="name" series={[{ key: 'security', name: '安全', color: 'var(--destructive)' }, { key: 'quality', name: '质量', color: 'var(--primary)' }, { key: 'performance', name: '性能', color: 'var(--warning)' }, { key: 'maintainability', name: '维护性', color: 'var(--chart-4)' }]} height={300} /></CardContent></Card>
      </div>
    </div>
  );
}

function FixesTab({ fixes, insights, onSelectFix, onUpdateStatus }: { fixes: FixPriority[]; insights: AIReviewInsight[]; onSelectFix: (fix: FixPriority) => void; onUpdateStatus: (id: string, status: InsightStatus) => void }) {
  const [filter, setFilter] = React.useState('all');
  const visible = fixes.filter((fix) => filter === 'all' || fix.status === filter);
  const active = fixes.filter((fix) => !['resolved', 'false_positive', 'accepted_risk'].includes(fix.status));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="待排期" value={active.filter((fix) => fix.status === 'open' || fix.status === 'acknowledged').length} unit="项" delta={-1} icon={CircleDot} />
        <StatCard label="处理中" value={fixes.filter((fix) => fix.status === 'in_progress').length} unit="项" delta={1} icon={RefreshCw} />
        <StatCard label="已验证" value={fixes.filter((fix) => fix.status === 'resolved').length} unit="项" delta={1} icon={CheckCircle2} />
        <StatCard label="预计收益" value={active.reduce((total, fix) => total + fix.expectedGain, 0)} unit="分" delta={2} icon={TrendingUp} />
      </div>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0"><div><CardTitle>修复计划</CardTitle><CardDescription>状态变更实时写入整改 API，随项目快照持久化。</CardDescription></div><Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: '全部' }, { value: 'open', label: '待处理' }, { value: 'in_progress', label: '处理中' }, { value: 'resolved', label: '已解决' }]} /></CardHeader>
        <CardContent>{!visible.length ? <EmptyState icon={ClipboardCheck} title="没有对应修复项" description="切换筛选查看其他治理状态。" /> : <Table className="min-w-[960px]"><TableHeader><TableRow><TableHead>优先级</TableHead><TableHead>修复项</TableHead><TableHead>模块</TableHead><TableHead>责任人</TableHead><TableHead>成本 / 收益</TableHead><TableHead>截止日期</TableHead><TableHead>状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{visible.map((fix) => {
          const insight = insights.find((item) => item.id === fix.insightId);
          return <TableRow key={fix.id}><TableCell><Badge variant={fix.priority === 'P0' ? 'danger' : fix.priority === 'P1' ? 'warning' : 'secondary'}>{fix.priority}</Badge></TableCell><TableCell><button onClick={() => onSelectFix(fix)} className="text-left font-medium hover:text-primary">{fix.title}</button>{insight && <div className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">关联：{insight.title}</div>}</TableCell><TableCell className="font-mono text-xs">{fix.module}</TableCell><TableCell>{fix.assignee || '未分配'}</TableCell><TableCell><div>{fix.effort}</div><div className="text-xs text-success">+{fix.expectedGain} 健康度</div></TableCell><TableCell>{fix.dueDate || '未排期'}</TableCell><TableCell><StatusBadge status={fix.status} /></TableCell><TableCell className="text-right"><div className="flex justify-end gap-1">{fix.status === 'open' || fix.status === 'acknowledged' ? <Button size="sm" variant="outline" onClick={() => onUpdateStatus(fix.id, 'in_progress')}>开始</Button> : null}{fix.status === 'in_progress' ? <Button size="sm" onClick={() => onUpdateStatus(fix.id, 'resolved')}>验证完成</Button> : null}</div></TableCell></TableRow>;
        })}</TableBody></Table>}</CardContent>
      </Card>
    </div>
  );
}

function FixSheet({ fix, insight, onClose, onViewInsight, onUpdateStatus }: { fix: FixPriority | null; insight?: AIReviewInsight; onClose: () => void; onViewInsight: () => void; onUpdateStatus: (fixId: string, status: InsightStatus) => void }) {
  return <Sheet open={Boolean(fix)} onClose={onClose} title={fix?.title} description={fix ? `${fix.priority} · ${fix.module}` : undefined} width="md">{fix && <div className="space-y-6"><div className="flex flex-wrap gap-2"><Badge variant={fix.priority === 'P0' ? 'danger' : fix.priority === 'P1' ? 'warning' : 'secondary'}>{fix.priority}</Badge><SeverityBadge severity={fix.severity} /><StatusBadge status={fix.status} /></div><div className="grid grid-cols-2 gap-3">{[['预估成本', fix.effort], ['预期收益', `+${fix.expectedGain} 健康度`], ['责任人', fix.assignee || '未分配'], ['截止日期', fix.dueDate || '未排期']].map(([label, value]) => <div key={label} className="rounded-lg border border-border/60 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-sm font-medium">{value}</div></div>)}</div><section className="space-y-2"><h3 className="text-sm font-semibold">预期影响</h3><p className="text-sm leading-6 text-muted-foreground">{fix.impact}</p></section><section className="space-y-2 rounded-lg border border-border/60 p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><Wrench className="h-4 w-4" />整改状态</h3><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">状态流转：</span>{INSIGHT_TRANSITIONS[fix.status].map((next) => <Button key={next} size="sm" variant={next === 'resolved' ? 'default' : 'outline'} onClick={() => onUpdateStatus(fix.id, next)}>{STATUS_META[next].label}</Button>)}</div></section>{insight && <Button variant="outline" className="w-full" onClick={onViewInsight}>查看关联 AI Review 证据</Button>}</div>}</Sheet>;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [detail, setDetail] = React.useState<ProjectDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState('overview');
  const [selectedInsight, setSelectedInsight] = React.useState<AIReviewInsight | null>(null);
  const [selectedModule, setSelectedModule] = React.useState<ModuleRisk | null>(null);
  const [selectedFix, setSelectedFix] = React.useState<FixPriority | null>(null);
  const [fixes, setFixes] = React.useState<FixPriority[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [reviewModule, setReviewModule] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);
    api.getProjectDetail(id).then((project) => {
      setDetail(project);
      setFixes(project?.fixPriorities || []);
      setLoading(false);
    }).catch(() => {
      setDetail(null);
      setLoading(false);
    });
  }, [id]);

  const selectFix = (fix: FixPriority) => {
    setSelectedFix(fix);
    setSelectedInsight(null);
  };
  const updateFixStatus = (fixId: string, status: InsightStatus) => {
    api.updateFixStatus(id, fixId, { status }).catch(() => {});
    setFixes((current) => current.map((fix) => fix.id === fixId ? { ...fix, status } : fix));
  };
  const updateInsight = (insightId: string, patch: { status?: InsightStatus; assignee?: string }) => {
    api.updateInsightStatus(id, insightId, patch).catch(() => {});
    setDetail((current) => current ? { ...current, aiInsights: current.aiInsights.map((insight) => insight.id === insightId ? { ...insight, ...patch } : insight) } : current);
  };
  const viewModuleReview = (module: string) => {
    setSelectedModule(null);
    setReviewModule(module);
    setTab('review');
  };
  const refresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 900);
  };

  if (loading) return <div className="space-y-6"><div className="h-8 w-64 skeleton rounded" /><div className="grid gap-4 lg:grid-cols-3"><div className="h-64 skeleton rounded-xl" /><div className="h-64 skeleton rounded-xl lg:col-span-2" /></div></div>;
  if (!detail) return <div className="space-y-4"><Button variant="ghost" size="sm" onClick={() => router.push('/projects')}><ArrowLeft className="h-4 w-4" />返回项目列表</Button><EmptyState icon={FolderKanban} title="项目详情尚未生成" description="该项目还没有完成 Project Intelligence 分析，请先发起一次分析。" action={<Button onClick={() => router.push('/onboard')}>前往接入项目</Button>} /></div>;

  const reviewInsights = reviewModule ? detail.aiInsights.filter((insight) => insight.module === reviewModule) : detail.aiInsights;
  const activeFix = fixes.find((fix) => fix.id === selectedFix?.id) || selectedFix;
  const relatedInsight = activeFix?.insightId ? detail.aiInsights.find((insight) => insight.id === activeFix.insightId) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" size="sm" onClick={() => router.push('/projects')}><ArrowLeft className="h-4 w-4" />返回项目列表</Button><Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? '分析中...' : '重新分析'}</Button></div>
      <Card><CardContent className="p-6"><div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center"><ScoreRing score={detail.score} size={140} stroke={10} label="健康度" sublabel={detail.analysisMeta.analysisVersion} /><div className="min-w-0 flex-1 space-y-3"><div className="flex flex-wrap items-center gap-2"><h1 className="font-mono text-2xl font-bold">{detail.name}</h1><Badge variant="outline" className="font-mono">{detail.language}</Badge><Badge variant={detail.status === 'completed' ? 'success' : 'warning'}>{detail.status === 'completed' ? '已分析' : detail.status}</Badge></div><div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"><span>{detail.group}</span><span>·</span><span>{detail.commits.toLocaleString()} commits</span><span>·</span><span>{detail.contributors} 贡献者</span><span>·</span><span>最近扫描 {detail.analysisMeta.scannedAt}</span></div><div className="flex flex-wrap gap-2 text-xs"><Badge variant="outline">分支 {detail.analysisMeta.branch}</Badge><Badge variant="outline">{detail.analysisMeta.commit}</Badge><Badge variant="outline">{detail.analysisMeta.filesScanned} 文件</Badge><Badge variant="outline">覆盖 {detail.analysisMeta.coverage}%</Badge><Badge variant="outline">置信度 {Math.round(detail.analysisMeta.confidence * 100)}%</Badge></div></div></div></CardContent></Card>
      <div className="overflow-x-auto pb-1"><Segmented value={tab} onChange={(value) => { if (value === 'env') { router.push(`/projects/${id}/env`); return; } setTab(value); if (value !== 'review') setReviewModule(null); }} options={[{ value: 'overview', label: '概览', icon: Activity }, { value: 'review', label: `AI Review ${detail.reviewSummary.open}`, icon: Sparkles }, { value: 'modules', label: `模块风险 ${detail.moduleRisks.length}`, icon: Layers3 }, { value: 'fixes', label: `修复计划 ${fixes.filter((fix) => fix.status !== 'resolved').length}`, icon: ClipboardCheck }, { value: 'env', label: '环境盘点', icon: DatabaseZap }]} /></div>
      {tab === 'overview' && <OverviewTab detail={detail} fixes={fixes} onSelectInsight={setSelectedInsight} onSelectFix={selectFix} onOpenReview={() => setTab('review')} />}
      {tab === 'review' && <ReviewTab detail={detail} insights={reviewInsights} onSelectInsight={setSelectedInsight} />}
      {tab === 'modules' && <ModulesTab detail={detail} onSelectModule={setSelectedModule} />}
      {tab === 'fixes' && <FixesTab fixes={fixes} insights={detail.aiInsights} onSelectFix={selectFix} onUpdateStatus={updateFixStatus} />}
      {reviewModule && tab === 'review' && <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm"><span>当前仅显示模块：<b className="font-mono">{reviewModule}</b></span><Button size="sm" variant="ghost" onClick={() => setReviewModule(null)}>清除筛选</Button></div>}
      <InsightSheet insight={selectedInsight ? detail.aiInsights.find((insight) => insight.id === selectedInsight.id) || selectedInsight : null} onClose={() => setSelectedInsight(null)} onUpdate={updateInsight} />
      <ModuleSheet module={selectedModule} onClose={() => setSelectedModule(null)} onViewReview={viewModuleReview} />
      <FixSheet fix={activeFix || null} insight={relatedInsight} onClose={() => setSelectedFix(null)} onViewInsight={() => { setSelectedFix(null); if (relatedInsight) { setSelectedInsight(relatedInsight); setTab('review'); } }} onUpdateStatus={updateFixStatus} />
    </div>
  );
}
