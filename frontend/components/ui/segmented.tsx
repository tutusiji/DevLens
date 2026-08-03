/**
 * SegmentedControl 分段控件
 * 基于 HeroUI Tabs，保持 value/onChange/options 三段式 API。
 */
'use client';

import * as React from 'react';
import { Tab, TabList, TabListContainer, Tabs } from '@heroui/react/tabs';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** 以独立色彩标识的数量，避免把数字混在 Tab 文案中。 */
  count?: number;
  countTone?: 'primary' | 'warning' | 'destructive';
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <Tabs
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key) as T)}
      className={cn('inline-flex', className)}
    >
      <TabListContainer className="rounded-md border border-border bg-muted/40 p-0.5">
        <TabList aria-label="分段选择器" className="gap-0.5 p-0">
          {options.map((option) => {
            const Icon = option.icon;
            const countToneClass = option.countTone === 'destructive'
              ? 'bg-destructive/12 text-destructive'
              : option.countTone === 'warning'
                ? 'bg-warning/12 text-warning'
                : 'bg-primary/12 text-primary';

            return (
              <Tab
                key={option.value}
                id={option.value}
                className={cn(
                  /*
                   * TabList 位于可横向滚动的容器中：每个 Tab 必须按内容宽度排列，
                   * 不能压缩后让“AI Review / 模块风险”等标签和数字折成两行。
                   * 非选中 Tab 也显式使用可读正文色，避免 HeroUI 的 muted 过淡。
                   */
                  '!w-auto flex-none gap-1.5 whitespace-nowrap rounded !text-foreground/80 data-[selected=true]:!text-primary',
                  size === 'sm' ? 'h-auto px-2 py-1 text-xs' : 'h-auto px-3 py-1.5 text-sm'
                )}
              >
                {Icon && <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />}
                <span>{option.label}</span>
                {typeof option.count === 'number' && (
                  <span className={cn('ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none', countToneClass)}>
                    {option.count}
                  </span>
                )}
              </Tab>
            );
          })}
        </TabList>
      </TabListContainer>
    </Tabs>
  );
}
