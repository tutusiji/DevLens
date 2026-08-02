import * as React from 'react';
import { Chip } from '@heroui/react/chip';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'outline';

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

function Badge({ className, variant = 'default', children, color: _color, ...props }: BadgeProps) {
  const mapping = variantMap[variant] ?? variantMap.default;
  return (
    <Chip
      color={mapping.color as 'default' | 'warning' | 'success' | 'danger' | 'accent'}
      variant={mapping.variant}
      className={cn('h-5 rounded-sm border-0 px-1.5 text-[11px] font-medium leading-5 cursor-default', className)}
      {...props}
    >
      {children}
    </Chip>
  );
}

export { Badge };
