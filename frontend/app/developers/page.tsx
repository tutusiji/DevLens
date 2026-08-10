/**
 * ③ 开发者列表
 * FilterBar + 排序 + 筛选 + stagger 入场
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  GitCommit,
  Eye,
  Code2,
  Users,
  Activity,
  LayoutGrid,
  ListOrdered,
  FolderKanban,
  ArrowUpRight,
  Loader2,
  ChevronRight,
  Sparkles,
  TrendingUp,
  UsersRound,
  Settings2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader, ScoreRing, staggerContainer, cardItem } from '@/components/widgets';
import { FilterBar, EmptyState } from '@/components/filter-bar';
import { DiceBearAvatar } from '@/components/dicebear-avatar';
import { Segmented } from '@/components/ui/segmented';
import { api } from '@/lib/api';
import type { Developer, DeveloperDetail, TeamSpace } from '@/lib/types';
import { useTeamSpace, type TeamTreeNode } from '@/components/team-space-provider';

const LEVEL_VARIANT: Record<string, 'default' | 'secondary' | 'accent' | 'success'> = {
  // D 高阶能力层用紫色（accent），E 资深工程师用绿色，F 中高级用蓝色，G 成长层用次级色
  D: 'accent',
  E: 'success',
  F: 'default',
  G: 'secondary',
};

function levelVariant(level: string) {
  return LEVEL_VARIANT[level[0]] || 'secondary';
}

// D > E > F > G；同一大级内 3 > 2 > 1
const LEVEL_ORDER: Record<string, number> = {
  D1: 10, D2: 11, D3: 12,
  E1: 7, E2: 8, E3: 9,
  F1: 4, F2: 5, F3: 6,
  G1: 1, G2: 2, G3: 3,
};

type SortKey = 'overall' | 'commits' | 'reviews' | 'level';

type ViewMode = 'cards' | 'leaderboard';

/**
 * 当前数据模型中的 commits/reviews 是贡献聚合值，暂以提交与 Review 的
 * 加权结果作为“贡献活跃度”。后续接入按日/周行为流水后可无缝替换为时间窗指标。
 */
function contributionActivity(dev: Developer): number {
  return Math.round(dev.commits * 0.7 + dev.reviews * 1.3);
}

