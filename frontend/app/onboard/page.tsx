/**
 * ⑤ 接入项目
 * 5 步流程指示器 + 表单 + 身份匹配预览 + 分析进度
 */
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Loader2, GitBranch, UserCheck, ScanSearch, FileSearch, BarChart3, Globe, FolderOpen } from 'lucide-react';
import type { ProjectCreateRequest, RepositoryProvider, RepositoryImportResult } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageHeader } from '@/components/widgets';
import { EmptyState } from '@/components/filter-bar';
import { useTeamSpace } from '@/components/team-space-provider';
import { api } from '@/lib/api';
import type { IdentityMatch, SkillGroup } from '@/lib/types';

const STEPS = [
  { id: 1, label: '填写信息', icon: FileSearch },
  { id: 2, label: 'Git 采集', icon: GitBranch },
  { id: 3, label: '身份匹配', icon: UserCheck },
  { id: 4, label: '代码解析', icon: ScanSearch },
  { id: 5, label: '生成报告', icon: BarChart3 },
];

const METHOD_LABEL: Record<string, string> = {
  email: '邮箱精确',
  employee_id: '工号',
  pinyin: '拼音',
  fuzzy: '模糊匹配',
};

function detectProvider(value: string): RepositoryProvider | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('github.com')) return 'github';
  if (normalized.includes('gitlab')) return 'gitlab';
  if (normalized.includes('gitea')) return 'gitea';
  if (normalized.includes('bitbucket')) return 'bitbucket';
  return normalized ? 'generic' : undefined;
}

