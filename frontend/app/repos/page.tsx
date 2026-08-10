/**
 * Git 仓库管理页
 * 仓库列表表格 + 状态 Badge + 操作按钮
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Trash2, Eye, GitBranch, Users, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageHeader } from '@/components/widgets';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import type { Repository, Project, TeamSpace } from '@/lib/types';

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  synced: { label: '已同步', variant: 'success' },
  syncing: { label: '同步中', variant: 'warning' },
  failed: { label: '失败', variant: 'danger' },
};

export default function ReposPage() {
  const [repos, setRepos] = React.useState<Repository[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [teamSpaces, setTeamSpaces] = React.useState<TeamSpace[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncingId, setSyncingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const { toast, ToastViewport } = useToast();

  const loadAll = React.useCallback(() => {
    setLoading(true);
    Promise.all([api.getRepos(), api.getProjects(), api.getTeamSpaces()])
      .then(([r, p, t]) => { setRepos(r); setProjects(p); setTeamSpaces(t); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  const handleSync = async (repo: Repository) => {
    if (!repo.projectId || syncingId) return;
    setSyncingId(repo.id);
    try {
      await api.reanalyzeProject(repo.projectId);
      toast.success('已触发重新分析', `仓库「${repo.name}」将在后台拉取最新代码。`);
    } catch (e) {
      toast.error('重新分析失败', e instanceof Error ? e.message : '请稍后重试');
    } finally {
      setSyncingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.deleteProject(deleteTarget);
      toast.success('项目已删除', '相关数据已一并清理。');
      setDeleteTarget(null);
      loadAll();
    } catch (e) {
      toast.error('删除失败', e instanceof Error ? e.message : '请稍后重试');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return <div className="space-y-6"><div className="h-8 w-64 skeleton rounded" /><div className="h-96 skeleton rounded-xl" /></div>;
  const totalCommits = repos.reduce((s, r) => s + r.commits, 0);
  const syncedCount = repos.filter((r) => r.status === 'synced').length;

  return (
    <>
      <PageHeader
        title="Git 仓库管理"
        description="管理已接入的 Git 仓库，查看同步状态与基础统计"
        actions={
          <Link href="/onboard">
            <Button variant="accent"><Plus className="h-4 w-4" />接入新仓库</Button>
          </Link>
        }
      />

      {/* 汇总统计 */}
      <div className="mb-4 flex items-center gap-4 rounded-lg border border-border bg-muted/20 px-4 py-2 text-sm">
        <span>共 <span className="font-mono tabular-nums font-medium">{repos.length}</span> 个仓库</span>
        <span className="text-muted-foreground">·</span>
        <span>已同步 <span className="font-mono tabular-nums font-medium text-success">{syncedCount}</span></span>
        <span className="text-muted-foreground">·</span>
        <span>总 commits <span className="font-mono tabular-nums font-medium">{totalCommits.toLocaleString()}</span></span>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>仓库名</TableHead>
              <TableHead>来源 / 地址</TableHead>
              <TableHead>分支</TableHead>
              <TableHead>所属团队</TableHead>
              <TableHead>关联项目</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">commits</TableHead>
              <TableHead className="text-right">贡献者</TableHead>
              <TableHead>最后同步</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {repos.map((repo) => {
              const status = STATUS_CONFIG[repo.status];
              const team = teamSpaces.find((space) => space.id === repo.teamId);
              const project = projects.find((item) => item.id === repo.projectId);
              return (
                <TableRow key={repo.id}>
                  <TableCell className="font-mono font-medium">{repo.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{repo.provider || '远程'}</Badge>
                      <span className="max-w-[280px] truncate font-mono text-xs text-muted-foreground" title={repo.remoteUrl}>{repo.remoteUrl}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      <GitBranch className="h-3 w-3" />
                      {repo.branch}
                    </Badge>
                  </TableCell>
                  <TableCell>{team ? <Badge variant="secondary">{team.name}</Badge> : <span className="text-xs text-muted-foreground">未归属</span>}</TableCell>
                  <TableCell>{project ? <Link href={`/projects/${project.id}`} className="text-xs font-medium text-primary hover:underline">{project.name}</Link> : <span className="text-xs text-muted-foreground">待关联</span>}</TableCell>
                  <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{repo.commits.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{repo.contributors}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{repo.lastSync}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="重新分析"
                        title="触发重新分析"
                        disabled={repo.id === syncingId}
                        onClick={() => void handleSync(repo)}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${repo.id === syncingId ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="查看详情"
                        title="打开项目详情"
                        disabled={!repo.projectId}
                        onClick={() => repo.projectId && (window.location.href = `/projects/${repo.projectId}`)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:text-destructive"
                        aria-label="删除"
                        title="删除项目"
                        disabled={!repo.projectId || repo.id === syncingId}
                        onClick={() => repo.projectId && setDeleteTarget(repo.projectId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除项目"
        description="项目、分析结果、报告与环境盘点数据将一并删除，且无法恢复。确定继续吗？"
        confirmText="删除"
        danger
        loading={deleteLoading}
        onConfirm={() => void confirmDelete()}
        onClose={() => { if (!deleteLoading) setDeleteTarget(null); }}
      />
      <ToastViewport />
    </>
  );
}
