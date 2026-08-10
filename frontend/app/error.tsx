'use client';

/**
 * 全局错误边界：页面运行时错误时的兜底（提供重试与回到首页）
 */
import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // 上报错误可在此接入（console 仅开发期提示）
    console.error('[DevLens] 页面错误:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">页面出错了</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          加载过程中发生了异常{error.digest ? `（错误码 ${error.digest}）` : ''}，请重试或返回首页。
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="default" onClick={() => reset()}>重试</Button>
        <Button variant="outline" onClick={() => { window.location.href = '/dashboard'; }}>回到决策总览</Button>
      </div>
    </div>
  );
}
