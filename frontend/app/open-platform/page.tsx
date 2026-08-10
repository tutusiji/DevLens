/**
 * P6 开放平台：应用级 API Token 管理 + 组织风险预警中心
 */
'use client';

import * as React from 'react';
import { KeyRound, Plus, Trash2, ShieldAlert, Loader2, Copy, Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/widgets';
import { api } from '@/lib/api';
import type { ApiTokenM, RiskCenter } from '@/lib/types';

const LEVEL_VARIANT: Record<string, 'danger' | 'warning' | 'secondary'> = {
  P0: 'danger', P1: 'warning', P2: 'secondary',
};

export default function OpenPlatformPage() {
  const [tokens, setTokens] = React.useState<ApiTokenM[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState('');
  const [scope, setScope] = React.useState<'read' | 'write'>('read');
  const [creating, setCreating] = React.useState(false);
  const [newToken, setNewToken] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const [risk, setRisk] = React.useState<RiskCenter | null>(null);
  const [riskLoading, setRiskLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([api.getApiTokens(), api.getRiskCenter()])
      .then(([t, r]) => { setTokens(t); setRisk(r); })
      .catch(() => {})
      .finally(() => { setLoading(false); setRiskLoading(false); });
  }, []);

  const createToken = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setNewToken('');
    try {
      const created = await api.createApiToken({ name: name.trim(), scope });
      setNewToken(created.token || '');
      setTokens((prev) => [...prev, created]);
      setName('');
    } finally {
      setCreating(false);
    }
  };

  const removeToken = async (id: string) => {
    if (!window.confirm('删除后该 Token 立即失效，确认删除？')) return;
    await api.deleteApiToken(id);
    setTokens((prev) => prev.filter((t) => t.id !== id));
  };

  if (loading) return <div className="space-y-6"><div className="h-8 w-64 skeleton rounded" /><div className="grid gap-4 lg:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-64 skeleton rounded-xl" />)}</div></div>;

  return (
    <>
      <PageHeader title="开放平台" description="应用级 API Token 管理与组织风险预警" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* API Token 管理 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" />API Token</CardTitle>
            <CardDescription>供外部系统（CI / 数据平台）通过 X-API-Key 读取数据</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token 名称，如 CI 集成" className="flex-1 min-w-[160px]" />
              <select value={scope} onChange={(e) => setScope(e.target.value as 'read' | 'write')} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none">
                <option value="read">只读</option>
                <option value="write">读写</option>
              </select>
              <Button variant="accent" disabled={creating || !name.trim()} onClick={() => void createToken()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}创建
              </Button>
            </div>

            {newToken && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                <p className="text-xs font-medium text-success">Token 已创建，请立即复制保存（仅显示一次）</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 break-all rounded border border-border bg-muted px-2 py-1 font-mono text-xs">{newToken}</code>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(newToken); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {tokens.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">暂无 API Token</p>
              ) : tokens.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t.name}</span>
                      <Badge variant={t.scope === 'write' ? 'warning' : 'secondary'}>{t.scope === 'write' ? '读写' : '只读'}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      创建 {t.createdAt} · 最近使用 {t.lastUsedAt || '—'}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => void removeToken(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              调用示例：<code className="rounded bg-muted px-1.5 py-0.5 font-mono">curl -H "X-API-Key: dl_xxx" {`{API_BASE}`}/open/projects</code>
            </p>
          </CardContent>
        </Card>

        {/* 组织风险预警 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-warning" />组织风险预警</CardTitle>
            <CardDescription>Bus Factor / 能力缺口 / 技术债 / 评估盲区 自动分级</CardDescription>
          </CardHeader>
          <CardContent>
            {riskLoading ? (
              <div className="h-40 rounded-xl skeleton" />
            ) : (
              <>
                <div className="mb-4 grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg border border-border/60 p-2">
                    <div className="font-mono text-2xl font-bold">{risk?.summary.total ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">全部</div>
                  </div>
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2">
                    <div className="font-mono text-2xl font-bold text-destructive">{risk?.summary.P0 ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">P0 紧急</div>
                  </div>
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-2">
                    <div className="font-mono text-2xl font-bold text-warning">{risk?.summary.P1 ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">P1 关注</div>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2">
                    <div className="font-mono text-2xl font-bold">{risk?.summary.P2 ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">P2 持续</div>
                  </div>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {(risk?.alerts ?? []).length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">当前无风险预警，组织健康</p>
                  ) : risk?.alerts.map((alert, index) => (
                    <div key={index} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={LEVEL_VARIANT[alert.level]}>{alert.level}</Badge>
                        <span className="text-sm font-medium">{alert.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{alert.detail}</p>
                      {alert.owner && <p className="mt-1 text-[10px] text-muted-foreground/70">负责人：{alert.owner}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
