/**
 * AppShell - 研发决策工作台
 * 稳定的 240px 侧栏、清晰的层级边界与紧凑导航。
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FolderGit2, Users, Network, Rocket,
  Activity, ChevronRight, Menu, Search, Bell,
  GitBranch, Bot, Database, Ruler, Building2, ChevronDown,
  ShieldCheck, GitCompareArrows, UserCog, Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover } from '@heroui/react/popover';
import { ThemeToggle } from '@/components/theme-toggle';
import { CommandPalette } from '@/components/command-palette';
import { TenantSwitcher } from '@/components/tenant-switcher';
import { useTeamSpace } from '@/components/team-space-provider';
import { riskAlerts } from '@/lib/mock-data';
import { Sheet } from '@/components/ui/sheet';

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ANALYSIS_NAV: NavItem[] = [
  { href: '/', label: '决策总览', description: '结论 · 风险 · 行动', icon: Activity },
  { href: '/projects', label: '项目评估', description: '代码质量 · 健康度', icon: FolderGit2 },
  { href: '/project-portfolio', label: '项目组合对比', description: '横向评估 · 历史趋势', icon: GitCompareArrows },
  { href: '/developers', label: '开发者画像', description: '能力 · 成长 · 协作', icon: Users },
  { href: '/teams', label: '团队分析', description: 'Bus Factor · 缺口', icon: Network },
  { href: '/architecture-design', label: '架构设计图谱', description: '分层方案 · 技术治理', icon: Compass },
];

const SYSTEM_NAV: NavItem[] = [
  { href: '/team-spaces', label: '团队空间管理', description: '团队 · 小组 · 成员归属', icon: Building2 },
  { href: '/skills', label: 'Skill 管理', description: '规则库 · 编组 · 规范来源', icon: ShieldCheck },
  { href: '/onboard', label: '接入项目', description: 'Git 仓库 · 身份匹配', icon: Rocket },
  { href: '/repos', label: 'Git 仓库管理', description: '仓库列表 · 同步状态', icon: GitBranch },
  { href: '/models', label: '大模型管理', description: 'OpenAI · Anthropic', icon: Bot },
  { href: '/vector-models', label: '向量模型管理', description: 'Embedding · 索引', icon: Database },
  { href: '/capability-standards', label: '能力标准', description: '角色 · 级别 · 阈值', icon: Ruler },
  { href: '/access-control', label: '租户与权限', description: '成员 · RBAC · 数据隔离', icon: UserCog },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex min-h-10 items-center gap-2.5 border-l-2 border-transparent px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        active
          ? 'border-l-primary bg-sidebar-accent text-foreground'
          : 'text-sidebar-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium leading-5">{item.label}</div>
        <div className="truncate text-[10px] leading-4 text-muted-foreground">{item.description}</div>
      </div>
      {active && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" />}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = React.useState(false);
  const { spaces, largeTeams, activeLargeTeam, setActiveLargeTeamId } = useTeamSpace();

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const highRiskCount = riskAlerts.filter((r) => r.level === 'high').length;
  const currentSection = ANALYSIS_NAV.find((n) => isActive(n.href))?.label || SYSTEM_NAV.find((n) => isActive(n.href))?.label || '决策总览';

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
          <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground">
            <Activity className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-[15px] font-bold tracking-tight text-foreground">DevLens</div>
            <div className="text-[10px] text-muted-foreground">研发棱镜 · v0.1</div>
          </div>
        </div>

        <nav aria-label="主导航" className="flex-1 overflow-y-auto py-4">
          <div className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">分析模块</div>
          <div className="space-y-px">
            {ANALYSIS_NAV.map((item) => <NavLink key={item.href} item={item} active={isActive(item.href)} />)}
          </div>
          <div className="mx-4 my-4 border-t border-sidebar-border" />
          <div className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">系统管理</div>
          <div className="space-y-px">
            {SYSTEM_NAV.map((item) => <NavLink key={item.href} item={item} active={isActive(item.href)} />)}
          </div>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 border border-sidebar-border bg-card px-2.5 py-2">
            <div className="flex h-7 w-7 items-center justify-center bg-muted font-mono text-[11px] font-semibold text-foreground">TL</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">技术负责人</div>
              <div className="truncate text-[10px] text-muted-foreground">tech-lead@devlens.io</div>
            </div>
          </div>
        </div>
      </aside>

      <Sheet open={mobileOpen} onClose={() => setMobileOpen(false)} side="left" width="sm" title="DevLens 导航" description="研发决策与系统管理" className="p-0">
        <div className="space-y-5 pb-4">
          <div className="grid gap-2 sm:hidden">
            <TenantSwitcher />
            <Link href="/team-spaces" onClick={() => setMobileOpen(false)} className="flex min-h-10 items-center gap-2 border border-border bg-card px-3 text-sm font-medium text-primary transition-colors hover:bg-muted">
              <Building2 className="h-4 w-4" />管理团队空间
            </Link>
          </div>
          <nav aria-label="移动端主导航" className="space-y-5">
            <div className="space-y-1">
              <div className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">分析模块</div>
              {ANALYSIS_NAV.map((item) => <div key={item.href} onClick={() => setMobileOpen(false)}><NavLink item={item} active={isActive(item.href)} /></div>)}
            </div>
            <div className="space-y-1 border-t border-border pt-5">
              <div className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">系统管理</div>
              {SYSTEM_NAV.map((item) => <div key={item.href} onClick={() => setMobileOpen(false)}><NavLink item={item} active={isActive(item.href)} /></div>)}
            </div>
          </nav>
        </div>
      </Sheet>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="打开菜单"><Menu className="h-5 w-5" /></Button>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <span className="font-mono text-foreground">DevLens</span><ChevronRight className="h-3.5 w-3.5" /><span className="font-medium text-foreground">{currentSection}</span>
          </div>

          <div className="ml-auto hidden items-center gap-2 md:flex">
            <TenantSwitcher />
            {activeLargeTeam ? (
              <Popover isOpen={teamMenuOpen} onOpenChange={setTeamMenuOpen}>
                <Popover.Trigger className="flex items-center gap-2 border border-border bg-card px-2.5 py-1.5 text-left transition-colors hover:bg-muted cursor-pointer" aria-label="切换大团队">
                  <Building2 className="h-4 w-4 text-primary" />
                  <div className="max-w-36 min-w-0"><div className="truncate text-xs font-medium text-foreground">{activeLargeTeam.name}</div><div className="text-[10px] text-muted-foreground">{spaces.filter((space) => space.largeTeamId === activeLargeTeam.id).length} 团队空间</div></div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Popover.Trigger>
                <Popover.Content placement="bottom end" offset={6} className="w-72 overflow-hidden border border-border bg-popover p-0 shadow-md">
                  <div className="border-b border-border px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">切换大团队</div>
                  {largeTeams.map((lt) => <button key={lt.id} onClick={() => { setActiveLargeTeamId(lt.id); setTeamMenuOpen(false); }} className={cn('flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-muted', lt.id === activeLargeTeam.id && 'bg-sidebar-accent text-primary')}><span className="truncate font-medium">{lt.name}</span><span className="font-mono text-[11px] text-muted-foreground">{spaces.filter((space) => space.largeTeamId === lt.id).length} 团队空间</span></button>)}
                  <Link href="/team-spaces" onClick={() => setTeamMenuOpen(false)} className="flex items-center gap-2 border-t border-border px-4 py-3 text-xs font-medium text-primary hover:bg-muted"><Building2 className="h-4 w-4" />管理团队空间</Link>
                </Popover.Content>
              </Popover>
            ) : <Link href="/team-spaces" className="text-sm font-medium text-primary hover:underline">创建团队空间</Link>}
          </div>

          <div className="ml-auto flex items-center gap-1.5 md:ml-1">
            <button type="button" onClick={() => setPaletteOpen(true)} aria-label="打开全局搜索" className="hidden h-8 items-center gap-2 border border-input bg-[var(--field-background)] px-2.5 text-muted-foreground transition-colors hover:border-[var(--field-border-hover)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex">
              <Search className="h-3.5 w-3.5" /><span className="text-xs">搜索项目、人员...</span><kbd className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>
            <Popover isOpen={notifOpen} onOpenChange={setNotifOpen}>
              <Popover.Trigger className="relative inline-flex h-8 w-8 items-center justify-center border border-transparent text-foreground transition-colors hover:border-border hover:bg-muted cursor-pointer" aria-label="通知">
                <Bell className="h-4 w-4" />
                {highRiskCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center bg-destructive px-1 font-mono text-[9px] font-bold text-white">{highRiskCount}</span>}
              </Popover.Trigger>
              <Popover.Content placement="bottom end" offset={6} className="w-80 overflow-hidden border border-border bg-popover p-0 shadow-md">
                <div className="border-b border-border px-4 py-3"><div className="text-sm font-semibold">风险预警</div><div className="text-xs text-muted-foreground">{riskAlerts.length} 条 · {highRiskCount} 高危</div></div>
                <div className="max-h-80 overflow-y-auto">{riskAlerts.slice(0, 5).map((r) => <div key={r.id} className="border-b border-border px-4 py-3 last:border-0 hover:bg-muted"><div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 ${r.level === 'high' ? 'bg-destructive' : r.level === 'medium' ? 'bg-warning' : 'bg-muted-foreground'}`} /><span className="text-xs font-medium">{r.title}</span></div><div className="mt-1 pl-3.5 text-[11px] text-muted-foreground">{r.time}</div></div>)}</div>
                <button onClick={() => setNotifOpen(false)} className="w-full border-t border-border bg-card py-2.5 text-center text-xs text-muted-foreground transition-colors hover:bg-muted cursor-pointer">查看全部</button>
              </Popover.Content>
            </Popover>
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] p-4 md:p-6">{children}</main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
