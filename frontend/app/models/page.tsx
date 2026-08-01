/**
 * 大模型管理页
 * Provider 卡片 + 任务路由表 + 用量统计
 */
'use client';

import * as React from 'react';
import { Bot, Key, Link2, CheckCircle2, XCircle, Zap, Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageHeader } from '@/components/widgets';
import { api } from '@/lib/api';

export default function ModelsPage() {
  const [providers, setProviders] = React.useState<any[]>([]);
  const [routes, setRoutes] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    Promise.all([api.getModelProviders(), api.getTaskRoutes()])
      .then(([p, r]) => { setProviders(p); setRoutes(r); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  if (loading) return <div className="space-y-6"><div className="h-8 w-64 skeleton rounded" /><div className="h-96 skeleton rounded-xl" /></div>;
  return (
    <>
      <PageHeader
        title="大模型管理"
        description="配置 LLM Provider 与任务路由，AI 审查 / 文档生成 / 评估都依赖此配置"
        actions={<Button variant="accent" size="sm"><Save className="h-4 w-4" />保存配置</Button>}
      />

      {/* Provider 卡片 */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {providers.map((p) => (
          <Card key={p.key}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="h-4 w-4 text-primary" />
                  {p.name}
                </CardTitle>
                {p.status === 'connected' ? (
                  <Badge variant="success"><CheckCircle2 className="h-3 w-3" />已连通</Badge>
                ) : (
                  <Badge variant="secondary"><XCircle className="h-3 w-3" />未配置</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Key className="h-3 w-3" /> API Key
                </label>
                <Input
                  type="password"
                  defaultValue={p.apiKey}
                  placeholder="sk-..."
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Link2 className="h-3 w-3" /> Base URL
                </label>
                <Input
                  defaultValue={p.baseUrl}
                  className="font-mono text-xs"
                />
              </div>
              {p.models.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {p.models.map((m: string) => (
                    <Badge key={m} variant="outline" className="font-mono text-[10px]">{m}</Badge>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full">
                <Zap className="h-3 w-3" />测试连接
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 任务路由表 */}
      <Card>
        <CardHeader>
          <CardTitle>任务路由策略</CardTitle>
          <CardDescription>不同 AI 任务路由到不同 Provider / Model</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务类型</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>模型</TableHead>
                <TableHead>说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((r) => (
                <TableRow key={r.task}>
                  <TableCell className="font-medium">{r.task}</TableCell>
                  <TableCell><Badge variant="secondary">{r.provider}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="font-mono">{r.model}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{r.desc}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
