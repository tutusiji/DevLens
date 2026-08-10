/**
 * Toast 轻量通知系统：统一操作反馈，替代 window.alert 与散落的临时提示。
 * 用法：
 *   const { toast, ToastViewport } = useToast();
 *   toast.success('已保存'); toast.error('删除失败', '详情'); toast.info('提示');
 *   <ToastViewport />
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

interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

let toastIdSeq = 0;

export function useToast(): { toast: ToastApi; ToastViewport: React.FC } {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const timers = React.useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const push = React.useCallback((type: ToastType, title: string, description?: string) => {
    const id = ++toastIdSeq;
    setItems((prev) => [...prev.slice(-4), { id, type, title, description }]);
    timers.current[id] = setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const toast = React.useMemo<ToastApi>(() => ({
    success: (t, d) => push('success', t, d),
    error: (t, d) => push('error', t, d),
    info: (t, d) => push('info', t, d),
    warning: (t, d) => push('warning', t, d),
  }), [push]);

  const ToastViewport = React.useCallback(() => {
    if (typeof document === 'undefined') return null;
    return createPortal(
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => {
          const meta = TYPE_META[item.type];
          const Icon = meta.icon;
          return (
            <div
              key={item.id}
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
              <button type="button" onClick={() => dismiss(item.id)} className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground" aria-label="关闭">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>,
      document.body,
    );
  }, [items, dismiss]);

  return { toast, ToastViewport };
}
