/**
 * 项目组合评估：同一租户内批量横向对比、项目评分历史与可售化报告导出。
 */
'use client';

import * as React from 'react';
import { BarChart3, Download, FileText, GitCompareArrows, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@heroui/react/checkbox';
import { ProgressBar } from '@/components/widgets';
import { LineTrend } from '@/components/charts';
import { api } from '@/lib/api';
import { scoreColor } from '@/lib/utils';
import type { ProjectComparisonItem, ProjectTrendResponse } from '@/lib/types';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function triggerDownload(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

export default function ProjectPortfolioPage() {
  const [projects, setProjects] = React.useState<ProjectComparisonItem[]>([]);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [trend, setTrend] = React.useState<ProjectTrendResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [exporting, setExporting] = React.useState<'html' | 'pdf' | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const comparison = await api.getProjectComparison();
      setProjects(comparison.projects);
      setSelected((current) => current.filter((id) => comparison.projects.some((project) => project.projectId === id)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载项目组合失败');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const toggleProject = (projectId: string) => {
    setSelected((current) => current.includes(projectId)
      ? current.filter((id) => id !== projectId)
      : [...current, projectId]);
  };

  const showTrend = async (projectId: string) => {
    try {
      setError('');
      setTrend(await api.getProjectTrend(projectId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载趋势失败');
    }
  };

  const exportReport = async (format: 'html' | 'pdf') => {
    setExporting(format);
    try {
      const download = await api.downloadProjectComparisonReport(selected, format);
      triggerDownload(download.blob, download.filename);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '导出报告失败');
    } finally {
      setExporting(null);
    }
  };

  const selectedItems = projects.filter((project) => selected.includes(project.projectId));
  const averageScore = selectedItems.length
    ? Math.round(selectedItems.reduce((sum, project) => sum + project.score, 0) / selectedItems.length)
    : 0;
  const trendData = (trend?.snapshots || []).map((snapshot) => ({
    date: formatDate(snapshot.recordedAt),
    score: snapshot.score,
    quality: snapshot.quality,
    security: snapshot.security,
    debt: snapshot.debt,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-primary"><GitCompareArrows className="h-4 w-4" />Portfolio intelligence</div>
          <h1 className="text-2xl font-bold tracking-tight">项目组合对比</h1>
          <p className="mt-1 text-sm text-muted-foreground">选择多个项目，横向比较质量、安全与技术债，并基于评分历史查看趋势。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!selected.length || exporting !== null} onClick={() => void exportReport('html')}>
            <FileText className="h-4 w-4" />{exporting === 'html' ? '生成中…' : '导出 HTML'}
          </Button>
          <Button disabled={!selected.length || exporting !== null} onClick={() => void exportReport('pdf')}>
            <Download className="h-4 w-4" />{exporting === 'pdf' ? '渲染 PDF…' : '导出 PDF'}
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">已选项目</div><div className="mt-1 font-mono text-3xl font-bold">{selected.length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">组合平均健康度</div><div className="mt-1 font-mono text-3xl font-bold" style={{ color: scoreColor(averageScore) }}>{averageScore || '—'}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">可用项目</div><div className="mt-1 font-mono text-3xl font-bold">{projects.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />横向评估矩阵</CardTitle>
          <CardDescription>仅在当前租户范围内比较；评分变化基于每次完成分析时固化的历史快照。</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr><th className="px-2 py-3">选择</th><th className="px-2 py-3">项目</th><th className="px-2 py-3">健康度</th><th className="px-2 py-3">质量</th><th className="px-2 py-3">安全</th><th className="px-2 py-3">技术债</th><th className="px-2 py-3">趋势</th><th className="px-2 py-3" /></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">正在加载项目组合…</td></tr> : projects.map((project) => {
                const selectedNow = selected.includes(project.projectId);
                return <tr key={project.projectId} className="border-b border-border/60 hover:bg-muted/25">
                  <td className="px-2 py-3">
                    <Checkbox
                      aria-label={`选择 ${project.projectName}`}
                      isSelected={selectedNow}
                      onChange={() => toggleProject(project.projectId)}
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                  </td>
                  <td className="px-2 py-3"><div className="font-medium">{project.projectName}</div><div className="text-xs text-muted-foreground">{project.language || '—'} · {project.contributors} 人</div></td>
                  <td className="px-2 py-3"><span className="font-mono font-bold" style={{ color: scoreColor(project.score) }}>{project.score}</span></td>
                  <td className="px-2 py-3"><ProgressBar value={project.quality} showValue /></td>
                  <td className="px-2 py-3"><ProgressBar value={project.security} showValue /></td>
                  <td className="px-2 py-3"><ProgressBar value={project.debt} showValue /></td>
                  <td className="px-2 py-3">{project.scoreDelta === null || project.scoreDelta === undefined ? <Badge variant="outline">暂无基线</Badge> : <Badge variant={project.scoreDelta >= 0 ? 'success' : 'danger'}>{project.scoreDelta >= 0 ? '+' : ''}{project.scoreDelta}</Badge>}</td>
                  <td className="px-2 py-3"><Button size="sm" variant="ghost" onClick={() => void showTrend(project.projectId)}><TrendingUp className="h-4 w-4" />趋势</Button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {trend && (
        <Card>
          <CardHeader><CardTitle>{trend.projectName} · 历史趋势</CardTitle><CardDescription>来源包含旧数据基线（legacy_baseline）与后续真实分析快照。</CardDescription></CardHeader>
          <CardContent>
            <LineTrend
              data={trendData}
              xKey="date"
              height={280}
              series={[
                { key: 'score', name: '健康度', color: 'var(--chart-1)' },
                { key: 'quality', name: '质量', color: 'var(--chart-2)' },
                { key: 'security', name: '安全', color: 'var(--chart-3)' },
                { key: 'debt', name: '技术债', color: 'var(--chart-4)', dashed: true },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
