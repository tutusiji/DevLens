/** 旧图谱地址兼容页：代码图谱已归属项目详情，架构图谱进入新中心。 */
'use client';

import Link from 'next/link';
import { ArrowRight, Compass, Waypoints } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LegacyGraphPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-12">
      <div className="text-center">
        <Waypoints className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-2xl font-bold">代码图谱已归属项目</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">模块级代码依赖必须绑定仓库、分支和分析快照。请从项目详情页进入“代码图谱”Tab，避免将不同项目的模块混合展示。</p>
      </div>
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start gap-3"><Compass className="mt-0.5 h-5 w-5 text-primary" /><div><div className="font-medium">需要查看架构级方案？</div><p className="mt-1 text-sm text-muted-foreground">新的“架构设计图谱”从各项目的代码、依赖、资产、部署配置和风险中提取分层方案。</p></div></div>
          <Link href="/architecture-design"><Button className="w-full">进入架构设计图谱 <ArrowRight className="h-4 w-4" /></Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}
