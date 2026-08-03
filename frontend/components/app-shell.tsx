/**
 * AppShell v3.0 - Bento Grid 去框化风格
 * 侧边栏毛玻璃效果 + 极简分隔线
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FolderGit2, Users, Network, Rocket,
  Activity, ChevronRight, Menu, X, Search, Bell,
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
import { Badge } from './ui/badge';

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
        'group flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-all duration-200',
        active
          ? 'bg-primary/12 text-primary shadow-lg shadow-primary/5'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl transition-all',
          active ? 'bg-primary/15' : 'bg-muted/20 group-hover:bg-muted/30'
        )}
      >
        <Icon
          className={cn(
            'h-5 w-5 transition-colors',
            active ? 'text-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground'
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{item.label}</div>
        <div className="truncate text-[11px] text-muted-foreground/70">{item.description}</div>
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

  /* ⌘K / Ctrl+K 全局唤起搜索 */
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
    <div className="min-h-screen">
      {/* ============ 桌面侧边栏 - 去框化毛玻璃 ============ */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r-0 bg-sidebar/60 backdrop-blur-xl lg:flex">
        {/* Logo 区域 */}
        <div className="flex h-20 items-center gap-3 border-b border-border/10 px-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/10">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="font-mono text-lg font-bold tracking-tight text-primary">DevLens</div>
            <div className="text-[11px] text-muted-foreground">研发棱镜 · v0.1</div>
          </div>
        </div>

        {/* 导航区域 */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
          <div className="mb-3 px-3.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            分析模块
          </div>
          {ANALYSIS_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}

          {/* 极简分隔线 */}
          <div className="my-4 mx-6 h-px bg-border/30" />

          <div className="mb-3 px-3.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            系统管理
          </div>
          {SYSTEM_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>

        {/* 底部用户卡 */}
        <div className="border-t border-border/10 p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/15 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-sm font-mono font-semibold text-accent">
              TL
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-semibold">技术负责人</div>
              <div className="truncate text-[11px] text-muted-foreground/70">tech-lead@devlens.io</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ============ 移动端抽屉 ============ */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar/90 backdrop-blur-xl">
            <div className="flex h-20 items-center justify-between border-b border-border/10 px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/10">
                  <Activity className="h-6 w-6 text-white" />
                </div>
                <span className="font-mono text-lg font-bold text-primary">DevLens</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
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
      <div className="lg:pl-72">
        {/* 顶栏 - 去框化风格 */}
        <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b-0 bg-background/50 px-4 backdrop-blur-xl md:px-8">
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
          <div className="hidden items-center gap-2 font-mono text-sm text-muted-foreground/70 md:flex">
            <span className="text-foreground">DevLens</span>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">
              {ANALYSIS_NAV.find((n) => isActive(n.href))?.label ||
                SYSTEM_NAV.find((n) => isActive(n.href))?.label ||
                '决策总览'}
            </span>
          </div>

          {/* 组织空间（租户）选择器 + 团队空间选择器 */}
          <div className="hidden md:flex items-center gap-2 ml-auto">
            <TenantSwitcher />
            {activeLargeTeam ? (
              <Popover isOpen={teamMenuOpen} onOpenChange={setTeamMenuOpen}>
                <Popover.Trigger
                  className="flex items-center gap-3 rounded-2xl bg-muted/15 px-4 py-2.5 text-left transition-all hover:bg-muted/25 cursor-pointer"
                  aria-label="切换大团队"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12">
                    <Building2 className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="max-w-40 min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{activeLargeTeam.name}</div>
                    <div className="text-[11px] text-muted-foreground/70">
                      {spaces.filter((space) => space.largeTeamId === activeLargeTeam.id).length} 团队空间 · {spaces.filter((space) => space.largeTeamId === activeLargeTeam.id).reduce((count, space) => count + space.projectIds.length, 0)} 项目
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
                </Popover.Trigger>
                <Popover.Content placement="bottom end" offset={8} className="w-72 overflow-hidden rounded-xl glass-strong shadow-2xl">
                  <div className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-b border-border/10">切换大团队</div>
                  {largeTeams.map((lt) => (
                    <button
                      key={lt.id}
                      onClick={() => { setActiveLargeTeamId(lt.id); setTeamMenuOpen(false); }}
                      className={cn(
                        'flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-all hover:bg-muted/20',
                        lt.id === activeLargeTeam.id && 'bg-primary/8 text-primary'
                      )}
                    >
                      <span className="truncate font-medium">{lt.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground/70">{spaces.filter((space) => space.largeTeamId === lt.id).length} 团队空间</span>
                    </button>
                  ))}
                  <Link href="/team-spaces" onClick={() => setTeamMenuOpen(false)} className="flex items-center gap-2 border-t border-border/10 px-4 py-3 text-xs font-medium text-primary hover:bg-muted/15">
                    <Building2 className="h-4 w-4" />管理团队空间
                  </Link>
                </Popover.Content>
              </Popover>
            ) : (
              <Link href="/team-spaces" className="text-sm font-medium text-primary hover:underline">创建团队空间</Link>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto md:ml-4">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-3 rounded-2xl glass-light px-4 py-2.5 text-muted-foreground transition-all hover:bg-muted/20 md:flex cursor-pointer"
            >
              <Search className="h-4.5 w-4.5" />
              <span className="text-sm">搜索项目、人员...</span>
              <kbd className="rounded-xl border border-border/30 px-2.5 py-1 font-mono text-[11px] bg-muted/20">
                ⌘K
              </kbd>
            </button>

            {/* 通知按钮带数量气泡 */}
            <Popover isOpen={notifOpen} onOpenChange={setNotifOpen}>
              <Popover.Trigger
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-3xl text-foreground transition-colors hover:bg-muted/40 cursor-pointer"
                aria-label="通知"
              >
                <Bell className="h-4.5 w-4.5" />
                {highRiskCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 font-mono text-[10px] font-bold text-white shadow-lg shadow-destructive/15">
                    {highRiskCount}
                  </span>
                )}
              </Popover.Trigger>
              <Popover.Content placement="bottom end" offset={8} className="w-80 overflow-hidden rounded-xl glass-strong shadow-2xl">
                <div className="border-b border-border/10 px-5 py-4">
                  <div className="text-base font-semibold">风险预警</div>
                  <div className="text-xs text-muted-foreground/70">{riskAlerts.length} 条 · {highRiskCount} 高危</div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {riskAlerts.slice(0, 5).map((r) => (
                    <div key={r.id} className="border-b border-border/5 px-5 py-3 last:border-0 hover:bg-muted/10 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${r.level === 'high' ? 'bg-destructive' : r.level === 'medium' ? 'bg-warning' : 'bg-muted-foreground'}`} />
                        <span className="text-xs font-medium">{r.title}</span>
                      </div>
                      <div className="mt-1 pl-4 text-[11px] text-muted-foreground/70">{r.time}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setNotifOpen(false)}
                  className="w-full bg-muted/10 py-3 text-center text-xs text-muted-foreground hover:bg-muted/15 cursor-pointer transition-colors"
                >
                  查看全部
                </button>
              </Popover.Content>
            </Popover>

            <ThemeToggle />
          </div>
        </header>

        {/* 页面内容 */}
        <main className="mx-auto max-w-[1440px] p-4 md:p-8">{children}</main>
      </div>

      {/* 全局搜索 Command Palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
