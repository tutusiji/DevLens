/**
 * 代码图谱 - 模块依赖关系可视化（数据来自后端 /graph，从项目模块风险生成）
 */
'use client';

import * as React from 'react';
import { Waypoints, GitFork, Boxes } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/widgets';
import { GraphCanvas, type GraphNode } from '@/components/graph-canvas';
import { layerColors } from '@/lib/mock-data';
import { api } from '@/lib/api';

const layerLabels: Record<string, string> = {
  edge: '接入层',
  service: '服务层',
  data: '数据层',
  infra: '基础设施',
};

export default function GraphPage() {
  const [data, setData] = React.useState<{ nodes: any[]; edges: any[]; stats: any } | null>(null);
  React.useEffect(() => {
    api.getGraph().then(setData).catch(() => setData(null));
  }, []);
  if (!data) return <div className="space-y-6"><div className="h-8 w-64 skeleton rounded" /><div className="h-96 skeleton rounded-xl" /></div>;

  const graphNodes: GraphNode[] = data.nodes.map((m) => ({
    id: m.id,
    x: m.x,
    y: m.y,
    size: 20,
    color: layerColors[m.layer] || layerColors.service,
    label: m.label,
    sublabel: `${m.loc} · ${m.health}`,
  }));

  const graphStats = [
    { label: '模块总数', value: data.stats.moduleCount, icon: Boxes },
    { label: '依赖关系', value: data.stats.edgeCount, icon: GitFork },
    { label: '平均健康度', value: data.stats.avgHealth, unit: '分', icon: Waypoints },
  ];

  return (
    <>
      <PageHeader
        title="代码图谱"
        description="模块级代码依赖关系可视化 - 直观呈现系统架构、耦合与健康分布"
        actions={<Badge variant="outline" className="font-mono">实时模块</Badge>}
      />

      {/* 统计卡 */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {graphStats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                {s.value}
                {s.unit && <span className="ml-1 text-sm text-muted-foreground">{s.unit}</span>}
              </p>
            </Card>
          );
        })}
      </div>

      {/* 图谱 + 模块清单 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>模块依赖图谱</CardTitle>
                <CardDescription>悬停节点高亮直接依赖 · 节点标注问题数与健康度</CardDescription>
              </div>
              <div className="hidden flex-wrap gap-3 font-mono text-[11px] text-muted-foreground sm:flex">
                {Object.entries(layerColors).map(([layer, color]) => (
                  <span key={layer} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                    {layerLabels[layer]}
                  </span>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl bg-[radial-gradient(circle_at_center,var(--secondary)_0%,transparent_70%)]">
              <GraphCanvas nodes={graphNodes} links={data.edges} height={480} />
            </div>
          </CardContent>
        </Card>

        {/* 模块清单 */}
        <Card>
          <CardHeader>
            <CardTitle>模块清单</CardTitle>
            <CardDescription>按健康度排序</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...data.nodes]
              .sort((a, b) => b.health - a.health)
              .map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: layerColors[m.layer] || layerColors.service }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm">{m.label}</p>
                    <p className="text-[11px] text-muted-foreground">{layerLabels[m.layer] || '服务层'} · {m.loc}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: m.health >= 85 ? 'var(--success)' : m.health >= 70 ? 'var(--warning)' : 'var(--destructive)' }}>
                    {m.health}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
