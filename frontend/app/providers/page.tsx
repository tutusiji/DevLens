/**
 * 平台集成：GitHub / GitLab / Gitee 凭证管理 + 仓库发现 + 批量导入
 */
'use client';

import * as React from 'react';
import { GitFork, Github, KeyRound, Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/widgets';
import { EmptyState } from '@/components/filter-bar';
import { api } from '@/lib/api';
import { useTeamSpace, type TeamTreeNode } from '@/components/team-space-provider';
import type { ProviderConfigM, DiscoveredRepo } from '@/lib/types';

const PROVIDER_LABEL: Record<string, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  gitee: 'Gitee',
  gitea: 'Gitea',
  bitbucket: 'Bitbucket',
};

const PROVIDER_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  github: Github,
  gitlab: GitFork,
  gitee: GitFork,
  gitea: GitFork,
  bitbucket: GitFork,
};

function flattenTeams(nodes: TeamTreeNode[]): TeamTreeNode[] {
  return nodes.flatMap((n) => [n, ...flattenTeams(n.children)]);
}

export default function ProvidersPage() {
  const { spaces, teamsTree } = useTeamSpace();
  const [configs, setConfigs] = React.useState<ProviderConfigM[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingProvider, setEditingProvider] = React.useState<string>('github');
  const [form, setForm] = React.useState({ displayName: '', baseUrl: '', accessToken: '', webhookSecret: '' });
  const [saving, setSaving] = React.useState(false);
  const [discoverProvider, setDiscoverProvider] = React.useState('github');
  const [discoverOrg, setDiscoverOrg] = React.useState('');
  const [discovering, setDiscovering] = React.useState(false);
  const [discovered, setDiscovered] = React.useState<DiscoveredRepo[]>([]);
  const [discoverError, setDiscoverError] = React.useState('');
  const [selectedRepos, setSelectedRepos] = React.useState<Set<string>>(new Set());
  const [importTeamId, setImportTeamId] = React.useState('');
  const [importing, setImporting] = React.useState(false);

  const loadConfigs = React.useCallback(() => {
    setLoading(true);
    api.getProviderConfigs().then((c) => { setConfigs(c); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  React.useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await api.upsertProviderConfig({
        provider: editingProvider,
        displayName: form.displayName || undefined,
        baseUrl: form.baseUrl || undefined,
        accessToken: form.accessToken || undefined,
        webhookSecret: form.webhookSecret || undefined,
      });
      setForm({ displayName: '', baseUrl: '', accessToken: '', webhookSecret: '' });
      loadConfigs();
    } finally {
      setSaving(false);
    }
  };

  const runDiscover = async () => {
    setDiscovering(true);
    setDiscoverError('');
    setDiscovered([]);
    setSelectedRepos(new Set());
    try {
      const result = await api.discoverRepos(discoverProvider, discoverOrg || undefined);
      setDiscovered(result.repos);
    } catch (e) {
      setDiscoverError(e instanceof Error ? e.message : '发现仓库失败');
    } finally {
      setDiscovering(false);
    }
  };

  const importSelected = async () => {
    const repos = discovered.filter((r) => selectedRepos.has(r.name));
    if (!repos.length || !importTeamId) return;
    setImporting(true);
    try {
      await api.importRepos({ provider: discoverProvider, repos, teamId: importTeamId });
      setDiscovered([]);
      setSelectedRepos(new Set());
      setDiscoverOrg('');
    } finally {
      setImporting(false);
    }
  };

  const toggleRepo = (name: string) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (loading) return <div className="space-y-6"><div className="h-8 w-64 skeleton rounded" /><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-40 skeleton rounded-xl" />)}</div></div>;

  return (
    <>
      <PageHeader
        title="代码平台集成"
        description="配置 GitHub / GitLab / Gitee 凭证，发现组织仓库并批量接入"
      />

      {/* 凭证列表 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {configs.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3">
            <EmptyState icon={KeyRound} title="尚未配置代码平台凭证" description="配置后即可发现组织仓库并批量导入。" />
          </div>
        )}
        {configs.map((cfg) => {
          const Icon = PROVIDER_ICON[cfg.provider] || GitFork;
          return (
            <Card key={cfg.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{cfg.displayName || PROVIDER_LABEL[cfg.provider] || cfg.provider}</span>
                      <Badge variant={cfg.enabled ? 'success' : 'secondary'}>{cfg.enabled ? '已启用' : '已停用'}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                      {cfg.hasToken ? <Badge variant="outline" className="font-mono">{cfg.tokenMasked}</Badge> : <Badge variant="outline">未配置 Token</Badge>}
                      {cfg.hasWebhookSecret && <Badge variant="outline">Webhook 已配置</Badge>}
                    </div>
                    {cfg.baseUrl && <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{cfg.baseUrl}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => api.deleteProviderConfig(cfg.id).then(loadConfigs)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 新增 / 更新凭证 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>配置平台凭证</CardTitle>
          <CardDescription>Access Token 加密存储；Webhook Secret 用于 push 触发自动重分析。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">平台</label>
              <select value={editingProvider} onChange={(e) => setEditingProvider(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {Object.entries(PROVIDER_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">显示名称（可选）</label>
              <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="如：公司 GitLab" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Base URL（自建实例可选）</label>
              <Input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://gitlab.company.com" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Access Token</label>
              <Input type="password" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder="ghp_*** / glpat-*** / gitee token" className="font-mono" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium">Webhook Secret</label>
              <Input type="password" value={form.webhookSecret} onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })} placeholder="用于 push 事件签名校验" className="font-mono" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="accent" disabled={saving} onClick={() => void saveConfig()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              保存凭证
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 仓库发现 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>发现仓库</CardTitle>
          <CardDescription>按组织 / 用户拉取仓库列表，勾选后批量导入为项目。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">平台</label>
              <select value={discoverProvider} onChange={(e) => setDiscoverProvider(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none">
                {Object.entries(PROVIDER_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <div className="flex-1 space-y-1.5 min-w-[220px]">
              <label className="text-sm font-medium">组织 / 用户</label>
              <Input value={discoverOrg} onChange={(e) => setDiscoverOrg(e.target.value)} placeholder="org 或 username" className="font-mono" />
            </div>
            <Button variant="outline" disabled={discovering || !discoverOrg.trim()} onClick={() => void runDiscover()}>
              {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              发现仓库
            </Button>
          </div>

          {discoverError && <p className="text-sm text-destructive">{discoverError}</p>}

          {discovered.length > 0 && (
            <>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
                {discovered.map((repo) => (
                  <label key={repo.name} className="flex cursor-pointer items-center gap-3 border-b border-border/50 px-3 py-2.5 last:border-0 hover:bg-muted/40">
                    <input type="checkbox" checked={selectedRepos.has(repo.name)} onChange={() => toggleRepo(repo.name)} className="h-4 w-4" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-sm font-medium">{repo.name}</div>
                      {repo.description && <div className="truncate text-xs text-muted-foreground">{repo.description}</div>}
                    </div>
                    <Badge variant={repo.private ? 'warning' : 'success'}>{repo.private ? '私有' : '公开'}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{repo.defaultBranch}</span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5 min-w-[200px]">
                  <label className="text-sm font-medium">导入到团队</label>
                  <select value={importTeamId} onChange={(e) => setImportTeamId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none">
                    <option value="">请选择团队</option>
                    {flattenTeams(teamsTree).map((t) => <option key={t.id} value={t.id}>{t.parentName ? `${t.parentName} / ${t.name}` : t.name}</option>)}
                  </select>
                </div>
                <Button variant="accent" disabled={importing || selectedRepos.size === 0 || !importTeamId} onClick={() => void importSelected()}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  导入 {selectedRepos.size} 个仓库
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