function validateRepository(value: string, type: 'remote' | 'local'): string | null {
  if (!value.trim()) return type === 'remote' ? '请输入 Git 仓库地址' : '请输入本地仓库路径';
  if (type === 'local') return value.includes('..') ? '本地路径不能包含 ..' : null;
  const remote = value.trim();
  if (/^javascript:|^file:/i.test(remote)) return '仓库地址协议不安全';
  if (/^git@[^:]+:.+/.test(remote)) return null;
  try {
    const url = new URL(remote);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return '请输入 HTTPS 或 SSH Git 地址';
    if (!url.pathname || url.pathname === '/') return '仓库地址缺少项目路径';
    return null;
  } catch {
    return '请输入合法的 Git 仓库地址，例如 https://github.com/org/repo.git';
  }
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-between">
      {STEPS.map((step, i) => {
        const isDone = step.id < current;
        const isActive = step.id === current;
        const Icon = step.icon;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                  isDone
                    ? 'border-success bg-success text-white'
                    : isActive
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {isDone ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span className={['text-xs', isActive ? 'font-medium text-foreground' : 'text-muted-foreground'].join(' ')}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={['h-0.5 flex-1 mx-2 transition-colors', isDone ? 'bg-success' : 'bg-border'].join(' ')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [progress, setProgress] = React.useState(0);
  const [matches, setMatches] = React.useState<IdentityMatch[]>([]);
  const [importResult, setImportResult] = React.useState<RepositoryImportResult | null>(null);
  const [submitError, setSubmitError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [skillGroups, setSkillGroups] = React.useState<SkillGroup[]>([]);
  const { spaces, largeTeams, activeLargeTeamId, activeTeamSpaceId } = useTeamSpace();
  const [form, setForm] = React.useState(() => ({
    name: '',
    repoPath: '',
    repoType: 'remote' as 'remote' | 'local',
    accessToken: '',
    branch: 'main',
    largeTeamId: activeLargeTeamId || '',
    teamId: activeTeamSpaceId || '',
    skillGroupId: '',
  }));

  // 加载可用的 Skill Group（评估规则编组）
  React.useEffect(() => {
    api.getSkillGroups()
      .then((groups) => {
        const enabled = groups.filter((g) => g.enabled === 1 && g.analysisType === 'repo_analysis');
        setSkillGroups(enabled);
        setForm((current) => ({
          ...current,
          skillGroupId: current.skillGroupId || enabled[0]?.id || '',
        }));
      })
      .catch(() => { /* 后端不可用时保持空选择 */ });
  }, []);

  // 顶部切换大团队时，自动选中该大团队下的第一个团队空间
  React.useEffect(() => {
    setForm((current) => {
      if (current.largeTeamId === activeLargeTeamId && current.teamId === activeTeamSpaceId) return current;
      const teamInLarge = activeLargeTeamId ? spaces.find((space) => space.largeTeamId === activeLargeTeamId && space.status === 'active') : undefined;
      return { ...current, largeTeamId: activeLargeTeamId || current.largeTeamId, teamId: activeLargeTeamId ? (teamInLarge?.id || '') : current.teamId };
    });
  }, [activeLargeTeamId, activeTeamSpaceId, spaces]);

  const availableSpaces = spaces.filter((space) => space.status === 'active' && (!form.largeTeamId || space.largeTeamId === form.largeTeamId));

  // 通过分析运行状态轮询进度
  React.useEffect(() => {
    if (step !== 2 || !importResult?.runId) return;
    let cancelled = false;
    const poll = async () => {
      const run = await api.getAnalysisStatus(importResult.runId);
      if (cancelled) return;
      setProgress(run.progress);
      if (run.status === 'completed') {
        setStep(5);
      }
    };
    poll();
    const timer = window.setInterval(poll, 700);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [step, importResult?.runId]);

  // 进入身份匹配步骤时加载预览数据
  React.useEffect(() => {
    if (step === 3 && matches.length === 0) {
      api.getIdentityMatches().then(setMatches);
    }
  }, [step, matches.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    const repositoryError = validateRepository(form.repoPath, form.repoType);
    if (repositoryError) {
      setSubmitError(repositoryError);
      return;
    }
    if (!form.branch.trim() || /[\\s\\0]/.test(form.branch) || form.branch.includes('..')) {
      setSubmitError('分支名不能包含空白、控制字符或 ..');
      return;
    }
    if (!form.teamId) {
      setSubmitError('请选择所属团队空间');
      return;
    }
    setSubmitting(true);
    try {
      const request: ProjectCreateRequest = {
        name: form.name,
        repoType: form.repoType,
        repoUrl: form.repoType === 'remote' ? form.repoPath.trim() : undefined,
        repoPath: form.repoType === 'local' ? form.repoPath.trim() : undefined,
        provider: form.repoType === 'remote' ? detectProvider(form.repoPath) : undefined,
        branch: form.branch.trim(),
        teamId: form.teamId,
        skillGroupId: form.skillGroupId || undefined,
        accessToken: form.repoType === 'remote' ? form.accessToken || undefined : undefined,
      };
      const result = await api.createProject(request);
      setImportResult(result);
      setProgress(8);
      setStep(2);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '项目导入失败，请检查仓库地址和凭证');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <>
      <PageHeader
        title="接入项目"
        description="输入 Git 仓库在线地址或本地路径，自动完成采集、解析、能力建模与报告生成"
      />

      <Card>
        <CardHeader>
          <CardTitle>接入流程</CardTitle>
          <CardDescription>5 步完成项目接入，全程自动化</CardDescription>
        </CardHeader>
        <CardContent>
          <StepIndicator current={step} />

          {/* 步骤 1: 表单 */}
          {step === 1 && (spaces.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon={UserCheck}
                title="请先创建团队空间"
                description="项目、人员和小组都必须先归属团队空间，才能开始仓库接入与后续分析。"
                action={<Button variant="accent" onClick={() => router.push('/team-spaces')}>前往创建团队空间</Button>}
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="text-sm font-medium">组织归属</div>
                <p className="mt-1 text-xs text-muted-foreground">先确定项目所属大团队，再选择该大团队下的具体团队空间。</p>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="largeTeamId" className="text-sm font-medium">所属大团队 <span className="text-destructive">*</span></label>
                    <select id="largeTeamId" required value={form.largeTeamId} onChange={(e) => {
                      const largeId = e.target.value;
                      const firstSpace = spaces.find((space) => space.largeTeamId === largeId && space.status === 'active');
                      setForm({ ...form, largeTeamId: largeId, teamId: firstSpace?.id || '' });
                    }} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="">请选择大团队</option>
                      {largeTeams.map((lt) => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="teamId" className="text-sm font-medium">所属团队空间 <span className="text-destructive">*</span></label>
                    <select id="teamId" required value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })} disabled={!form.largeTeamId} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="">请选择团队空间</option>
                      {availableSpaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-medium">
                  项目名称 <span className="text-destructive">*</span>
                </label>
                <Input
                  id="name"
                  required
                  placeholder="如：用户中心"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setForm({ ...form, repoPath: '', repoType: 'remote' })} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${form.repoType !== 'local' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}><Globe className="h-3.5 w-3.5" />在线仓库</button>
                  <button type="button" onClick={() => setForm({ ...form, repoPath: '', repoType: 'local' })} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${form.repoType === 'local' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}><FolderOpen className="h-3.5 w-3.5" />本地路径</button>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="repoPath" className="text-sm font-medium">
                    {form.repoType === 'local' ? '仓库路径' : 'Git 仓库地址'} <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="repoPath"
                    required
                    placeholder={form.repoType === 'local' ? '/home/user/projects/my-repo' : 'https://github.com/org/repo.git'}
                    className="font-mono"
                    value={form.repoPath}
                    onChange={(e) => { setSubmitError(''); setForm({ ...form, repoPath: e.target.value }); }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {form.repoType === 'local'
                      ? '本地 Git 仓库的绝对路径，需已 git init'
                      : `支持 GitHub / GitLab / Gitea 等平台的 HTTPS 或 SSH 地址${detectProvider(form.repoPath) ? ` · 已识别 ${detectProvider(form.repoPath)}` : ''}，如需鉴权请在下方填写 Token`}
                  </p>
                </div>
                {form.repoType !== 'local' && (
                  <div className="space-y-1.5">
                    <label htmlFor="accessToken" className="text-sm font-medium">访问 Token <span className="text-muted-foreground">（私有仓库必填）</span></label>
                    <Input
                      id="accessToken"
                      type="password"
                      placeholder="ghp_**** 或 glpat-****"
                      className="font-mono"
                      value={form.accessToken}
                      onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">用于克隆私有仓库，仅本次接入使用，不会持久化存储。</p>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="skillGroupId" className="text-sm font-medium">
                  评估规则组 <span className="text-muted-foreground">（Skill Group）</span>
                </label>
                <select
                  id="skillGroupId"
                  value={form.skillGroupId}
                  onChange={(e) => setForm({ ...form, skillGroupId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">默认（内置 Security + Quality）</option>
                  {skillGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}（{g.skillIds.length} 条规则）</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  选择本次分析使用的规则编组；规则可在「Skill 管理」页配置，评估时逐条注入审查。
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="branch" className="text-sm font-medium">
                  默认分支
                </label>
                <Input
                  id="branch"
                  placeholder="main"
                  className="font-mono"
                  value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value })}
                />
              </div>
              {submitError && <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{submitError}</span></div>}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => router.push('/projects')}>
                  取消
                </Button>
                <Button type="submit" variant="accent" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? '提交中...' : '开始导入并分析'}
                </Button>
              </div>
            </form>
          ))}

          {/* 步骤 2-4: 进度 */}
          {step >= 2 && step < 5 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="font-medium">{STEPS[step - 1].label}中...</span>
                  {importResult?.provider && <Badge variant="outline">{importResult.provider}</Badge>}
                </div>
                <Progress value={progress} />
                {importResult && <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="font-mono">{importResult.repository}</span><span>·</span><span>分支 {importResult.branch}</span><span>·</span><span>任务 {importResult.runId}</span></div>}
              <p className="text-xs text-muted-foreground">
                {step === 2 && (form.repoType === 'local' ? '正在解析本地 git log / blame，提取 commit 历史与文件归属' : '正在克隆远程仓库并解析 git log / blame，提取 commit 历史与文件归属')}
                {step === 3 && '正在将 Git author 匹配到组织人员，4 级匹配策略'}
                {step === 4 && '正在用 tree-sitter 解析 AST，构建代码图谱并 embedding 入库'}
              </p>

              {/* 步骤 3: 身份匹配预览 */}
              {step === 3 && matches.length > 0 && (
                <div className="rounded-lg border border-border">
                  <div className="border-b border-border bg-muted/30 px-3 py-2 text-xs font-medium">
                    身份匹配预览（{matches.length} 个 Git 身份）
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Git 用户名</TableHead>
                        <TableHead>邮箱</TableHead>
                        <TableHead>匹配人员</TableHead>
                        <TableHead>原部门</TableHead>
                        <TableHead>归属团队</TableHead>
                        <TableHead className="text-right">置信度</TableHead>
                        <TableHead>方法</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matches.map((m, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{m.gitName}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{m.gitEmail}</TableCell>
                          <TableCell className={m.personName === '-' ? 'text-muted-foreground' : ''}>{m.personName}</TableCell>
                          <TableCell className="text-muted-foreground">{m.department}</TableCell>
                          <TableCell className="text-muted-foreground">{spaces.find((space) => space.id === form.teamId)?.name || '未选择团队'}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {m.confidence > 0 ? (
                              <span style={{ color: m.confidence >= 0.85 ? 'var(--success)' : m.confidence >= 0.7 ? 'var(--warning)' : 'var(--destructive)' }}>
                                {(m.confidence * 100).toFixed(0)}%
                              </span>
                            ) : (
                              <Badge variant="outline">Bot</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{METHOD_LABEL[m.method]}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* 步骤 5: 完成 */}
          {step === 5 && (
            <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
                <Check className="h-8 w-8 text-success" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">分析完成</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                项目「{form.name}」已完成仓库导入与初始分析，可查看报告
              </p>
              {importResult && <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">{importResult.sourceType === 'remote' ? `远程 · ${importResult.provider || 'generic'}` : '本地仓库'}</Badge><Badge variant="outline">{importResult.repository}</Badge><Badge variant="outline">团队 {spaces.find((space) => space.id === form.teamId)?.name || '未选择'}</Badge></div>}
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => router.push('/')}>
                  返回总览
                </Button>
                <Button variant="accent" onClick={() => router.push('/projects')}>
                  查看项目
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
