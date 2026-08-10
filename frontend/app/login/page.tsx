'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { loginAPI, demoLoginAPI } from '@/lib/api';
import { Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [demoLoading, setDemoLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await loginAPI(email, password);
      // 同步租户/用户上下文到 localStorage（与现有 identityHeaders 逻辑一致）
      if (typeof window !== 'undefined') {
        localStorage.setItem('devlens-tenant-id', result.tenant.id);
        localStorage.setItem('devlens-user-id', result.user.id);
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError('');
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
      setError(err instanceof Error ? err.message : 'Demo 登录失败，请重试');
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-primary/10 p-4">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-8 shadow-2xl shadow-primary/5 backdrop-blur-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-2xl">
              🔬
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">DevLens · 研发棱镜</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">登录以继续访问你的研发认知空间</p>
          </div>

          {/* Demo 快速体验按钮 */}
          <Button
            variant="accent"
            className="mb-5 w-full gap-2"
            onClick={handleDemoLogin}
            disabled={demoLoading || loading}
          >
            <Sparkles className="h-4 w-4" />
            {demoLoading ? '正在进入Demo…' : '✨ 快速体验 Demo（无需注册）'}
          </Button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card/70 px-3 text-muted-foreground/70">或使用邮箱登录</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-muted-foreground">邮箱</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-border/70 bg-background/80 px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-muted-foreground">密码</label>
              <PasswordInput
                id="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中…' : '登录'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            还没有账号？{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              立即注册
            </Link>
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          DevLens · 基于 AI 的研发认知系统
        </p>
      </div>
    </div>
  );
}
