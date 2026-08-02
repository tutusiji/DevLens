/**
 * 开发者画像详情页
 * 8 维能力雷达 + 成长曲线 + 行为证据 + 协作伙伴 + 主导模块 + AI 建议
 */
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Database, Download, Eye, FileText,
  GitCommit, LoaderCircle, Sparkles, TrendingUp, Users2, XCircle, Box,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader, ScoreRing, ProgressBar } from '@/components/widgets';
import { CapabilityRadar, LineTrend } from '@/components/charts';
import { CollaborationGraph } from '@/components/collaboration-graph';
import { DiceBearAvatar } from '@/components/dicebear-avatar';
import { api } from '@/lib/api';
import { developers, roleConfigs, getRoleStandard, DIMENSION_LABELS } from '@/lib/mock-data';
import { scoreColor } from '@/lib/utils';
import type {
  CapabilityRoleInfo, DeveloperDetail, DeveloperEvaluation, Level,
} from '@/lib/types';

// 职级 Badge 颜色：D 高阶紫、E 资深绿、F 中高级琥珀、G 成长次级
function levelVariant(level: Level): 'default' | 'accent' | 'secondary' | 'success' {
  const prefix = level[0];
  if (prefix === 'D') return 'accent';
  if (prefix === 'E') return 'success';
  if (prefix === 'F') return 'default';
  return 'secondary';
}

// 达标率计算：个人能力 >= 标准的维度数 / 总维度数
function calcPassRate(capability: Record<string, any>, standard: Record<string, number>): { passed: number; total: number; rate: number } {
  const dims = Object.keys(standard);
  const passed = dims.filter((d) => Number(capability[d] || 0) >= standard[d]).length;
  return { passed, total: dims.length, rate: Math.round((passed / dims.length) * 100) };
}

function formatEvaluationTime(value: string): string {
  if (!value) return '时间未知';
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  }).format(time);
}

const TREND_ICON = { up: '↑', down: '↓', stable: '→' };
const TREND_COLOR = { up: 'var(--success)', down: 'var(--destructive)', stable: 'var(--muted-foreground)' };

