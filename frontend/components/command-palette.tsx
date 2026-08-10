/**
 * Command Palette（⌘K 全局搜索）
 * fuzzy 匹配项目/开发者/团队，分组展示，键盘导航
 */
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Search, FolderGit2, Users, Network, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '@/lib/api';
import type { GlobalSearchItem } from '@/lib/types';

interface SearchItem extends GlobalSearchItem {
  type: 'project' | 'developer' | 'team' | 'teamSpace';
  icon: React.ComponentType<{ className?: string }>;
}

const TYPE_LABEL = { project: '项目', developer: '开发者', team: '团队', teamSpace: '组织团队' };

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
  const [mounted, setMounted] = React.useState(false);
  const [searchItems, setSearchItems] = React.useState<SearchItem[]>([]);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // 打开时拉取全部（空查询返回前 8 条），输入时实时过滤
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    const keyword = query.trim();
    api.globalSearch(keyword || ' ')
      .then((result) => {
        if (!active) return;
        setSearchItems([
          ...result.projects.map((p) => ({ ...p, type: 'project' as const, icon: FolderGit2 })),
          ...result.developers.map((d) => ({ ...d, type: 'developer' as const, icon: Users })),
          ...result.teamSpaces.map((s) => ({ ...s, type: 'teamSpace' as const, icon: Network })),
          ...result.teams.map((t) => ({ ...t, type: 'team' as const, icon: Network })),
        ]);
      })
      .catch(() => { if (active) setSearchItems([]); });
    return () => { active = false; };
  }, [open, query]);

  const results = React.useMemo(() => {
    if (!query.trim()) return searchItems.slice(0, 8);
    return searchItems.filter(
      (item) => fuzzyMatch(query, item.name) || fuzzyMatch(query, item.subtitle)
    );
  }, [query, searchItems]);

  // 分组
  const grouped = React.useMemo(() => {
    const g: Record<string, SearchItem[]> = {};
    results.forEach((item) => {
      if (!g[item.type]) g[item.type] = [];
      g[item.type].push(item);
    });
    return g;
  }, [results]);

  const flatResults = results;

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatResults[activeIndex];
        if (item) {
          router.push(item.href);
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, flatResults, activeIndex, router]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[15vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} style={{ animation: 'fadeIn 150ms ease-out' }} />
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
        style={{ animation: 'paletteIn 200ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* 搜索输入 */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            placeholder="搜索项目、开发者、团队..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
        </div>

        {/* 结果列表 */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {flatResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              无匹配结果，试试其他关键词
            </div>
          ) : (
            Object.entries(grouped).map(([type, items]) => (
              <div key={type} className="mb-2">
                <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {TYPE_LABEL[type as keyof typeof TYPE_LABEL]} · {items.length}
                </div>
                {items.map((item) => {
                  const idx = flatResults.indexOf(item);
                  const active = idx === activeIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => { router.push(item.href); onClose(); }}
                      className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors ${
                        active ? 'bg-muted' : 'hover:bg-muted/50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
                      </div>
                      {active && <CornerDownLeft className="h-3 w-3 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> 导航</span>
            <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> 跳转</span>
          </div>
          <span>DevLens 全局搜索</span>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes paletteIn { from { opacity: 0; transform: translateY(-12px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>,
    document.body
  );
}
