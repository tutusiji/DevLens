'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, ShieldAlert, Code2, Users, Compass, GitCompareArrows,
  Sparkles, ArrowRight,
} from 'lucide-react';
import { demoLoginAPI } from '@/lib/api';

export default function LandingPage() {
  const router = useRouter();
  const [demoLoading, setDemoLoading] = React.useState(false);

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      const result = await demoLoginAPI();
      if (typeof window !== 'undefined') {
        localStorage.setItem('devlens-tenant-id', result.tenant.id);
        localStorage.setItem('devlens-user-id', result.user.id);
        localStorage.setItem('devlens-is-demo', '1');
      }
      router.push('/dashboard');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Demo 登录失败');
      setDemoLoading(false);
    }
  };

  const features = [
    {
      icon: Activity,
      title: '三位一体评估矩阵',
      desc: '项目 × 团队 × 人员交叉评估，从 Git 提交推导组织能力分布与协作效率',
      color: 'from-primary/20 to-primary/5',
    },
    {
      icon: ShieldAlert,
      title: '智能风险预警',
      desc: 'AI 自动识别 Bus Factor、技术债、能力缺口、关键人风险，提前预警',
      color: 'from-destructive/20 to-destructive/5',
    },
    {
      icon: Code2,
      title: '代码健康度分析',
      desc: '质量 / 安全 / 复杂度多维度评分，自动生成改进建议与优先级排序',
      color: 'from-success/20 to-success/5',
    },
    {
      icon: Users,
      title: '开发者能力画像',
      desc: '基于实际产出构建技术能力雷达图，量化成长轨迹与团队角色',
      color: 'from-secondary/20 to-secondary/5',
    },
    {
      icon: Compass,
      title: '架构设计图谱',
      desc: '自动生成系统分层图、组件依赖图、技术决策记录，治理技术债务',
      color: 'from-warning/20 to-warning/5',
    },
    {
      icon: GitCompareArrows,
      title: '项目组合对比',
      desc: '多项目横向对比 + 历史趋势追踪，辅助资源分配与战略决策',
      color: 'from-purple-500/20 to-purple-500/5',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-40 h-[400px] w-[400px] rounded-full bg-secondary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-[300px] w-[300px] rounded-full bg-accent/10 blur-3xl" />

      {/* 顶部导航 */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <div
          className="flex cursor-pointer items-center gap-3"
          onClick={() => router.push('/')}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-mono text-lg font-bold tracking-tight">DevLens</div>
            <div className="text-[10px] text-muted-foreground">研发棱镜</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/login')}
            className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            登录
          </button>
          <button
            onClick={() => router.push('/register')}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
          >
            免费注册
          </button>
        </div>
      </header>

      {/* Hero 区域 */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-16 pt-16 text-center md:px-12 md:pt-24">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          基于 AI 的研发认知系统 · 现已开源
        </div>
        <h1 className="bg-gradient-to-br from-foreground via-foreground to-primary bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-6xl">
          把 Git 仓库转化为
          <br />
          <span className="text-primary">组织能力画像</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
          项目 · 团队 · 人员三位一体评估，AI 驱动的代码健康度分析、风险预警与架构治理，
          让研发效能与技术资产一目了然。
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={handleDemo}
            disabled={demoLoading}
            className="group flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 disabled:opacity-70"
          >
            <Sparkles className="h-4 w-4" />
            {demoLoading ? '正在进入Demo…' : '✨ 免费体验 Demo'}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
          <button
            onClick={() => router.push('/register')}
            className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/50 px-6 py-3.5 text-sm font-medium backdrop-blur transition-all hover:bg-muted/30"
          >
            创建工作空间
          </button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground/70">
          Demo 账号为只读权限，预置了完整的测试数据，无需注册即可体验
        </p>
      </section>

      {/* 功能特性 */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:px-12">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">六大核心能力</h2>
          <p className="mt-3 text-muted-foreground">从代码提交到组织洞察，全链路 AI 赋能</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur transition-all hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
              >
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.color}`}>
                  <Icon className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="mb-2 text-base font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 数据看板预览 */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:px-12">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">一站式研发认知平台</h2>
          <p className="mt-3 text-muted-foreground">所有分析结果汇聚于统一工作台，所见即所得</p>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 blur-2xl" />
          <div className="relative rounded-3xl border border-border/50 bg-card/80 p-2 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-destructive/60" />
                <div className="h-3 w-3 rounded-full bg-warning/60" />
                <div className="h-3 w-3 rounded-full bg-success/60" />
              </div>
              <div className="ml-4 text-xs text-muted-foreground font-mono">devlens.app/dashboard</div>
            </div>
            <div className="grid grid-cols-12 gap-3 p-4">
              <div className="col-span-12 h-64 rounded-2xl bg-gradient-to-br from-primary/10 to-muted/30 lg:col-span-7" />
              <div className="col-span-12 space-y-3 lg:col-span-5">
                <div className="h-28 rounded-2xl bg-gradient-to-br from-destructive/10 to-muted/30" />
                <div className="h-32 rounded-2xl bg-gradient-to-br from-secondary/10 to-muted/30" />
              </div>
              <div className="col-span-4 h-40 rounded-2xl bg-gradient-to-br from-accent/10 to-muted/30" />
              <div className="col-span-4 h-40 rounded-2xl bg-gradient-to-br from-success/10 to-muted/30" />
              <div className="col-span-4 h-40 rounded-2xl bg-gradient-to-br from-warning/10 to-muted/30" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA 区域 */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-20 md:px-12">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-background p-10 text-center md:p-16">
          <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <h2 className="text-2xl font-bold md:text-4xl">准备好提升研发效能了吗？</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              接入你的 Git 仓库，5 分钟内获得首份研发能力评估报告
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={handleDemo}
                disabled={demoLoading}
                className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-70"
              >
                {demoLoading ? '进入中…' : '立即体验 Demo'}
              </button>
              <a
                href="https://github.com/tutusiji/DevLens"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-2xl border border-border/60 px-6 py-3 text-sm font-medium transition-all hover:bg-muted/30"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub 开源
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row md:px-12">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-lg">🔬</span>
            <span>DevLens · 研发棱镜</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground/70">
            <span>基于 AI 的研发认知系统</span>
            <span>© 2026 DevLens</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
