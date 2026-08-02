/**
 * 架构设计图谱中心：以项目为单位展示自动提取的架构方案，
 * 不再将多个项目的代码模块拼成一张没有上下文的依赖图。
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, Compass, Layers3, LoaderCircle, Waypoints } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArchitectureDesignView } from '@/components/architecture-design-view';
import { api } from '@/lib/api';
import type { ArchitectureDesign } from '@/lib/types';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || '待生成' : date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ArchitectureDesignPage() {
  const [designs, setDesigns] = React.useState<ArchitectureDesign[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let active = true;
    api.getArchitectureDesigns()
      .then((response) => {
        if (!active) return;
        setDesigns(response.designs);
        setSelectedProjectId(response.designs[0]?.projectId || '');
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : '加载架构设计方案失败。');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selected = designs.find((design) => design.projectId === selectedProjectId) || designs[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-primary"><Compass className="h-4 w-4" />Architecture intelligence</div>
          <h1 className="text-2xl font-bold tracking-tight">架构设计图谱</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">从每个项目的代码模块、静态依赖、技术资产、部署配置与风险工件中提取架构设计方案。这里展示的是项目级架构视图，不混合不同仓库的代码模块。</p>
        </div>
        <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-muted-foreground"><Waypoints className="mr-1 inline h-3.5 w-3.5 text-primary" />代码图谱已收归各项目详情页</div>
      </div>

      {error && <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />项目架构方案</CardTitle><CardDescription>选择项目后查看其独立的架构分层、组件关系与治理风险。</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />提取方案中…</div> : !designs.length ? <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">当前租户没有已接入项目。</div> : designs.map((design) => {
              const active = design.projectId === selected?.projectId;
              return (
                <button key={design.projectId} onClick={() => setSelectedProjectId(design.projectId)} className={`w-full rounded-lg border p-3 text-left transition-colors ${active ? 'border-primary/45 bg-primary/8' : 'border-border/70 hover:bg-muted/35'}`}>
                  <div className="flex items-start justify-between gap-2"><span className="min-w-0 truncate font-medium">{design.projectName}</span><div className="flex shrink-0 gap-1">{design.analysisStatus === 'pending' && <Badge variant="warning">待分析</Badge>}{design.language && <Badge variant="outline">{design.language}</Badge>}</div></div>
                  <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">{design.analysisStatus === 'pending' ? <span>尚未发现架构资产</span> : <><span>{design.components.length} 组件</span><span>·</span><span>{design.layers.length} 分层</span></>}<span>·</span><span>{formatDate(design.generatedAt)}</span></div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="min-w-0">
          {loading ? <div className="h-[600px] skeleton rounded-xl" /> : selected ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Link href={`/projects/${selected.projectId}`}>
                  <Button variant="outline" size="sm">进入项目详情查看代码图谱 <ArrowRight className="h-4 w-4" /></Button>
                </Link>
              </div>
              <ArchitectureDesignView design={selected} />
            </div>
          ) : (
            <Card><CardContent className="p-12 text-center text-sm text-muted-foreground"><Layers3 className="mx-auto mb-3 h-7 w-7" />请选择一个已分析项目。</CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}
