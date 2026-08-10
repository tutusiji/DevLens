/**
 * Toast 轻量通知系统：统一操作反馈，替代 window.alert 与散落的临时提示。
 *
 * 两种用法：
 *  1. 全局单例（推荐）：在根 layout 挂 <GlobalToastProvider />，
 *     任意组件 `import { toast } from '@/components/ui/toast'` 直接调用。
 *  2. 局部 hook（旧）：useToast() 返回 { toast, ToastViewport }，页面级挂载。
 */
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

const TYPE_META: Record<ToastType, { icon: React.ComponentType<{ className?: string }>; accent: string; iconColor: string }> = {
  success: { icon: CheckCircle2, accent: 'border-success/30', iconColor: 'text-success' },
  error: { icon: XCircle, accent: 'border-destructive/30', iconColor: 'text-destructive' },
  info: { icon: Info, accent: 'border-primary/30', iconColor: 'text-primary' },
  warning: { icon: AlertTriangle, accent: 'border-warning/30', iconColor: 'text-warning' },
};

let toastIdSeq = 0;

// ============ 全局单例（模块级状态 + 订阅） ============
type Listener = (items: ToastItem[]) => void;
const listeners = new Set<Listener>();
let globalItems: ToastItem[] = [];
const timers: Record<number, ReturnType<typeof setTimeout>> = {};

function dismissGlobal(id: number) {
  globalItems = globalItems.filter((t) => t.id !== id);
  const timer = timers[id];
  if (timer) {
    clearTimeout(timer);
    delete timers[id];
  }
  listeners.forEach((l) => l(globalItems));
}

function pushGlobal(type: ToastType, title: string, description?: string) {
  const id = ++toastIdSeq;
  globalItems = [...globalItems.slice(-4), { id, type, title, description }];
  timers[id] = setTimeout(() => dismissGlobal(id), 4000);
  listeners.forEach((l) => l(globalItems));
}

/** 全局单例：任意组件直接调用，无需页面级挂载。 */
export const toast: {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
} = {
  success: (t, d) => pushGlobal('success', t, d),
  error: (t, d) => pushGlobal('error', t, d),
  info: (t, d) => pushGlobal('info', t, d),
  warning: (t, d) => pushGlobal('warning', t, d),
};

/** 全局 Toast 视图：在根 layout 挂一次，全局单例 toast 的渲染出口。 */
export function GlobalToastProvider() {
  const [items, setItems] = React.useState<ToastItem[]>(globalItems);

  React.useEffect(() => {
    const listener: Listener = (next) => setItems(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => dismissGlobal(item.id)} />
      ))}
    </div>,
    document.body,
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-xl border bg-popover p-3 shadow-lg',
        meta.accent,
        'animate-[toastIn_180ms_ease-out]',
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.iconColor)} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{item.title}</div>
        {item.description && <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>}
      </div>
      <button type="button" onClick={onDismiss} className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground" aria-label="关闭">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ============ 局部 hook（旧用法，页面级挂载） ============
interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

export function useToast(): { toast: ToastApi; ToastViewport: React.FC } {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const timersRef = React.useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timersRef.current[id];
    }
  }, []);

  const push = React.useCallback((type: ToastType, title: string, description?: string) => {
    const id = ++toastIdSeq;
    setItems((prev) => [...prev.slice(-4), { id, type, title, description }]);
    timersRef.current[id] = setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const toastApi = React.useMemo<ToastApi>(() => ({
    success: (t, d) => push('success', t, d),
    error: (t, d) => push('error', t, d),
    info: (t, d) => push('info', t, d),
    warning: (t, d) => push('warning', t, d),
  }), [push]);

  const ToastViewport = React.useCallback(() => {
    if (typeof document === 'undefined') return null;
    return createPortal(
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>,
      document.body,
    );
  }, [items, dismiss]);

  return { toast: toastApi, ToastViewport };
}
