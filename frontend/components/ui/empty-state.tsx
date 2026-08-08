/**
 * 通用空态占位：用于列表/图表/矩阵等区块在无数据时的友好提示。
 * 与决策总览的空组织首屏体验保持一致（不展示伪造数据）。
 */
'use client';

import * as React from 'react';

type IconType = React.ComponentType<{ className?: string }>;

export function EmptyState({
  icon: Icon,
  title = '暂无数据',
  description,
  action,
  className,
  compact = false,
}: {
  icon?: IconType;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-center ${compact ? 'py-6' : 'py-10'} ${className ?? ''}`}
    >
      {Icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/25">
          <Icon className="h-5 w-5 text-muted-foreground/55" />
        </div>
      )}
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      {description && (
        <div className="max-w-xs text-xs leading-relaxed text-muted-foreground/70">{description}</div>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
