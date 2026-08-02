/** 分段控件：保持 value/onChange/options 三段式 API。 */
'use client';

import * as React from 'react';
import { Tab, TabList, TabListContainer, Tabs } from '@heroui/react/tabs';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
  countTone?: 'primary' | 'warning' | 'destructive';
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md', className }: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <Tabs selectedKey={value} onSelectionChange={(key) => onChange(String(key) as T)} className={cn('inline-flex', className)}>
      <TabListContainer className="rounded-md border border-border bg-muted p-0.5">
        <TabList aria-label="分段选择器" className="gap-0 p-0">
          {options.map((option) => {
            const Icon = option.icon;
            const countToneClass = option.countTone === 'destructive'
              ? 'bg-destructive/15 text-destructive'
              : option.countTone === 'warning'
                ? 'bg-warning/15 text-warning'
                : 'bg-primary/15 text-primary';
            return (
              <Tab
                key={option.value}
                id={option.value}
                className={cn(
                  '!w-auto flex-none gap-1.5 whitespace-nowrap rounded-sm !text-muted-foreground data-[selected=true]:!bg-card data-[selected=true]:!text-foreground data-[selected=true]:shadow-none',
                  size === 'sm' ? 'h-auto px-2 py-1 text-xs' : 'h-auto px-3 py-1.5 text-sm'
                )}
              >
                {Icon && <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />}
                <span>{option.label}</span>
                {typeof option.count === 'number' && <span className={cn('ml-0.5 inline-flex min-w-4 items-center justify-center rounded-sm px-1 py-0.5 text-[10px] font-semibold leading-none', countToneClass)}>{option.count}</span>}
              </Tab>
            );
          })}
        </TabList>
      </TabListContainer>
    </Tabs>
  );
}
