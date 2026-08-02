'use client';

import * as React from 'react';
import { Boxes, CheckCircle2, GitFork, Layers3, ShieldAlert, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArchitectureFlow } from '@/components/architecture-flow';
import { scoreColor } from '@/lib/utils';
import type { ArchitectureDesign } from '@/lib/types';

const LAYER_COLOR: Record<string, string> = {
  edge: '#5B8FF9',
  service: '#7CB305',
  data: '#F6BD16',
  infra: '#7262FD',
};

const SEVERITY_VARIANT: Record<string, 'danger' | 'warning' | 'secondary'> = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'secondary',
};

function formatGeneratedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || '待生成' : date.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function ArchitectureDesignView({
  design,
  compact = false,
}: {
  design: ArchitectureDesign;
  compact?: boolean;
}) {
  const layerCount = design.layers.length;
  const stats: Array<{ label: string; value: number; icon: React.ComponentType<{ className?: string }> }> = [
    { label: '架构组件', value: design.components.length, icon: Boxes },
    { label: '架构分层', value: layerCount, icon: Layers3 },
    { label: '组件关系', value: design.relations.length, icon: GitFork },
    { label: '高风险模块', value: design.risks.length, icon: ShieldAlert },
  ];

  return (
    <div className="space-y-4">
      {!compact && (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-sm text-primary"><Sparkles className="h-4 w-4" />Project-derived architecture</div>
                <h2 className="text-xl font-bold">{design.projectName} · 架构设计方案</h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">{design.overview}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {design.language && <Badge variant="outline">{design.language}</Badge>}
                {design.branch && <Badge variant="outline" className="font-mono">{design.branch}</Badge>}
                {design.commit && <Badge variant="outline" className="font-mono">{design.commit}</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: StatIcon }) => {
          return (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><StatIcon className="h-4 w-4" /></div>
                <div className="mt-2 font-mono text-2xl font-bold">{value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>架构分层图</CardTitle>
              <CardDescription>从当前项目的模块、静态依赖、技术资产和风险工件提取；支持拖拽节点、空白处平移和滚轮缩放。</CardDescription>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {design.layers.map((layer) => (
                <span key={layer.key} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: layer.color || LAYER_COLOR[layer.key] }} />
                  {layer.label} · {layer.componentCount}
                </span>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {design.components.length ? (
            <div className="rounded-lg border border-border bg-background p-2">
              <ArchitectureFlow design={design} compact={compact} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              当前分析尚未产出可用模块或技术资产。重新执行项目分析后将自动生成架构方案。
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <Card>
          <CardHeader><CardTitle>分层组件与设计边界</CardTitle><CardDescription>组件的归类来自路径、依赖与部署资产的可解释规则。</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {design.layers.map((layer) => (
              <div key={layer.key} className="rounded-lg border border-border/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: layer.color || LAYER_COLOR[layer.key] }} /><span className="text-sm font-medium">{layer.label}</span><Badge variant="outline">{layer.componentCount} 个组件</Badge></div>
                  <span className="text-xs text-muted-foreground">{layer.description}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {layer.components.map((component) => <Badge key={component} variant="secondary" className="font-mono">{component}</Badge>)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>架构决策依据</CardTitle><CardDescription>由分析产物自动归纳，供技术负责人确认与补充。</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {design.decisions.map((decision) => (
                <div key={decision.title} className="rounded-lg bg-muted/35 p-3">
                  <div className="text-xs text-muted-foreground">{decision.title}</div>
                  <div className="mt-1 text-sm font-medium">{decision.value}</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{decision.evidence}</div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>架构治理风险</CardTitle><CardDescription>高风险模块应作为架构演进的优先治理对象。</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {!design.risks.length ? <div className="rounded-lg bg-success/10 p-3 text-sm text-success"><CheckCircle2 className="mr-1 inline h-4 w-4" />当前未识别高风险模块。</div> : design.risks.map((risk) => (
                <div key={`${risk.path}-${risk.name}`} className="rounded-lg border border-border/70 p-3">
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-medium">{risk.name}</div><div className="truncate font-mono text-[11px] text-muted-foreground">{risk.path}</div></div><Badge variant={SEVERITY_VARIANT[risk.severity] || 'secondary'}>{risk.severity}</Badge></div>
                  <div className="mt-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">{risk.issueCount} 项问题 · {risk.owner}</span><span className="font-mono font-semibold" style={{ color: scoreColor(100 - risk.score) }}>健康 {Math.max(0, 100 - risk.score)}</span></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {!compact && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
          <strong className="text-foreground">提取原则：</strong>
          <ul className="mt-1 list-disc space-y-1 pl-5">{design.principles.map((principle) => <li key={principle}>{principle}</li>)}</ul>
          <div className="mt-3 text-xs text-muted-foreground">最近生成：{formatGeneratedAt(design.generatedAt)}</div>
        </div>
      )}
    </div>
  );
}
