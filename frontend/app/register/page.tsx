'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { registerAPI } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState('');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  function validate(): string | null {
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(username.trim())) return '用户名需 3-32 位，仅含字母、数字、下划线或连字符';
    if (!name.trim()) return '请输入昵称';
    if (!email.trim()) return '请输入邮箱';
    if (password.length < 8) return '密码至少 8 位，且需同时包含字母、数字和符号';
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9\s]/.test(password))
      return '密码需同时包含字母、数字和符号';
    if (password !== confirm) return '两次输入的密码不一致';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    try {
      const result = await registerAPI(username.trim(), name.trim(), email.trim(), password);
      // 注册成功即登录：同步租户/用户上下文到 localStorage（与 login 一致）
      if (typeof window !== 'undefined') {
        localStorage.setItem('devlens-tenant-id', result.tenant.id);
        localStorage.setItem('devlens-user-id', result.user.id);
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请重试');
    } finally {
      setLoading(false);
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
            <h1 className="text-2xl font-semibold tracking-tight">注册 DevLens 账号</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">创建账号即获得一个个人研发认知工作区</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-muted-foreground">用户名</label>
              <input
                id="username"
                type="text"
                required
                autoComplete="username"
                placeholder="注册后不可修改，用于生成头像"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 w-full rounded-xl border border-border/70 bg-background/80 px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-[11px] text-muted-foreground/70">3-32 位字母/数字/下划线/连字符</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium text-muted-foreground">昵称</label>
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                placeholder="展示用的名称，可随时修改"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 w-full rounded-xl border border-border/70 bg-background/80 px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-muted-foreground">邮箱</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-border/70 bg-background/80 px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-muted-foreground">密码</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="字母+数字+符号，至少 8 位"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-xl border border-border/70 bg-background/80 px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirm" className="text-sm font-medium text-muted-foreground">确认密码</label>
              <input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                placeholder="再次输入密码"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11 w-full rounded-xl border border-border/70 bg-background/80 px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '注册中…' : '注册并进入'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            已有账号？{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              直接登录
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
