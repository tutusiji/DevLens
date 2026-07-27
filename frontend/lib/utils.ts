import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并 Tailwind 类名，处理冲突 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 评分映射颜色：>=85 绿 / >=70 黄 / <70 红 */
export function scoreColor(score: number): string {
  if (score >= 85) return 'var(--success)';
  if (score >= 70) return 'var(--warning)';
  return 'var(--destructive)';
}

/** 评分映射 Badge variant */
export function scoreVariant(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 85) return 'success';
  if (score >= 70) return 'warning';
  return 'danger';
}

/** 数字格式化：千分位 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

/** 百分比格式化 */
export function formatPercent(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}
