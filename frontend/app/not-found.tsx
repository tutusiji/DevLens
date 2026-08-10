/**
 * 全局 404 页：路由未匹配时的友好空态
 */
import * as React from 'react';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40">
        <SearchX className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">页面不存在</h1>
        <p className="mt-1 text-sm text-muted-foreground">你访问的页面可能已被移动或删除。</p>
      </div>
      <div className="flex gap-2">
        <Link href="/dashboard">
          <Button variant="default">回到决策总览</Button>
        </Link>
        <Link href="/projects">
          <Button variant="outline">查看项目</Button>
        </Link>
      </div>
    </div>
  );
}
