/** 租户成员及 RBAC 管理页。 */
'use client';

import * as React from 'react';
import { Building2, KeyRound, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { CurrentTenantContext, TenantMembership, TenantRole } from '@/lib/types';

const ROLE_META: Record<TenantRole, { label: string; description: string; variant: 'accent' | 'default' | 'success' | 'warning' | 'secondary' }> = {
  owner: { label: 'Owner', description: '租户及所有资产的最终管理者', variant: 'accent' },
  admin: { label: 'Admin', description: '管理成员、规则和项目配置', variant: 'default' },
  evaluator: { label: 'Evaluator', description: '执行实测、查看趋势并导出报告', variant: 'success' },
  analyst: { label: 'Analyst', description: '查看评估、趋势并导出报告', variant: 'warning' },
  viewer: { label: 'Viewer', description: '只读查看项目、开发者、规则与评估', variant: 'secondary' },
};

export default function AccessControlPage() {
  const [context, setContext] = React.useState<CurrentTenantContext | null>(null);
  const [members, setMembers] = React.useState<TenantMembership[]>([]);
  const [email, setEmail] = React.useState('');
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState<TenantRole>('viewer');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [current, memberships] = await Promise.all([
        api.getCurrentTenantContext(),
        api.getTenantMembers(),
      ]);
      setContext(current);
      setMembers(memberships);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取租户权限失败');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const addMember = async () => {
    if (!email.trim()) return;
    setSaving(true);
    try {
      await api.addTenantMember({ email: email.trim(), name: name.trim(), role });
      setEmail('');
      setName('');
      setRole('viewer');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '邀请成员失败');
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (membership: TenantMembership, nextRole: TenantRole) => {
    try {
      await api.updateTenantMember(membership.id, nextRole);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '更新角色失败');
    }
  };

  const removeMember = async (membershipId: string) => {
    try {
      await api.removeTenantMember(membershipId);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '移除成员失败');
    }
  };

  const canManage = context?.permissions.includes('*') || context?.permissions.includes('tenant:manage');

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm text-primary"><ShieldCheck className="h-4 w-4" />Tenant boundary & RBAC</div>
        <h1 className="text-2xl font-bold tracking-tight">租户与权限</h1>
        <p className="mt-1 text-sm text-muted-foreground">成员授权由租户隔离；项目、规则、评估、趋势和报告 API 均在当前 tenant context 中执行。</p>
      </div>

      {error && <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      {context && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardContent className="flex gap-3 p-5"><Building2 className="mt-0.5 h-5 w-5 text-primary" /><div><div className="text-xs text-muted-foreground">当前租户</div><div className="mt-1 font-semibold">{context.tenant.name}</div><div className="font-mono text-xs text-muted-foreground">{context.tenant.slug} · {context.tenant.id}</div></div></CardContent></Card>
          <Card><CardContent className="flex gap-3 p-5"><KeyRound className="mt-0.5 h-5 w-5 text-primary" /><div><div className="text-xs text-muted-foreground">当前身份</div><div className="mt-1 font-semibold">{context.user.name} <Badge variant={ROLE_META[context.role].variant}>{ROLE_META[context.role].label}</Badge></div><div className="text-xs text-muted-foreground">{context.user.email}</div></div></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />成员与角色</CardTitle><CardDescription>Owner/Admin 可维护成员关系。生产环境须由 SSO/API Gateway 注入 X-DevLens-User-Id 与 X-DevLens-Tenant-Id。</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          {canManage && (
            <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 md:grid-cols-[1fr_1fr_180px_auto]">
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="成员邮箱" type="email" />
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="姓名（可选）" />
              <select value={role} onChange={(event) => setRole(event.target.value as TenantRole)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                {Object.entries(ROLE_META).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
              </select>
              <Button disabled={saving || !email.trim()} onClick={() => void addMember()}><Plus className="h-4 w-4" />添加成员</Button>
            </div>
          )}

          <div className="space-y-2">
            {loading ? <div className="py-8 text-center text-sm text-muted-foreground">正在加载成员…</div> : members.map((membership) => {
              const meta = ROLE_META[membership.role];
              return <div key={membership.id} className="flex flex-col gap-3 rounded-lg border border-border/70 p-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1"><div className="font-medium">{membership.user?.name || membership.userId}</div><div className="truncate text-xs text-muted-foreground">{membership.user?.email || membership.userId}</div></div>
                <div className="max-w-md text-xs text-muted-foreground">{meta.description}</div>
                {canManage ? <select value={membership.role} onChange={(event) => void changeRole(membership, event.target.value as TenantRole)} className="h-9 rounded-lg border border-border bg-background px-2 text-sm"><>{Object.entries(ROLE_META).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</></select> : <Badge variant={meta.variant}>{meta.label}</Badge>}
                {canManage && <Button size="sm" variant="ghost" aria-label="移除成员" onClick={() => void removeMember(membership.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </div>;
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
