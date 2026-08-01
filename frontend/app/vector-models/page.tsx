/**
 * 向量模型管理页
 * Embedding 配置 + Qdrant 连接 + Collection 列表 + 索引策略
 */
'use client';

import * as React from 'react';
import { Database, Layers, RefreshCw, Save, HardDrive, Hash } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Segmented } from '@/components/ui/segmented';
import { PageHeader } from '@/components/widgets';
import { api } from '@/lib/api';

export default function VectorModelsPage() {
  const [collections, setCollections] = React.useState<any[]>([]);
  const [embeddings, setEmbeddings] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    Promise.all([api.getVectorCollections(), api.getEmbeddingModels()])
      .then(([c, e]) => { setCollections(c); setEmbeddings(e); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  if (loading) return <div className="space-y-6"><div className="h-8 w-64 skeleton rounded" /><div className="h-96 skeleton rounded-xl" /></div>;
  return (
    <>
      <PageHeader
        title="向量模型管理"
        description="配置 Embedding 模型与 Qdrant 向量库，代码语义检索的基础设施"
        actions={<Button variant="accent" size="sm"><Save className="h-4 w-4" />保存配置</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Embedding 模型配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Embedding 模型
            </CardTitle>
            <CardDescription>代码向量化用的 embedding 模型</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {embeddings.map((m) => (
              <div key={m.name} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">维度 {m.dimension || '未指定'}</div>
                </div>
                <Badge variant={m.status === 'active' ? 'success' : 'secondary'}>
                  {m.status === 'active' ? '使用中' : '未启用'}
                </Badge>
              </div>
            ))}
            <div className="space-y-1 pt-2">
              <label className="text-xs text-muted-foreground">Chunk 切分策略</label>
              <Segmented
                size="sm"
                value="function"
                onChange={() => {}}
                options={[
                  { value: 'function', label: '按函数' },
                  { value: 'class', label: '按类' },
                  { value: 'file', label: '按文件' },
                ]}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
              <div>
                <div className="text-sm font-medium">增量更新</div>
                <div className="text-xs text-muted-foreground">只处理 diff，不全量重建</div>
              </div>
              <button className="relative h-6 w-11 rounded-full bg-primary cursor-pointer">
                <span className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white" />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Qdrant 连接配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Qdrant 连接
            </CardTitle>
            <CardDescription>向量数据库连接配置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-muted-foreground">URL</label>
                <Input defaultValue="http://localhost:6333" className="font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">端口</label>
                <Input defaultValue="6333" className="font-mono text-xs" />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3">
              <div className="h-2 w-2 rounded-full bg-success" />
              <span className="text-sm text-success">已连通</span>
              <span className="ml-auto text-xs text-muted-foreground">延迟 2ms</span>
            </div>
            <Button variant="outline" size="sm" className="w-full">
              <RefreshCw className="h-3 w-3" />重建全部索引
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Collection 列表 */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Collection 列表</CardTitle>
          <CardDescription>每个项目对应一个 vector collection</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Collection</TableHead>
                <TableHead className="text-right">向量数</TableHead>
                <TableHead className="text-right">维度</TableHead>
                <TableHead className="text-right">占用空间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-mono">{c.name}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    <span className="flex items-center justify-end gap-1">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      {c.vectors.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{c.dimension}</TableCell>
                  <TableCell className="text-right">
                    <span className="flex items-center justify-end gap-1 text-muted-foreground">
                      <HardDrive className="h-3 w-3" />
                      {c.size}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-7">
                      <RefreshCw className="h-3.5 w-3.5" />重建
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
