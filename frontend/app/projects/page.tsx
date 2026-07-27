/**
 * ② 项目列表
 * FilterBar + 卡片/表格双视图 + 汇总统计 + 空状态 + stagger 入场
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus, GitCommit, Users, Clock, LayoutGrid, Table as TableIcon, FolderGit2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageHeader, ScoreRing, ProgressBar, staggerContainer, cardItem } from '@/components/widgets';
import { FilterBar, EmptyState } from '@/components/filter-bar';
import { api } from '@/lib/api';
import { scoreColor } from '@/lib/utils';
import type { Project, ProjectStatus } from '@/lib/types';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; variant: 'success' | 'warning' | 'secondary' | 'danger' }> = {
  completed: { label: '已完成', variant: 'success' },
  analyzing: { label: '分析中', variant: 'warning' },
  pending: { label: '待分析', variant: 'secondary' },
  failed: { label: '失败', variant: 'danger' },
};

type ViewMode = 'card' | 'table';
type SortKey = 'score' | 'name' | 'commits' | 'debt';

function ProjectCardView({ project }: { project: Project }) {
  const status = STATUS_CONFIG[project.status];
  return (
    <motion.div variants={cardItem}>
      <Link href={`/projects/${project.id}`}>
        <Card className="cursor-pointer transition-all hover:scale-[1.02] hover:border-primary/40 hover:shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-mono text-base font-semibold">{project.name}</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{project.group}</span>
                  <span>·</span>
                  <Badge variant="outline" className="font-mono">{project.language}</Badge>
                </div>
              </div>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <ScoreRing score={project.score} size={72} stroke={6} label="健康度" />
              <div className="flex-1 space-y-2">
                <ProgressBar label="质量" value={project.quality} showValue={false} indicatorClassName={scoreColor(project.quality) === 'var(--success)' ? 'bg-success' : 'bg-primary'} />
                <ProgressBar label="安全" value={project.security} showValue={false} indicatorClassName={scoreColor(project.security) === 'var(--success)' ? 'bg-success' : 'bg-warning'} />
                <ProgressBar label="技术债" value={project.debt} showValue={false} indicatorClassName="bg-destructive" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><GitCommit className="h-3 w-3" /><span className="font-mono tabular-nums">{project.commits.toLocaleString()}</span> commits</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /><span className="font-mono tabular-nums">{project.contributors}</span> 贡献者</span>
              <span className="ml-auto flex items-center gap-1"><Clock className="h-3 w-3" />{project.lastAnalyzed}</span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

function ProjectTableView({ projects }: { projects: Project[] }) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>项目</TableHead>
            <TableHead>团队</TableHead>
            <TableHead>语言</TableHead>
            <TableHead className="text-right">健康度</TableHead>
            <TableHead className="text-right">质量</TableHead>
            <TableHead className="text-right">安全</TableHead>
            <TableHead className="text-right">技术债</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">commits</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => {
            const status = STATUS_CONFIG[p.status];
            return (
              <TableRow key={p.id} onClick={() => window.location.href = `/projects/${p.id}`} className="cursor-pointer">
                <TableCell className="font-mono font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">{p.group}</TableCell>
                <TableCell><Badge variant="outline" className="font-mono">{p.language}</Badge></TableCell>
                <TableCell className="text-right">
                  <span className="font-mono font-bold tabular-nums" style={{ color: scoreColor(p.score) }}>{p.score}</span>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{p.quality}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{p.security}</TableCell>
                <TableCell className="text-right font-mono tabular-nums" style={{ color: 'var(--destructive)' }}>{p.debt}</TableCell>
                <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{p.commits.toLocaleString()}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<ViewMode>('card');
  const [sortBy, setSortBy] = React.useState<SortKey>('score');
  const [langFilter, setLangFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    api.getProjects().then((p) => {
      setProjects(p);
      setLoading(false);
    });
  }, []);

  // 语言选项
  const langOptions = React.useMemo(() => {
    const langs = [...new Set(projects.map((p) => p.language))];
    return langs.map((l) => ({ value: l, label: l }));
  }, [projects]);

  // 筛选 + 排序
  const filtered = React.useMemo(() => {
    let result = projects;
    if (langFilter !== 'all') result = result.filter((p) => p.language === langFilter);
    if (statusFilter !== 'all') result = result.filter((p) => p.status === statusFilter);
    if (search.trim()) result = result.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    return [...result].sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'commits') return b.commits - a.commits;
      if (sortBy === 'debt') return b.debt - a.debt;
      return 0;
    });
  }, [projects, langFilter, statusFilter, search, sortBy]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-64 skeleton rounded-xl" />)}
        </div>
      </div>
    );
  }

  const avgScore = projects.length ? (projects.reduce((s, p) => s + p.score, 0) / projects.length).toFixed(1) : 0;
  const highRisk = projects.filter((p) => p.score < 70).length;

  return (
    <>
      <PageHeader
        title="项目评估"
        description="从代码质量、安全、技术债、活跃度多维度评估项目健康度"
        actions={
          <Link href="/onboard">
            <Button variant="accent"><Plus className="h-4 w-4" />接入项目</Button>
          </Link>
        }
      />

      <FilterBar
        searchPlaceholder="搜索项目名..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { key: 'lang', label: '语言', options: langOptions },
          { key: 'status', label: '状态', options: [
            { value: 'completed', label: '已完成' },
            { value: 'analyzing', label: '分析中' },
            { value: 'pending', label: '待分析' },
          ] },
        ]}
        filterValues={{ lang: langFilter, status: statusFilter }}
        onFilterChange={(key, val) => key === 'lang' ? setLangFilter(val) : setStatusFilter(val)}
        sortOptions={[
          { value: 'score', label: '按健康度' },
          { value: 'name', label: '按名称' },
          { value: 'commits', label: '按 commits' },
          { value: 'debt', label: '按技术债' },
        ]}
        sortValue={sortBy}
        onSortChange={(v) => setSortBy(v as SortKey)}
        viewMode={viewMode}
        viewModes={[
          { value: 'card', label: '卡片', icon: LayoutGrid },
          { value: 'table', label: '表格', icon: TableIcon },
        ]}
        onViewModeChange={(v) => setViewMode(v as ViewMode)}
        summary={
          <>
            <span>共 <span className="font-mono tabular-nums font-medium">{filtered.length}</span> 个项目</span>
            <span className="text-muted-foreground">·</span>
            <span>平均健康度 <span className="font-mono tabular-nums font-medium" style={{ color: scoreColor(Number(avgScore)) }}>{avgScore}</span></span>
            <span className="text-muted-foreground">·</span>
            <span>高风险 <span className="font-mono tabular-nums font-medium text-destructive">{highRisk}</span></span>
          </>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="无匹配项目"
          description="尝试调整筛选条件，或接入新的 Git 仓库"
          action={<Link href="/onboard"><Button variant="accent"><Plus className="h-4 w-4" />接入项目</Button></Link>}
        />
      ) : viewMode === 'card' ? (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((p) => <ProjectCardView key={p.id} project={p} />)}
        </motion.div>
      ) : (
        <ProjectTableView projects={filtered} />
      )}
    </>
  );
}