function InsightStat({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'primary',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint: string;
  tone?: 'primary' | 'success' | 'warning';
}) {
  const toneClass = tone === 'success'
    ? 'bg-success/12 text-success'
    : tone === 'warning'
      ? 'bg-warning/12 text-warning'
      : 'bg-primary/12 text-primary';

  return (
    <Card className="group overflow-hidden border-border/70 bg-card/80 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="truncate font-mono text-lg font-bold tabular-nums text-foreground">{value}</span>
            <span className="truncate text-[11px] text-muted-foreground">{hint}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityLeaderboard({
  developers,
  selectedId,
  detail,
  detailLoading,
  detailError,
  onSelect,
  onRetry,
}: {
  developers: Developer[];
  selectedId: string | null;
  detail: DeveloperDetail | null;
  detailLoading: boolean;
  detailError: string;
  onSelect: (id: string) => void;
  onRetry: () => void;
}) {
  const maxActivity = Math.max(1, ...developers.map(contributionActivity));
  const selectedRank = selectedId ? developers.findIndex((developer) => developer.id === selectedId) + 1 : 0;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(340px,0.82fr)_minmax(0,1.45fr)]">
      <Card className="min-w-0 lg:sticky lg:top-24">
        <CardHeader className="border-b border-border/70 bg-primary/[0.025] pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                <Activity className="h-3.5 w-3.5" />
                Team signal
              </div>
              <CardTitle className="flex items-center gap-2 text-base">
                活跃度排行
              </CardTitle>
            </div>
            <Badge variant="outline" className="shrink-0 font-mono text-xs">{developers.length} 人</Badge>
          </div>
          <CardDescription className="mt-2 max-w-md leading-relaxed">
            以 commits × 0.7 + reviews × 1.3 计算贡献活跃度。点击一行，右侧查看项目上下文。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 sm:p-3">
          <div className="mb-2 flex items-center justify-between px-2 text-[11px] text-muted-foreground">
            <span>排名 · 开发者</span>
            <span>活跃值</span>
          </div>
          <div role="listbox" aria-label="开发者活跃度排行" className="space-y-1">
            {developers.map((dev, index) => {
              const active = dev.id === selectedId;
              const activity = contributionActivity(dev);
              const ratio = Math.round((activity / maxActivity) * 100);
              return (
                <button
                  type="button"
                  key={dev.id}
                  onClick={() => onSelect(dev.id)}
                  role="option"
                  aria-selected={active}
                  className={`group relative w-full cursor-pointer rounded-xl px-2.5 py-3 text-left transition-[background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:px-3 ${active ? 'bg-primary/[0.09] shadow-sm ring-1 ring-primary/35' : 'hover:bg-muted/55'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${index < 3 ? 'bg-primary/12 text-primary' : 'text-muted-foreground'}`}>
                      {index + 1}
                    </span>
                    <DiceBearAvatar seed={dev.username} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">{dev.name}</span>
                        <Badge variant={levelVariant(dev.level)} className="font-mono text-[10px]">{dev.level}</Badge>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{dev.role} · {dev.team}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-sm font-bold tabular-nums text-primary">{activity}</div>
                      <div className="text-[10px] text-muted-foreground">活跃值</div>
                    </div>
                  </div>
                  <div className="mt-2 ml-10 h-1.5 overflow-hidden rounded-full bg-muted/70">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${ratio}%` }} />
                  </div>
                  <div className="mt-1.5 ml-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><GitCommit className="h-3 w-3" />{dev.commits} commits</span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{dev.reviews} reviews</span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        {detailError ? (
          <CardContent className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="text-sm font-medium text-destructive">加载开发者详情失败</div>
            <p className="max-w-md text-xs leading-5 text-muted-foreground">{detailError}</p>
            <button type="button" onClick={onRetry} className="rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">重试</button>
          </CardContent>
        ) : detailLoading || !detail ? (
          <CardContent className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />正在加载开发者详情…
          </CardContent>
        ) : (
          <>
            <CardHeader className="border-b border-border/70 bg-primary/[0.025]">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Developer snapshot
                {selectedRank > 0 && <span className="text-muted-foreground">· #{selectedRank}</span>}
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <DiceBearAvatar seed={detail.username} size={52} />
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{detail.name}</CardTitle>
                      <Badge variant={levelVariant(detail.level)} className="font-mono">{detail.level}</Badge>
                    </div>
                    <CardDescription className="mt-1">{detail.role} · {detail.team} · @{detail.username}</CardDescription>
                  </div>
                </div>
                <Link
                  href={`/developers/${detail.id}`}
                  className="inline-flex min-h-10 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <Badge variant="outline" className="cursor-pointer gap-1 px-2.5 py-1.5 text-primary transition-colors hover:bg-primary/10">
                    查看完整画像 <ArrowUpRight className="h-3.5 w-3.5" />
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: '综合评分', value: detail.overall, icon: Sparkles, tone: 'text-primary' },
                  { label: '提交', value: detail.commits, icon: GitCommit, tone: 'text-foreground' },
                  { label: '代码评审', value: detail.reviews, icon: Eye, tone: 'text-foreground' },
                  { label: '参与项目', value: detail.projects?.length ?? 0, icon: FolderKanban, tone: 'text-primary' },
                ].map(({ label, value, icon: Icon, tone }) => (
                  <div key={label} className="rounded-xl border border-border/70 bg-muted/15 p-3 transition-colors hover:border-primary/25 hover:bg-muted/25">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </div>
                    <div className={`mt-1 font-mono text-lg font-bold tabular-nums ${tone}`}>{value}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><FolderKanban className="h-4 w-4 text-primary" />参与项目</h3>
                  <span className="text-xs text-muted-foreground">先看项目，再看模块归属</span>
                </div>
                {(detail.projects ?? []).length ? (
                  <div className="space-y-2">
                    {(detail.projects ?? []).slice(0, 4).map((project) => (
                      <Link key={project.projectId} href={`/projects/${project.projectId}`} className="group flex min-h-14 items-center gap-3 rounded-xl border border-border/70 bg-muted/10 p-3 transition-[background-color,border-color] duration-200 hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-foreground">{project.projectName}</span>
                            <Badge variant={project.ownership >= 60 ? 'success' : 'secondary'}>{project.role}</Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{project.commits} commits · {project.reviews} reviews · {project.moduleCount} 个模块</div>
                        </div>
                        {project.projectScore ? (
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10 font-mono text-xs font-semibold tabular-nums text-primary"
                            aria-label={`项目评分 ${project.projectScore}`}
                          >
                            {project.projectScore}
                          </span>
                        ) : null}
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
                      </Link>
                    ))}
                  </div>
                ) : <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">暂无项目参与记录</div>}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Activity className="h-4 w-4 text-primary" />主导模块</h3>
                  <span className="text-xs text-muted-foreground">项目归属</span>
                </div>
                {(detail.modules ?? []).length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {detail.modules.slice(0, 6).map((module) => (
                      <div key={`${module.projectId || 'unknown'}-${module.module}`} className="rounded-xl border border-border/70 p-3 transition-colors hover:border-primary/25 hover:bg-muted/15">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-sm font-medium text-foreground">{module.module}</div>
                            <div className="mt-1 truncate text-xs text-primary">{module.projectName || '所属项目待归集'}</div>
                          </div>
                          <span className="shrink-0 font-mono text-xs text-foreground">{module.ownership}%</span>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/70">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, module.ownership))}%` }} />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>{module.commits} commits</span><span>复杂度 {module.complexity}</span></div>
                      </div>
                    ))}
                  </div>
                ) : <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">暂无模块归属数据</div>}
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

