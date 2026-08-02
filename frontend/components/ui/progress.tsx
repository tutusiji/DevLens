'use client';

import * as React from 'react';
import { ProgressBar } from '@heroui/react/progress-bar';
import { cn } from '@/lib/utils';

const Progress = React.forwardRef<HTMLDivElement, { value: number; max?: number; className?: string; indicatorClassName?: string }>(
  ({ value, max = 100, className, indicatorClassName }, _ref) => (
    <ProgressBar value={value} maxValue={max} className={cn('h-1.5 w-full', className)}>
      <ProgressBar.Track className="h-1.5 w-full overflow-hidden rounded-sm bg-muted p-0">
        <ProgressBar.Fill className={cn('h-full rounded-sm bg-primary transition-all duration-500', indicatorClassName)} />
      </ProgressBar.Track>
    </ProgressBar>
  )
);

Progress.displayName = 'Progress';
export { Progress };
