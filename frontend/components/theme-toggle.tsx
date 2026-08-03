/**
 * 主题切换按钮
 * 浅色（默认）/ 暗色（OLED）切换，localStorage 持久化
 * 遵循 skill prefers-reduced-motion：过渡用 transform 而非颜色动画
 */
'use client';

import * as React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>('light');
  const [mounted, setMounted] = React.useState(false);

  // 挂载后读真实状态（避免 SSR/CSR 不一致导致图标闪烁）
  React.useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('devlens-theme', next);
    } catch (e) {}
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
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={theme === 'dark' ? '切换到浅色' : '切换到暗色'}>
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
