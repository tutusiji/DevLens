/**
 * 组织空间（租户）切换器：顶栏下拉，切换时写入 localStorage 'devlens-tenant-id' 并刷新页面。
 * 所有 API 请求通过 api.ts 自动附带 X-DevLens-Tenant-Id 头，实现数据隔离。
 */
'use client';

import * as React from 'react';
import { Building2, Check, ChevronDown, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover } from '@heroui/react/popover';
import { api } from '@/lib/api';
import type { Tenant } from '@/lib/types';

const STORAGE_KEY = 'devlens-tenant-id';
const USER_KEY = 'devlens-user-id';
/** 本地开发默认身份（生产环境由上游网关注入身份头，不经过 localStorage） */
const LOCAL_DEFAULT_USER_ID = 'usr-local-admin';

function getStoredTenantId(): string {
  if (typeof window === 'undefined') return 'tenant-default';
  return localStorage.getItem(STORAGE_KEY) || 'tenant-default';
}

export function TenantSwitcher() {
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [currentId, setCurrentId] = React.useState<string>('tenant-default');
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // 本地模式需同时具备 user + tenant 身份头，否则后端 401；
    // 无 user-id 时回退到本地默认管理员（生产由网关注入，此处不生效于网关场景）
    if (!localStorage.getItem(USER_KEY)) {
      localStorage.setItem(USER_KEY, LOCAL_DEFAULT_USER_ID);
    }
    setCurrentId(getStoredTenantId());
    api
      .listTenants()
      .then((list) => {
        setTenants(list);
        // 若当前存储的租户不在列表（已被移除），回退到第一个
        if (list.length > 0 && !list.some((t) => t.id === getStoredTenantId())) {
          const fallback = list[0];
          localStorage.setItem(STORAGE_KEY, fallback.id);
          setCurrentId(fallback.id);
        }
      })
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
  }, []);

  const current = tenants.find((t) => t.id === currentId);

  const switchTenant = (tenantId: string) => {
    if (tenantId === currentId) {
      setOpen(false);
      return;
    }
    localStorage.setItem(STORAGE_KEY, tenantId);
    setOpen(false);
    // 数据随租户变化，整页刷新保证所有模块重新拉取
    window.location.reload();
  };

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="flex items-center gap-3 rounded-2xl bg-muted/15 px-4 py-2.5 text-left transition-all hover:bg-muted/25 cursor-pointer"
        aria-label="切换组织空间"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/12">
          <Landmark className="h-4.5 w-4.5 text-accent" />
        </div>
        <div className="max-w-36 min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {current ? current.name : loading ? '加载中…' : '选择组织'}
          </div>
          <div className="text-[11px] text-muted-foreground/70">
            {tenants.length > 0 ? `${tenants.length} 个组织空间` : '组织空间'}
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
      </Popover.Trigger>
      <Popover.Content placement="bottom end" offset={8} className="w-80 overflow-hidden rounded-xl glass-strong shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-b border-border/10">
          <Building2 className="h-3.5 w-3.5" />切换组织空间
        </div>
        {tenants.map((tenant) => (
          <button
            key={tenant.id}
            onClick={() => switchTenant(tenant.id)}
            className={cn(
              'flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-all hover:bg-muted/20',
              tenant.id === currentId && 'bg-primary/8'
            )}
          >
            <div className="min-w-0">
              <div className={cn('truncate font-medium', tenant.id === currentId && 'text-primary')}>
                {tenant.name}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground/70">/{tenant.slug}</div>
            </div>
            {tenant.id === currentId && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        ))}
        {tenants.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground/70">
            {loading ? '加载组织空间…' : '暂无可用组织空间'}
          </div>
        )}
      </Popover.Content>
    </Popover>
  );
}
