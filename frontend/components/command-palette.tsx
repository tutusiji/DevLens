/**
 * Command Palette（⌘K 全局搜索）
 * fuzzy 匹配项目/开发者/团队，分组展示，键盘导航
 */
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Search, FolderGit2, Users, Network, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { projects, developers, teams } from '@/lib/mock-data';

interface SearchItem {
  type: 'project' | 'developer' | 'team';
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ALL_ITEMS: SearchItem[] = [
  ...projects.map((p) => ({
    type: 'project' as const, id: p.id, title: p.name, subtitle: `${p.group} · ${p.language}`,
    href: `/projects/${p.id}`, icon: FolderGit2,
  })),
  ...developers.map((d) => ({
    type: 'developer' as const, id: d.id, title: d.name, subtitle: `${d.role} · ${d.team}`,
    href: `/developers/${d.id}`, icon: Users,
  })),
  ...teams.map((t) => ({
    type: 'team' as const, id: t.id, title: t.name, subtitle: `${t.members} 人 · 均分 ${t.avgScore}`,
    href: `/teams`, icon: Network,
  })),
];

const TYPE_LABEL = { project: '项目', developer: '开发者', team: '团队' };

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  // 简单 fuzzy：按顺序匹配字符
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const dialogTitleId = React.useId();
  const dialogDescriptionId = React.useId();
  const listboxId = React.useId();

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    previouslyFocusedRef.current?.focus();
    previouslyFocusedRef.current = null;
  }, [open]);

  const results = React.useMemo(() => {
    if (!query.trim()) return ALL_ITEMS.slice(0, 8);
    return ALL_ITEMS.filter(
      (item) => fuzzyMatch(query, item.title) || fuzzyMatch(query, item.subtitle)
    );
  }, [query]);

  // 分组
  const grouped = React.useMemo(() => {
    const g: Record<string, SearchItem[]> = {};
    results.forEach((item) => {
      if (!g[item.type]) g[item.type] = [];
      g[item.type].push(item);
    });
    return g;
  }, [results]);

  React.useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(results.length - 1, 0)));
  }, [results.length]);

  React.useEffect(() => {
    const activeOption = results[activeIndex];
    if (!open || !activeOption) return;
    document.getElementById(`${listboxId}-${activeOption.type}-${activeOption.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, listboxId, open, results]);
  const selectItem = React.useCallback((item: SearchItem) => {
    router.push(item.href);
    onClose();
  }, [onClose, router]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;

      if (event.key === 'Tab') {
        const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [href], [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements?.length) return;

        const focusable = Array.from(focusableElements);
        const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
        const nextIndex = event.shiftKey
          ? currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1
          : currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
        event.preventDefault();
        focusable[nextIndex]?.focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, results.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const item = results[activeIndex];
        if (item) selectItem(item);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeIndex, onClose, open, results, selectItem]);

  if (!mounted || !open) return null;

  const activeOptionId = results[activeIndex]
    ? `${listboxId}-${results[activeIndex].type}-${results[activeIndex].id}`
    : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[15vh]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/50"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-xl outline-none"
      >
        <h2 id={dialogTitleId} className="sr-only">全局搜索</h2>
        <p id={dialogDescriptionId} className="sr-only">输入关键词搜索项目、开发者或团队，使用上下方向键选择，按回车跳转，按 Escape 关闭。</p>

        {/* 搜索输入 */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            placeholder="搜索项目、开发者、团队..."
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            aria-expanded="true"
            aria-label="搜索项目、开发者、团队"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
        </div>

        {/* 结果列表 */}
        <div id={listboxId} role="listbox" aria-label="搜索结果" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div role="status" className="px-4 py-8 text-center text-sm text-muted-foreground">
              无匹配结果，试试其他关键词
            </div>
          ) : (
            Object.entries(grouped).map(([type, items]) => {
              const groupId = `${listboxId}-${type}-label`;
              return (
                <div key={type} role="group" aria-labelledby={groupId} className="mb-2">
                  <div id={groupId} className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {TYPE_LABEL[type as keyof typeof TYPE_LABEL]} · {items.length}
                  </div>
                  {items.map((item) => {
                    const index = results.indexOf(item);
                    const active = index === activeIndex;
                    const Icon = item.icon;
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        id={`${listboxId}-${item.type}-${item.id}`}
                        role="option"
                        aria-selected={active}
                        tabIndex={-1}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectItem(item)}
                        className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors ${
                          active ? 'bg-muted' : 'hover:bg-muted/50'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{item.title}</div>
                          <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
                        </div>
                        {active && <CornerDownLeft className="h-3 w-3 text-muted-foreground" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" aria-hidden="true" /><ArrowDown className="h-3 w-3" aria-hidden="true" /> 导航</span>
            <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" aria-hidden="true" /> 跳转</span>
          </div>
          <span>DevLens 全局搜索</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
