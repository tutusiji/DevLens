/**
 * 主题切换按钮
 * 浅色（默认）/ 暗色（OLED）切换，localStorage 持久化
 * 遵循系统颜色偏好，但仅在用户尚未保存主题时生效
 */
'use client';

import * as React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Theme = 'light' | 'dark';

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>('light');
  const [mounted, setMounted] = React.useState(false);

  // 挂载后读真实状态（避免 SSR/CSR 不一致导致图标闪烁）
  React.useEffect(() => {
    let savedTheme: Theme | null = null;
    try {
      const storedTheme = localStorage.getItem('devlens-theme');
      savedTheme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : null;
    } catch (error) {}

    const resolvedTheme = savedTheme ?? getSystemTheme();
    applyTheme(resolvedTheme);
    setTheme(resolvedTheme);
    setMounted(true);

    if (savedTheme) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      const nextTheme: Theme = event.matches ? 'dark' : 'light';
      applyTheme(nextTheme);
      setTheme(nextTheme);
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem('devlens-theme', next);
    } catch (error) {}
  };

  // 未挂载时占位，避免 SSR 渲染 light 图标但实际是 dark 导致闪一下
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="切换主题">
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === 'dark' ? '切换到浅色' : '切换到暗色'}
      aria-pressed={theme === 'dark'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