function DeveloperCard({ dev, onEdit }: { dev: Developer; onEdit: () => void }) {
  return (
    <motion.div variants={cardItem}>
      <Card className="group h-full overflow-hidden border-border/70 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
        <div className="h-0.5 bg-gradient-to-r from-primary via-primary/55 to-transparent" />
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <Link href={`/developers/${dev.id}`} className="shrink-0">
              <DiceBearAvatar seed={dev.username} size={44} />
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/developers/${dev.id}`} className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground hover:underline">{dev.name}</h3>
                <Badge variant={levelVariant(dev.level)} className="font-mono">{dev.level}</Badge>
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>{dev.role}</span><span>·</span><span>{dev.team}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <ScoreRing score={dev.overall} size={46} stroke={4} glow={false} />
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
                className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                title="编辑归属"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {dev.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
            </div>

            <div className="mt-2 flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="flex flex-wrap gap-1.5">
                {dev.langs.slice(0, 3).map((lang) => <Badge key={lang} variant="secondary" className="font-mono">{lang}</Badge>)}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/70 pt-2.5">
              <div className="rounded-lg border border-border/60 bg-muted/60 px-2.5 py-1.5">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><GitCommit className="h-3 w-3" />提交</div>
                <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{dev.commits}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/60 px-2.5 py-1.5">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Eye className="h-3 w-3" />评审</div>
                <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{dev.reviews}</div>
              </div>
            </div>

            <Link href={`/developers/${dev.id}`} className="mt-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>进入能力画像</span>
              <span className="inline-flex items-center gap-1 text-primary transition-transform duration-200 group-hover:translate-x-0.5">
                查看详情 <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </CardContent>
        </Card>
    </motion.div>
  );
}

function DeveloperEditSheet({
  developer,
  spaces,
  teamsTree,
  onClose,
  onSave,
}: {
  developer: Developer;
  spaces: TeamSpace[];
  teamsTree: TeamTreeNode[];
  onClose: () => void;
  onSave: (patch: Partial<Developer>) => Promise<void>;
}) {
  const [teamSpaceId, setTeamSpaceId] = React.useState(developer.teamSpaceId || '');
  const [employeeId, setEmployeeId] = React.useState(developer.employeeId || '');
  const [email, setEmail] = React.useState(developer.email || '');
  const [saving, setSaving] = React.useState(false);

  const flattenTeams = (nodes: TeamTreeNode[]): TeamTreeNode[] => nodes.flatMap((n) => [n, ...flattenTeams(n.children)]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
        <h3 className="text-lg font-semibold">编辑开发者归属</h3>
        <p className="text-sm text-muted-foreground">{developer.name}（{developer.username}）</p>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">组织树团队</label>
            <select
              value={teamSpaceId}
              onChange={(e) => setTeamSpaceId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">未分配</option>
              {flattenTeams(teamsTree).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.parentName ? `${t.parentName} / ${t.name}` : t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">工号</label>
            <input
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="用于身份精确匹配"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">邮箱</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="用于邮箱精确匹配"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            variant="accent"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave({
                teamSpaceId: teamSpaceId || undefined,
                employeeId: employeeId.trim() || undefined,
                email: email.trim() || undefined,
              });
              setSaving(false);
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DevelopersPage() {
  const [developers, setDevelopers] = React.useState<Developer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sortBy, setSortBy] = React.useState<SortKey>('overall');
  const [teamFilter, setTeamFilter] = React.useState('all');
  const [levelFilter, setLevelFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [viewMode, setViewMode] = React.useState<ViewMode>('cards');
  const [selectedDeveloperId, setSelectedDeveloperId] = React.useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = React.useState<DeveloperDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState('');
  const [detailRequestVersion, setDetailRequestVersion] = React.useState(0);
  const [editingDeveloper, setEditingDeveloper] = React.useState<Developer | null>(null);
  const { spaces, teamsTree } = useTeamSpace();

  const loadDevelopers = React.useCallback(() => {
    setLoading(true);
    api.getDevelopers().then((d) => { setDevelopers(d); setLoading(false); });
  }, []);

  React.useEffect(() => {
    loadDevelopers();
  }, [loadDevelopers]);

  const teamOptions = React.useMemo(() => {
    const teams = [...new Set(developers.map((d) => d.team))];
    return teams.map((t) => ({ value: t, label: t }));
  }, [developers]);

  const filtered = React.useMemo(() => {
    let result = developers;
    if (teamFilter !== 'all') result = result.filter((d) => d.team === teamFilter);
    if (levelFilter !== 'all') result = result.filter((d) => d.level.startsWith(levelFilter));
    if (search.trim()) {
      const keyword = search.trim().toLowerCase();
      result = result.filter((d) => d.name.toLowerCase().includes(keyword) || d.username.toLowerCase().includes(keyword));
    }
    return [...result].sort((a, b) => {
      if (sortBy === 'overall') return b.overall - a.overall;
      if (sortBy === 'commits') return b.commits - a.commits;
      if (sortBy === 'reviews') return b.reviews - a.reviews;
      if (sortBy === 'level') return (LEVEL_ORDER[b.level] || 0) - (LEVEL_ORDER[a.level] || 0);
      return 0;
    });
  }, [developers, teamFilter, levelFilter, search, sortBy]);

  const activityRanked = React.useMemo(
    () => [...filtered].sort((a, b) => contributionActivity(b) - contributionActivity(a)),
    [filtered],
  );
  const teamCount = React.useMemo(() => new Set(filtered.map((developer) => developer.teamId)).size, [filtered]);
  const topActivityDeveloper = activityRanked[0];

  React.useEffect(() => {
    if (viewMode !== 'leaderboard') return;
    if (!activityRanked.length) {
      setSelectedDeveloperId(null);
      setSelectedDetail(null);
      return;
    }
    if (!selectedDeveloperId || !activityRanked.some((developer) => developer.id === selectedDeveloperId)) {
      setSelectedDeveloperId(activityRanked[0].id);
    }
  }, [viewMode, activityRanked, selectedDeveloperId]);

  React.useEffect(() => {
    if (viewMode !== 'leaderboard' || !selectedDeveloperId) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError('');
    setSelectedDetail(null);
    api.getDeveloperDetail(selectedDeveloperId)
      .then((detail) => { if (!cancelled) setSelectedDetail(detail); })
      .catch((cause) => { if (!cancelled) setDetailError(cause instanceof Error ? cause.message : '服务暂时不可用，请稍后重试。'); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [viewMode, selectedDeveloperId, detailRequestVersion]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-48 skeleton rounded-xl" />)}
        </div>
      </div>
    );
  }

  const avgScore = filtered.length ? (filtered.reduce((s, d) => s + d.overall, 0) / filtered.length).toFixed(1) : 0;
  const filtersApplied = Boolean(search.trim()) || teamFilter !== 'all' || levelFilter !== 'all';

  return (
    <>
      <PageHeader
        title="开发者画像"
        description="从 Git 行为与代码质量推导个人能力，辅助成长而非考核"
        actions={
          <div className="rounded-lg border border-border/70 bg-muted/20 p-1">
            <Segmented
              value={viewMode}
              onChange={(value) => setViewMode(value as ViewMode)}
              size="sm"
              options={[
                { value: 'cards', label: '卡片模式', icon: LayoutGrid },
                { value: 'leaderboard', label: '活跃度排行', icon: ListOrdered },
              ]}
            />
          </div>
        }
      />

      <section aria-label="开发者数据概览" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InsightStat icon={UsersRound} label="当前可见开发者" value={filtered.length} hint={filtersApplied ? '筛选结果' : '组织成员'} />
        <InsightStat icon={Sparkles} label="团队平均评分" value={avgScore} hint="满分 100" tone="success" />
        <InsightStat
          icon={TrendingUp}
          label="贡献活跃领跑"
          value={topActivityDeveloper ? topActivityDeveloper.name : '—'}
          hint={topActivityDeveloper ? `${contributionActivity(topActivityDeveloper)} 活跃值` : '暂无数据'}
          tone="warning"
        />
        <InsightStat icon={Users} label="覆盖团队" value={teamCount} hint="当前筛选范围" />
      </section>

      <FilterBar
        searchPlaceholder="搜索姓名或用户名..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { key: 'team', label: '团队', options: teamOptions },
          { key: 'level', label: '职级', options: [
            { value: 'D', label: 'D 级（高阶能力）' },
            { value: 'E', label: 'E 级（资深工程师）' },
            { value: 'F', label: 'F 级（中高级工程师）' },
            { value: 'G', label: 'G 级（成长层）' },
          ] },
        ]}
        filterValues={{ team: teamFilter, level: levelFilter }}
        onFilterChange={(key, val) => key === 'team' ? setTeamFilter(val) : setLevelFilter(val)}
        sortOptions={[
          { value: 'overall', label: '按综合评分' },
          { value: 'commits', label: '按 commits' },
          { value: 'reviews', label: '按 reviews' },
          { value: 'level', label: '按级别' },
        ]}
        sortValue={sortBy}
        onSortChange={(v) => setSortBy(v as SortKey)}
        summary={
          <>
            <span>当前范围 <span className="font-mono tabular-nums font-medium">{filtered.length}</span> 人</span>
            <span className="text-muted-foreground">·</span>
            <span>按 {viewMode === 'leaderboard' ? '贡献活跃度' : '当前排序规则'} 浏览</span>
            {filtersApplied && (
              <>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() => { setSearch(''); setTeamFilter('all'); setLevelFilter('all'); }}
                  className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  清除筛选
                </button>
              </>
            )}
          </>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="无匹配开发者"
          description="尝试调整筛选条件或搜索关键词。"
          action={filtersApplied ? (
            <button
              type="button"
              onClick={() => { setSearch(''); setTeamFilter('all'); setLevelFilter('all'); }}
              className="min-h-10 rounded-lg border border-primary/35 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              清除全部筛选
            </button>
          ) : undefined}
        />
      ) : viewMode === 'cards' ? (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((d) => <DeveloperCard key={d.id} dev={d} onEdit={() => setEditingDeveloper(d)} />)}
        </motion.div>
      ) : (
        <ActivityLeaderboard
          developers={activityRanked}
          selectedId={selectedDeveloperId}
          detail={selectedDetail}
          detailLoading={detailLoading}
          detailError={detailError}
          onSelect={setSelectedDeveloperId}
          onRetry={() => setDetailRequestVersion((version) => version + 1)}
        />
      )}
      {editingDeveloper && (
        <DeveloperEditSheet
          developer={editingDeveloper}
          spaces={spaces}
          teamsTree={teamsTree}
          onClose={() => setEditingDeveloper(null)}
          onSave={async (patch) => {
            await api.updateDeveloper(editingDeveloper.id, patch);
            setEditingDeveloper(null);
            loadDevelopers();
          }}
        />
      )}
    </>
  );
}
