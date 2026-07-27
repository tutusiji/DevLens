/**
 * AppShell 应用骨架：侧边栏 + 顶栏 + 主内容区
 * 遵循 skill 规则：侧边栏双行导航、active 项高亮、移动端抽屉、毛玻璃顶栏
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FolderGit2, Users, Network, Rocket,
  Activity, ChevronRight, Menu, X, Search, Bell,
  GitBranch, Bot, Database, Ruler, Building2, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { CommandPalette } from '@/components/command-palette';
import { useTeamSpace } from '@/components/team-space-provider';
import { riskAlerts } from '@/lib/mock-data';

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ANALYSIS_NAV: NavItem[] = [
  { href: '/', label: '决策总览', description: '结论 · 风险 · 行动', icon: LayoutDashboard },
  { href: '/projects', label: '项目评估', description: '代码质量 · 健康度', icon: FolderGit2 },
  { href: '/developers', label: '开发者画像', description: '能力 · 成长 · 协作', icon: Users },
  { href: '/teams', label: '团队分析', description: 'Bus Factor · 缺口', icon: Network },
];

const SYSTEM_NAV: NavItem[] = [
  { href: '/team-spaces', label: '团队空间管理', description: '团队 · 小组 · 成员归属', icon: Building2 },
  { href: '/onboard', label: '接入项目', description: 'Git 仓库 · 身份匹配', icon: Rocket },
  { href: '/repos', label: 'Git 仓库管理', description: '仓库列表 · 同步状态', icon: GitBranch },
  { href: '/models', label: '大模型管理', description: 'OpenAI · Anthropic', icon: Bot },
  { href: '/vector-models', label: '向量模型管理', description: 'Embedding · 索引', icon: Database },
  { href: '/capability-standards', label: '能力标准', description: '角色 · 级别 · 阈值', icon: Ruler },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
      )}
    >
      <Icon
        className={cn(
          'h-5 w-5 shrink-0 transition-colors',
          active ? 'text-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{item.label}</div>
        <div className="truncate text-[11px] text-sidebar-foreground/40">{item.description}</div>
      </div>
      {active && <ChevronRight className="h-4 w-4 text-primary" />}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = React.useState(false);
  const {
    spaces, largeTeams, activeLargeTeam,
    setActiveLargeTeamId,
  } = useTeamSpace();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  // ⌘K / Ctrl+K 全局唤起搜索
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

  return (
    <div className="min-h-screen bg-background">
      {/* ============ 桌面侧边栏 ============ */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-mono text-sm font-bold tracking-tight">DevLens</div>
            <div className="text-[10px] text-sidebar-foreground/50">研发棱镜 · v0.1</div>
          </div>
        </div>

        {/* 导航 */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <div className="mb-2 px-3 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
            分析模块
          </div>
          {ANALYSIS_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
          <div className="mb-2 mt-6 px-3 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
            系统管理
          </div>
          {SYSTEM_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>

        {/* 底部用户卡 */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-mono text-accent">
              TL
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium">技术负责人</div>
              <div className="truncate text-[11px] text-sidebar-foreground/50">tech-lead@devlens.io</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ============ 移动端抽屉 ============ */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-sidebar-border bg-sidebar">
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Activity className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-mono text-sm font-bold">DevLens</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {[...ANALYSIS_NAV, ...SYSTEM_NAV].map((item) => (
                <div key={item.href} onClick={() => setMobileOpen(false)}>
                  <NavLink item={item} active={isActive(item.href)} />
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* ============ 主内容区 ============ */}
      <div className="lg:pl-64">
        {/* 顶栏 */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="打开菜单"
          >
            <Menu className="h-5 w-5" />
          </Button>
          {/* 面包屑 */}
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span>DevLens</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">
              {ANALYSIS_NAV.find((n) => isActive(n.href))?.label ||
                SYSTEM_NAV.find((n) => isActive(n.href))?.label ||
                '决策总览'}
            </span>
          </div>
          <div className="relative hidden border-l border-border pl-3 md:block">
            {activeLargeTeam ? (
              <button
                onClick={() => setTeamMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted cursor-pointer"
                aria-label="切换大团队"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10"><Building2 className="h-3.5 w-3.5 text-primary" /></div>
                <div className="max-w-32 min-w-0">
                  <div className="truncate text-xs font-medium text-foreground">{activeLargeTeam.name}</div>
                  <div className="text-[10px] text-muted-foreground">{spaces.filter((space) => space.largeTeamId === activeLargeTeam.id).length} 团队空间 · {spaces.filter((space) => space.largeTeamId === activeLargeTeam.id).reduce((count, space) => count + space.projectIds.length, 0)} 项目</div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ) : (
              <Link href="/team-spaces" className="text-xs font-medium text-primary hover:underline">创建团队空间</Link>
            )}
            {teamMenuOpen && activeLargeTeam && (
              <div className="absolute left-3 top-10 z-50 w-64 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-2xl" style={{ animation: 'fadeIn 150ms ease-out' }}>
                <div className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">切换大团队</div>
                {largeTeams.map((lt) => (
                  <button
                    key={lt.id}
                    onClick={() => { setActiveLargeTeamId(lt.id); setTeamMenuOpen(false); }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted cursor-pointer',
                      lt.id === activeLargeTeam.id && 'bg-primary/10 text-primary'
                    )}
                  >
                    <span className="truncate">{lt.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{spaces.filter((space) => space.largeTeamId === lt.id).length} 团队空间</span>
                  </button>
                ))}
                <Link href="/team-spaces" onClick={() => setTeamMenuOpen(false)} className="mt-1 flex items-center gap-2 border-t border-border px-3 py-2 text-xs font-medium text-primary hover:bg-muted"><Building2 className="h-3.5 w-3.5" />管理团队空间</Link>
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted md:flex cursor-pointer"
            >
              <Search className="h-4 w-4" />
              <span className="text-sm">搜索项目、人员...</span>
              <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
                ⌘K
              </kbd>
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="通知"
              className="relative"
            >
              <Bell className="h-4 w-4" />
              {highRiskCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[9px] font-bold text-white">
                  {highRiskCount}
                </span>
              )}
            </Button>
            {notifOpen && (
              <div className="absolute right-4 top-14 z-50 w-80 overflow-hidden rounded-lg border border-border bg-popover shadow-2xl" style={{ animation: 'fadeIn 150ms ease-out' }}>
                <div className="border-b border-border px-4 py-2.5">
                  <div className="text-sm font-medium">风险预警</div>
                  <div className="text-xs text-muted-foreground">{riskAlerts.length} 条 · {highRiskCount} 高危</div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {riskAlerts.slice(0, 5).map((r) => (
                    <div key={r.id} className="border-b border-border/60 px-4 py-2.5 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${r.level === 'high' ? 'bg-destructive' : r.level === 'medium' ? 'bg-warning' : 'bg-muted-foreground'}`} />
                        <span className="text-xs font-medium">{r.title}</span>
                      </div>
                      <div className="mt-0.5 pl-3.5 text-[11px] text-muted-foreground">{r.time}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setNotifOpen(false)}
                  className="w-full bg-muted/30 py-2 text-center text-xs text-muted-foreground hover:bg-muted/60 cursor-pointer"
                >
                  查看全部
                </button>
              </div>
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* 页面内容 */}
        <main className="mx-auto max-w-[1400px] p-4 md:p-6">{children}</main>
      </div>

      {/* 全局搜索 Command Palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