export default function DeveloperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [detail, setDetail] = React.useState<DeveloperDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [evaluation, setEvaluation] = React.useState<DeveloperEvaluation | null>(null);
  const [evaluationLoading, setEvaluationLoading] = React.useState(true);
  const [evaluationError, setEvaluationError] = React.useState('');
  const [isEvaluating, setIsEvaluating] = React.useState(false);
  const [repoPath, setRepoPath] = React.useState('');
  const [gitAuthors, setGitAuthors] = React.useState<string[]>([]);
  const [gitAuthor, setGitAuthor] = React.useState('');
  const [authorsLoading, setAuthorsLoading] = React.useState(false);
  const [sourceError, setSourceError] = React.useState('');
  const [availableRepoPaths, setAvailableRepoPaths] = React.useState<string[]>([]);
  const [reportExporting, setReportExporting] = React.useState<'html' | 'pdf' | null>(null);
  const [evaluationRole, setEvaluationRole] = React.useState<CapabilityRoleInfo | null>(null);
  const pollingTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = React.useCallback(() => {
    if (pollingTimer.current) {
      clearTimeout(pollingTimer.current);
      pollingTimer.current = null;
    }
  }, []);

  const startPolling = React.useCallback(() => {
    stopPolling();
    setIsEvaluating(true);
    setEvaluationError('');
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const latest = await api.getLatestDeveloperEvaluation(id);
        if (latest) setEvaluation(latest);
        if (latest?.status === 'completed' || latest?.status === 'failed') {
          setIsEvaluating(false);
          if (latest.status === 'failed') setEvaluationError(latest.error || '评估失败，请重试。');
          stopPolling();
          return;
        }
        if (attempts >= 30) {
          setIsEvaluating(false);
          setEvaluationError('评估仍在处理中，请稍后刷新页面查看最新结果。');
          stopPolling();
          return;
        }
        pollingTimer.current = setTimeout(poll, 3000);
      } catch (error) {
        setIsEvaluating(false);
        setEvaluationError(error instanceof Error ? error.message : '轮询评估结果失败。');
        stopPolling();
      }
    };

    pollingTimer.current = setTimeout(poll, 3000);
  }, [id, stopPolling]);

  const loadGitAuthors = React.useCallback(async (path: string) => {
    const normalizedPath = path.trim();
    if (!normalizedPath) {
      setGitAuthors([]);
      setGitAuthor('');
      return;
    }
    setAuthorsLoading(true);
    setSourceError('');
    try {
      const authors = await api.getGitAuthors(normalizedPath);
      setGitAuthors(authors);
      setGitAuthor((current) => (authors.includes(current) ? current : authors[0] || ''));
      if (!authors.length) setSourceError('该仓库未找到 git 作者，请确认仓库路径和提交历史。');
    } catch (error) {
      setGitAuthors([]);
      setGitAuthor('');
      setSourceError(error instanceof Error ? error.message : '读取 git 作者失败。');
    } finally {
      setAuthorsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    api.getDeveloperDetail(id).then((d) => {
      setDetail(d);
      setLoading(false);
    });
  }, [id]);

  React.useEffect(() => {
    let active = true;
    setEvaluationLoading(true);
    setEvaluationError('');
    api.getLatestDeveloperEvaluation(id)
      .then((latest) => {
        if (!active) return;
        setEvaluation(latest);
        if (latest?.status === 'failed') setEvaluationError(latest.error || '评估失败，请重试。');
        if (latest?.status === 'running') startPolling();
      })
      .catch((error) => {
        if (active) setEvaluationError(error instanceof Error ? error.message : '读取实测评估失败。');
      })
      .finally(() => {
        if (active) setEvaluationLoading(false);
      });
    return () => {
      active = false;
      stopPolling();
    };
  }, [id, startPolling, stopPolling]);

  React.useEffect(() => {
    if (!detail) return;
    let active = true;
    api.getRepos()
      .then((repos) => {
        if (!active) return;
        const availableRepos = repos.filter((repo) => Boolean(repo.path));
        setAvailableRepoPaths(availableRepos.map((repo) => repo.path));
        const preferredRepo = availableRepos.find((repo) => repo.teamId === detail.teamId)
          || availableRepos[0];
        if (!preferredRepo) return;
        setRepoPath((current) => current || preferredRepo.path);
        void loadGitAuthors(preferredRepo.path);
      })
      .catch((error) => {
        if (active) setSourceError(error instanceof Error ? error.message : '读取仓库列表失败。');
      });
    api.getCapabilityRole(detail.roleType)
      .then((role) => {
        if (active) setEvaluationRole(role);
      })
      .catch(() => {
        if (active) setEvaluationRole(null);
      });
    return () => {
      active = false;
    };
  }, [detail, loadGitAuthors]);

  const startEvaluation = async () => {
    if (!detail || !repoPath.trim() || !gitAuthor) return;
    setEvaluationError('');
    try {
      await api.triggerDeveloperEvaluation(id, {
        repoPath: repoPath.trim(),
        gitAuthor,
        roleKey: detail.roleType,
      });
      setIsEvaluating(true);
      startPolling();
    } catch (error) {
      setIsEvaluating(false);
      setEvaluationError(error instanceof Error ? error.message : '启动实测评估失败。');
    }
  };

  const downloadEvaluationReport = async (format: 'html' | 'pdf') => {
    if (!evaluation?.id) return;
    setReportExporting(format);
    setEvaluationError('');
    try {
      const download = await api.downloadDeveloperEvaluationReport(id, evaluation.id, format);
      const url = URL.createObjectURL(download.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = download.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setEvaluationError(error instanceof Error ? error.message : '导出报告失败。');
    } finally {
      setReportExporting(null);
    }
  };

  if (loading || !detail) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton rounded" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-64 skeleton rounded-xl lg:col-span-2" />
          <div className="h-64 skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/developers')}>
          <ArrowLeft className="h-4 w-4" />
          返回开发者列表
        </Button>
      </div>

      {/* ============ 头部：头像 + 基本信息 + 综合评分 ============ */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
            <DiceBearAvatar seed={detail.username} size={80} />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="font-mono text-2xl font-bold">{detail.name}</h1>
                <Badge variant={levelVariant(detail.level)} className="font-mono">{detail.level}</Badge>
                <Badge variant="accent">{detail.role}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{detail.team}</span>
                <span>·</span>
                <span className="font-mono">@{detail.username}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <GitCommit className="h-3 w-3" /> {detail.commits} commits
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {detail.reviews} reviews
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {detail.tags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ScoreRing score={detail.overall} size={120} stroke={8} label="综合评分" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============ 能力雷达 + 达标率 + 行为证据 ============ */}
      {(() => {
        const roleConfig = roleConfigs.find((r) => r.key === detail.roleType) || roleConfigs[1];
        const standard = detail.roleStandard || getRoleStandard(detail.roleType, detail.level);
        const passRate = calcPassRate(detail.capability, standard);
        return (
      <div className="mb-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {roleConfig.name}能力模型
                </CardTitle>
                <CardDescription className="mt-1">
                  个人能力 vs {detail.level} 级标准（{roleConfig.name}）
                </CardDescription>
              </div>
              {/* 达标率 Badge */}
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
                <span className="text-xs text-muted-foreground">达标率</span>
                <span className="font-mono text-lg font-bold tabular-nums" style={{ color: scoreColor(passRate.rate) }}>
                  {passRate.rate}%
                </span>
                <span className="text-xs text-muted-foreground">({passRate.passed}/{passRate.total})</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CapabilityRadar
              height={320}
              series={[
                {
                  name: '个人能力',
                  data: Object.fromEntries(
                    roleConfig.dimensions.map((dim) => [DIMENSION_LABELS[dim], (detail.capability as any)[dim] || 0])
                  ),
                  color: 'var(--chart-1)',
                },
                {
                  name: `${detail.level} 标准`,
                  data: Object.fromEntries(
                    roleConfig.dimensions.map((dim) => [DIMENSION_LABELS[dim], standard[dim] || 0])
                  ),
                  color: 'var(--chart-3)',
                },
              ]}
            />
            {/* 维度达标明细 */}
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {roleConfig.dimensions.map((dim) => {
                const personal = (detail.capability as any)[dim] || 0;
                const std = standard[dim] || 0;
                const passed = personal >= std;
                return (
                  <div key={dim} className="rounded border border-border/60 p-2">
                    <div className="text-[10px] text-muted-foreground">{DIMENSION_LABELS[dim]}</div>
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-sm font-bold tabular-nums" style={{ color: scoreColor(personal) }}>{personal}</span>
                      <span className="text-[10px] text-muted-foreground">/ {std}</span>
                    </div>
                    <div className={`text-[10px] ${passed ? 'text-success' : 'text-destructive'}`}>
                      {passed ? '✓ 达标' : `差 ${std - personal}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              行为证据
            </CardTitle>
            <CardDescription>从 Git 行为推导的能力信号</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.behaviorEvidence.map((ev) => {
              const isPercent = ev.unit === '%';
              const isRatio = ev.unit === '';
              const displayVal = isRatio ? ev.value.toFixed(2) : isPercent ? `${ev.value}%` : `${ev.value} ${ev.unit}`;
              const benchVal = isRatio ? ev.benchmark.toFixed(2) : isPercent ? `${ev.benchmark}%` : `${ev.benchmark} ${ev.unit}`;
              const better = ev.label.includes('Revert') || ev.label.includes('Hotfix')
                ? ev.value < ev.benchmark
                : ev.value > ev.benchmark;
              return (
                <div key={ev.label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{ev.label}</span>
                    <span className="font-mono text-sm tabular-nums" style={{ color: better ? 'var(--success)' : 'var(--warning)' }}>
                      {displayVal}
                    </span>
                  </div>
                  <ProgressBar
                    value={isRatio ? ev.value * 100 : ev.value}
                    max={isRatio ? 1 : ev.benchmark * 1.8}
                    showValue={false}
                    indicatorClassName={better ? 'bg-success' : 'bg-warning'}
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{ev.description}</span>
                    <span className="text-muted-foreground">均值 {benchVal}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
        );
      })()}

      {/* ============ 能力实测评估：真实 git 作者代码 + LLM 评分 ============ */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                能力实测评估
              </CardTitle>
              <CardDescription className="mt-1">
                按真实 git 作者的代码贡献进行 LLM 实测，并与角色能力标准自动比对。
              </CardDescription>
            </div>
            {evaluation?.status === 'completed' && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={evaluation.achievedLevel ? levelVariant(evaluation.achievedLevel) : 'danger'}>
                  {evaluation.achievedLevel ? `达标 ${evaluation.achievedLevel}` : '未达任何职级'}
                </Badge>
                {evaluation.bestLevel && (
                  <span className="text-muted-foreground">参考 {evaluation.bestLevel}</span>
                )}
                <Button size="sm" variant="outline" disabled={reportExporting !== null} onClick={() => void downloadEvaluationReport('html')}>
                  <FileText className="h-3.5 w-3.5" />{reportExporting === 'html' ? '生成中…' : 'HTML'}
                </Button>
                <Button size="sm" disabled={reportExporting !== null} onClick={() => void downloadEvaluationReport('pdf')}>
                  <Download className="h-3.5 w-3.5" />{reportExporting === 'pdf' ? '渲染中…' : 'PDF'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)_auto]">
            <div className="space-y-1.5">
              <label htmlFor="evaluation-repo-path" className="text-xs font-medium text-muted-foreground">
                仓库路径
              </label>
              <select
                id="evaluation-repo-path"
                value={repoPath}
                onChange={(event) => {
                  setRepoPath(event.target.value);
                  setGitAuthors([]);
                  setGitAuthor('');
                  void loadGitAuthors(event.target.value);
                }}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">请选择当前租户已接入的仓库</option>
                {availableRepoPaths.map((path) => <option key={path} value={path}>{path}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="evaluation-git-author" className="text-xs font-medium text-muted-foreground">
                Git 作者
              </label>
              <select
                id="evaluation-git-author"
                value={gitAuthor}
                disabled={authorsLoading || !repoPath.trim()}
                onChange={(event) => setGitAuthor(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {authorsLoading ? '正在读取作者…' : '请选择 git 作者'}
                </option>
                {gitAuthors.map((author) => (
                  <option key={author} value={author}>{author}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full xl:w-auto"
                disabled={isEvaluating || authorsLoading || !repoPath.trim() || !gitAuthor}
                onClick={() => void startEvaluation()}
              >
                {isEvaluating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                {isEvaluating ? '评估中…' : evaluation?.status === 'failed' ? '重新实测评估' : '开始实测评估'}
              </Button>
            </div>
          </div>

          {sourceError && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{sourceError}</span>
            </div>
          )}

          {evaluationError && evaluation?.status !== 'failed' && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{evaluationError}</span>
            </div>
          )}

          {evaluationLoading ? (
            <div className="h-24 rounded-lg skeleton" />
          ) : (isEvaluating || evaluation?.status === 'running') ? (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
              <div>
                <div className="font-medium">正在基于真实代码样本进行实测评估</div>
                <p className="mt-0.5 text-muted-foreground">已提交后台任务，页面将每 3 秒自动刷新结果。</p>
              </div>
            </div>
          ) : evaluation?.status === 'failed' ? (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <div className="font-medium text-destructive">本次实测评估失败</div>
                <p className="mt-1 text-muted-foreground">{evaluation.error || evaluationError || '请检查仓库路径、git 作者和 LLM 配置后重试。'}</p>
              </div>
            </div>
          ) : evaluation?.status === 'completed' ? (() => {
            const targetLevel = evaluation.achievedLevel || evaluation.bestLevel;
            const standards = targetLevel
              ? evaluationRole?.standards[targetLevel] || {}
              : {};
            const gapByDimension = Object.fromEntries(
              evaluation.gaps.map((gap) => [gap.dimension, gap]),
            );
            const dimensions = Object.keys(evaluation.scores);
            const radarScores = Object.fromEntries(
              dimensions.map((dimension) => [DIMENSION_LABELS[dimension] || dimension, evaluation.scores[dimension] || 0]),
            );
            const radarStandards = Object.fromEntries(
              dimensions.map((dimension) => [
                DIMENSION_LABELS[dimension] || dimension,
                standards[dimension] ?? gapByDimension[dimension]?.target ?? 0,
              ]),
            );

            return (
              <div className="space-y-5 border-t border-border pt-5">
                <div className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Database className="h-4 w-4 text-primary" />
                      {evaluation.gitAuthor}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground break-all">{evaluation.repoPath}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatEvaluationTime(evaluation.createdAt)}</span>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
                  <div className="min-w-0">
                    <CapabilityRadar
                      height={310}
                      series={[
                        { name: '实测', data: radarScores, color: 'var(--chart-1)' },
                        { name: `${targetLevel || '参考'} 标准`, data: radarStandards, color: 'var(--chart-3)' },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 content-start">
                    {dimensions.map((dimension) => {
                      const current = evaluation.scores[dimension] || 0;
                      const target = standards[dimension] ?? gapByDimension[dimension]?.target;
                      const passed = target === undefined || current >= target;
                      const gap = target === undefined ? 0 : Math.max(0, target - current);
                      return (
                        <div key={dimension} className="rounded-lg border border-border/70 p-3">
                          <div className="truncate text-[11px] text-muted-foreground">
                            {DIMENSION_LABELS[dimension] || dimension}
                          </div>
                          <div className="mt-1 flex items-baseline justify-between gap-1">
                            <span className="font-mono text-lg font-bold tabular-nums" style={{ color: scoreColor(current) }}>
                              {current}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              / {target ?? '—'}
                            </span>
                          </div>
                          <div className={`mt-1 flex items-center gap-1 text-[11px] ${passed ? 'text-success' : 'text-destructive'}`}>
                            {passed ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {target === undefined ? '标准待加载' : passed ? '达标' : `差 ${gap} 分`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {evaluation.gaps.length > 0 && (
                  <div className="rounded-lg border border-destructive/35 bg-destructive/10 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      待提升维度
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {evaluation.gaps.map((gap) => (
                        <Badge key={gap.dimension} variant="danger">
                          {DIMENSION_LABELS[gap.dimension] || gap.dimension}：差 {gap.gap} 分（{gap.current}/{gap.target}）
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <details className="rounded-lg border border-border/70">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium marker:text-muted-foreground">
                    查看各维度评估证据与规则命中情况（{evaluation.evidence.length}）
                  </summary>
                  <div className="space-y-3 border-t border-border p-4">
                    {evaluation.evidence.map((item, index) => (
                      <div key={`${item.dimension}-${index}`} className="rounded-lg bg-muted/35 p-3">
                        <div className="text-sm font-medium">
                          {DIMENSION_LABELS[item.dimension] || item.dimension}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
                        {item.rules.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.rules.map((rule, ruleIndex) => (
                              <Badge key={`${rule.rule}-${ruleIndex}`} variant={rule.hit ? 'danger' : 'success'}>
                                {rule.hit ? '命中' : '未命中'} · {rule.rule}{rule.note ? `：${rule.note}` : ''}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>

                {evaluation.summary && (
                  <div className="rounded-lg border border-border/70 bg-muted/25 p-4">
                    <div className="mb-1 text-sm font-medium">整体评价</div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{evaluation.summary}</p>
                  </div>
                )}
              </div>
            );
          })() : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <ClipboardCheck className="mx-auto h-7 w-7 text-muted-foreground" />
              <div className="mt-2 text-sm font-medium">尚未实测评估</div>
              <p className="mt-1 text-sm text-muted-foreground">
                选择真实仓库和 git 作者后，可根据代码贡献生成独立的能力实测结果。
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============ 成长曲线 + AI 建议 ============ */}
      <div className="mb-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>成长曲线</CardTitle>
            <CardDescription>综合评分 vs 团队均值，近 6 个季度</CardDescription>
          </CardHeader>
          <CardContent>
            <LineTrend
              data={detail.growthCurve}
              xKey="period"
              series={[
                { key: 'composite', name: '个人综合分', color: 'var(--chart-1)' },
                { key: 'teamAvg', name: '团队均值', color: 'var(--chart-2)', dashed: true },
              ]}
              height={220}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-accent/30 bg-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              AI 成长建议
            </CardTitle>
            <CardDescription>基于能力模型与行为数据的个性化建议</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground/90">{detail.aiSuggestion}</p>
          </CardContent>
        </Card>
      </div>

      {/* ============ 主导模块 + 协作伙伴 ============ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-4 w-4 text-primary" />
              主导模块
            </CardTitle>
            <CardDescription>按归属占比排序</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.modules.map((m) => (
              <div key={m.module} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{m.module}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{m.commits} commits</span>
                    <span style={{ color: scoreColor(m.complexity) }}>复杂度 {m.complexity}</span>
                  </div>
                </div>
                <ProgressBar
                  value={m.ownership}
                  indicatorClassName={m.ownership >= 70 ? 'bg-destructive' : m.ownership >= 50 ? 'bg-warning' : 'bg-primary'}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-4 w-4 text-primary" />
              协作网络
            </CardTitle>
            <CardDescription>共改文件 / 互评代码的协作关系图谱</CardDescription>
          </CardHeader>
          <CardContent>
            <CollaborationGraph
              center={{ name: detail.name, username: detail.username }}
              partners={detail.partners.map((p) => ({
                id: p.username,
                name: p.name,
                username: p.username,
                sharedCommits: p.sharedCommits,
                reviewCount: p.reviewCount,
              }))}
              developerIdMap={Object.fromEntries(
                developers.map((d) => [d.username, d.id])
              )}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
