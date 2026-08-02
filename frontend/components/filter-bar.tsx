/**
 * FilterBar 通用筛选条
 * 搜索 + 下拉筛选 + 排序 + 视图切换 + 汇总统计
 * 遵循 skill：filter sidebar、sortable table、search autocomplete
 */
'use client';

import * as React from 'react';
import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';

export interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface SortOption {
  value: string;
  label: string;
}

export function FilterBar({
  searchPlaceholder = '搜索...',
  searchValue,
  onSearchChange,
  filters,
  filterValues,
  onFilterChange,
  sortOptions,
  sortValue,
  onSortChange,
  viewMode,
  viewModes,
  onViewModeChange,
  summary,
  className,
}: {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  filters?: FilterOption[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (v: string) => void;
  viewMode?: string;
  viewModes?: { value: string; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  onViewModeChange?: (v: string) => void;
  summary?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 space-y-3', className)}>
      {/* 汇总统计条 */}
      {summary && (
        <div className="flex min-h-9 items-center gap-4 border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          {summary}
        </div>
      )}

      {/* 筛选控件行 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        {/* 搜索 */}
        {onSearchChange && (
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-md border border-input bg-card py-1.5 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
            />
          </div>
        )}

        {/* 下拉筛选器 */}
        {filters?.map((f) => (
          <div key={f.key} className="relative">
            <select
              value={filterValues?.[f.key] || 'all'}
              onChange={(e) => onFilterChange?.(f.key, e.target.value)}
              className="h-9 appearance-none rounded-md border border-input bg-card py-1.5 pl-3 pr-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 cursor-pointer"
            >
              <option value="all">{f.label}: 全部</option>
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {f.label}: {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        ))}

        {/* 排序 */}
        {sortOptions && sortOptions.length > 0 && (
          <div className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <select
              value={sortValue}
              onChange={(e) => onSortChange?.(e.target.value)}
              className="h-9 appearance-none rounded-md border border-input bg-card py-1.5 pl-7 pr-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 cursor-pointer"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        )}

        {/* 视图切换 */}
        {viewModes && viewModes.length > 0 && viewMode && (
          <div className="ml-auto">
            <Segmented
              size="sm"
              value={viewMode}
              onChange={(v) => onViewModeChange?.(v)}
              options={viewModes}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============ 空状态组件 ============

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-border bg-card py-14 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
