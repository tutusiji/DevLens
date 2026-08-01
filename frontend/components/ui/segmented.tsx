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

            return (
              <Tab
                key={option.value}
                id={option.value}
                className={cn(
                  'gap-1.5 rounded',
                  size === 'sm' ? 'h-auto px-2 py-1 text-xs' : 'h-auto px-3 py-1.5 text-sm'
                )}
              >
                {Icon && <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />}
                <span>{option.label}</span>
              </Tab>
            );
          })}
        </TabList>
      </TabListContainer>
    </Tabs>
  );
}
