'use client';

import * as React from 'react';
import { ProgressBar } from '@heroui/react/progress-bar';
import { cn } from '@/lib/utils';

/* ============================================
   Progress 组件 - 基于 HeroUI ProgressBar
   保持原有 API：value, max, className, indicatorClassName
   ============================================ */

const Progress = React.forwardRef<
  HTMLDivElement,
  { value: number; max?: number; className?: string; indicatorClassName?: string }
>(({ value, max = 100, className, indicatorClassName }, _ref) => {
  return (
    <ProgressBar
      value={value}
      maxValue={max}
      className={cn('h-2 w-full', className)}
    >
      <ProgressBar.Track className={cn('h-2 w-full overflow-hidden rounded-full bg-muted p-0')}>
        <ProgressBar.Fill className={cn('h-full rounded-full bg-primary transition-all duration-500', indicatorClassName)} />
      </ProgressBar.Track>
    </ProgressBar>
  );
});

Progress.displayName = 'Progress';

export { Progress };
