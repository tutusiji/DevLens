import * as React from 'react';
import { Chip } from '@heroui/react/chip';
import { cn } from '@/lib/utils';

/* ============================================
   Badge 组件 - 基于 HeroUI Chip
   保持原有 API：variant + className + children
   内部映射到 HeroUI Chip 的 color + variant
   ============================================ */

type BadgeVariant = 'default' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'outline';

/** 旧 variant -> HeroUI Chip color + variant 映射 */
const variantMap: Record<BadgeVariant, { color: 'default' | 'success' | 'danger' | 'accent' | 'warning'; variant: 'primary' | 'secondary' | 'tertiary' | 'soft' }> = {
  default: { color: 'default', variant: 'soft' },
  secondary: { color: 'default', variant: 'secondary' },
  accent: { color: 'accent', variant: 'soft' },
  success: { color: 'success', variant: 'soft' },
  warning: { color: 'warning', variant: 'soft' },
  danger: { color: 'danger', variant: 'soft' },
  outline: { color: 'default', variant: 'tertiary' },
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const mapping = variantMap[variant] ?? variantMap.default;
  return (
    <Chip
      color={mapping.color}
      variant={mapping.variant}
      className={cn('rounded-full cursor-default', className)}
      {...props}
    >
      {children}
    </Chip>
  );
}

export { Badge };
