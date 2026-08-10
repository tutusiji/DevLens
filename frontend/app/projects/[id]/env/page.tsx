/**
 * 项目环境配置盘点（Env Inventory）
 * 把散落在配置文件里的环境信息（数据库/Redis/Nacos/MQ...）自动盘点成清单，
 * 支持全量重建与按此历史更新（增量 diff），每个条目带来源文件、行号、更新时间、密码脱敏。
 */
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle, ArrowLeft, CheckCircle2, Cloud, Database, Eye, EyeOff,
  HardDrive, History, Loader2, Network, Plug, RefreshCw, Search, Server,
  Settings2, ShieldCheck, XCircle, Zap, Bot, FileSearch, Pencil, Plus, Save, Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/filter-bar';
import { PageHeader } from '@/components/widgets';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  EnvInventoryEntry, EnvInventoryScan, EnvInventorySummary,
  EnvInventorySkill, EnvInventorySkillPayload, EnvName, EnvToolType, EnvEntryStatus,
} from '@/lib/types';

// ============ 元数据映射 ============

const ENV_OPTIONS: { value: EnvName | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'prod', label: 'Prod' },
  { value: 'gray', label: 'Gray' },
  { value: 'test', label: 'Test' },
  { value: 'dev', label: 'Dev' },
  { value: 'common', label: '通用' },
];

const ENV_LABEL: Record<EnvName, string> = {
  dev: 'Dev', test: 'Test', prod: 'Prod', gray: 'Gray', common: '通用',
};

type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

const TOOL_META: Record<EnvToolType, { label: string; icon: IconType; color: string }> = {
  database: { label: '数据库', icon: Database, color: 'var(--chart-1)' },
  redis: { label: 'Redis', icon: HardDrive, color: 'var(--chart-2)' },
  nacos: { label: 'Nacos', icon: Server, color: 'var(--chart-3)' },
  mq: { label: '消息队列', icon: Network, color: 'var(--chart-4)' },
  kafka: { label: 'Kafka', icon: Network, color: 'var(--chart-4)' },
  es: { label: 'ES', icon: Search, color: 'var(--chart-5)' },
  oss: { label: '对象存储', icon: Cloud, color: 'var(--accent)' },
  gateway: { label: '网关', icon: Network, color: 'var(--primary)' },
  third_party: { label: '第三方', icon: Plug, color: 'var(--muted-foreground)' },
  other: { label: '其他', icon: Settings2, color: 'var(--muted-foreground)' },
};

const STATUS_META: Record<EnvEntryStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'secondary' }> = {
  active: { label: '正常', variant: 'success' },
  added: { label: '新增', variant: 'warning' },
  changed: { label: '变更', variant: 'danger' },
  removed: { label: '失效', variant: 'secondary' },
};

const SCAN_TYPE_META = {
  full: { label: '全量', variant: 'danger' as const },
  incremental: { label: '增量', variant: 'warning' as const },
};

// ============ 轻量 toast ============
function useToast() {
  const [msg, setMsg] = React.useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const show = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  };
  const node = msg ? (
    <div className={cn(
      'fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl',
      msg.type === 'success' && 'bg-success/15 text-success border border-success/30',
      msg.type === 'error' && 'bg-destructive/15 text-destructive border border-destructive/30',
      msg.type === 'info' && 'bg-muted text-foreground border border-border',
    )}>
      {msg.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
      {msg.type === 'error' && <XCircle className="h-4 w-4" />}
      {msg.type === 'info' && <AlertCircle className="h-4 w-4" />}
      {msg.text}
    </div>
  ) : null;
  return { show, node };
}

function formatTime(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const now = Date.now();
    const diff = (now - d.getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

// ============ 敏感值显示 ============
function SecretValue({ entry, revealed, onToggle }: { entry: EnvInventoryEntry; revealed: boolean; onToggle: () => void }) {
  if (!entry.isSecret) {
    return <span className="font-mono text-xs break-all">{entry.value || '—'}</span>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-xs break-all">{revealed ? entry.value : '••••••'}</span>
      <button onClick={onToggle} className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0" aria-label={revealed ? '隐藏' : '显示'}>
        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ============ 工具分组表格 ============
function ToolGroupTable({ entries, revealedSet, onToggleReveal }: { entries: EnvInventoryEntry[]; revealedSet: Set<string>; onToggleReveal: (id: string) => void }) {
  const toolType = entries[0]?.toolType ?? 'other';
  const meta = TOOL_META[toolType] ?? TOOL_META.other;
  const Icon = meta.icon;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4" style={{ color: meta.color }} />
          {meta.label}
          <span className="text-muted-foreground font-normal">{entries.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table className="min-w-[1240px]">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6 w-[240px] min-w-[200px]">配置键</TableHead>
              <TableHead className="w-[240px] min-w-[200px]">值</TableHead>
              <TableHead className="w-[130px]">地址</TableHead>
              <TableHead className="w-[90px]">账号</TableHead>
              <TableHead className="w-[110px]">库名</TableHead>
              <TableHead className="w-[200px]">来源文件</TableHead>
              <TableHead className="w-[80px]">状态</TableHead>
              <TableHead className="pr-6 text-right w-[110px]">更新时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id} className={e.status === 'removed' ? 'opacity-50' : ''}>
                <TableCell className="pl-6">
                  <div className="font-mono text-xs break-all leading-snug">{e.key}</div>
                  {e.toolName && <div className="mt-0.5 text-[10px] text-muted-foreground">{e.toolName}</div>}
                </TableCell>
                <TableCell>
                  <SecretValue entry={e} revealed={revealedSet.has(e.id)} onToggle={() => onToggleReveal(e.id)} />
                  {e.status === 'changed' && e.previousValue && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground line-through">{e.previousValue}</div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground break-all">
                  {e.host && <span>{e.host}{e.port ? `:${e.port}` : ''}</span>}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground break-all">
                  {e.username && <span>{e.username}</span>}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground break-all">
                  {e.database && <span>{e.database}</span>}
                </TableCell>
                <TableCell>
                  <div className="font-mono text-[11px] text-muted-foreground break-all leading-snug">{e.sourceFile}</div>
                  <div className="text-[10px] text-muted-foreground">:{e.sourceLine}</div>
                </TableCell>
                <TableCell><Badge variant={STATUS_META[e.status].variant}>{STATUS_META[e.status].label}</Badge></TableCell>
                <TableCell className="pr-6 text-right text-xs text-muted-foreground">{formatTime(e.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============ 扫描历史时间线 ============
function ScanTimeline({ scans }: { scans: EnvInventoryScan[] }) {
  if (!scans.length) return <EmptyState icon={History} title="还没有扫描记录" description="点击上方按钮发起首次环境配置扫描。" />;
  return (
    <div className="space-y-3">
      {scans.map((s) => {
        const tm = SCAN_TYPE_META[s.scanType];
        const isFail = s.status === 'failed';
        const isInc = s.scanType === 'incremental';
        return (
          <div key={s.id} className="flex gap-3 rounded-lg border border-border/60 p-3">
            <div className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              isFail ? 'bg-destructive/10' : isInc ? 'bg-warning/10' : 'bg-primary/10',
            )}>
              {isFail ? <XCircle className="h-4 w-4 text-destructive" /> : isInc ? <RefreshCw className="h-4 w-4 text-warning" /> : <Database className="h-4 w-4 text-primary" />}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={tm.variant}>{tm.label}扫描</Badge>
                <Badge variant={s.status === 'completed' ? 'success' : s.status === 'failed' ? 'danger' : 'secondary'}>
                  {s.status === 'completed' ? '完成' : s.status === 'failed' ? '失败' : '进行中'}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatTime(s.startedAt)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>扫描 <b className="font-mono text-foreground">{s.filesScanned}</b> 文件</span>
                <span>发现 <b className="font-mono text-foreground">{s.entriesFound}</b> 条目</span>
                {isInc && (
                  <>
                    <span className="text-success">新增 {s.added}</span>
                    <span className="text-destructive">变更 {s.changed}</span>
                    <span className="text-muted-foreground">失效 {s.removed}</span>
                    <span className="text-muted-foreground">无变化 {s.unchanged}</span>
                  </>
                )}
              </div>
              {s.message && <p className="text-xs text-muted-foreground">{s.message}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ 二次确认弹窗 ============
function ConfirmDialog({ open, title, description, onConfirm, onCancel, loading }: {
  open: boolean; title: string; description: string;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>取消</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            确认重建
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ 环境盘点 Skill 编辑器 ============
const EMPTY_ENV_SKILL: EnvInventorySkillPayload = {
  name: '',
  description: '',
  filePatterns: [],
  keywords: [],
  toolTypes: [],
  aiInstruction: '',
  enabled: 1,
};

function splitRuleValues(value: string): string[] {
  return value.split(/[\n,，]/).map((item) => item.trim()).filter(Boolean);
}

function joinRuleValues(values: string[]): string {
  return (values || []).join('\n');
}

function toEnvSkillPayload(skill?: EnvInventorySkill | null): EnvInventorySkillPayload {
  if (!skill) return { ...EMPTY_ENV_SKILL, filePatterns: [], keywords: [], toolTypes: [] };
  return {
    name: skill.name,
    description: skill.description,
    filePatterns: skill.filePatterns,
    keywords: skill.keywords,
    toolTypes: skill.toolTypes,
    aiInstruction: skill.aiInstruction,
    enabled: skill.enabled,
  };
}

function EnvInventorySkillSheet({
  open, skills, onClose, onSave, onDelete,
}: {
  open: boolean;
  skills: EnvInventorySkill[];
  onClose: () => void;
  onSave: (skill: EnvInventorySkill | null, payload: EnvInventorySkillPayload) => Promise<void>;
  onDelete: (skill: EnvInventorySkill) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = React.useState<string | 'new'>('new');
  const selected = selectedId === 'new' ? null : skills.find((skill) => skill.id === selectedId) ?? null;
  const [form, setForm] = React.useState<EnvInventorySkillPayload>(EMPTY_ENV_SKILL);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const initial = selectedId === 'new' ? skills[0] ?? null : skills.find((skill) => skill.id === selectedId) ?? null;
    if (initial) setSelectedId(initial.id);
    setForm(toEnvSkillPayload(initial));
    // 只在打开时用首条默认规则初始化，避免列表刷新打断正在编辑的表单。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (skill: EnvInventorySkill | null) => {
    setSelectedId(skill?.id ?? 'new');
    setForm(toEnvSkillPayload(skill));
  };
  const toggleToolType = (toolType: EnvToolType) => {
    setForm((current) => ({
      ...current,
      toolTypes: current.toolTypes.includes(toolType)
        ? current.toolTypes.filter((item) => item !== toolType)
        : [...current.toolTypes, toolType],
    }));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(selected, form);
      if (!selected) choose(skills[0] ?? null);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!selected || selected.builtIn) return;
    setConfirmDelete(true);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="环境盘点 Skills"
      description="规则即资产：用文件模式、关键词和 AI 提取边界控制后续扫描范围；每次扫描都会冻结当前规则快照。"
      width="lg"
      className="max-w-5xl"
    >
      <div className="grid min-h-[560px] gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-muted/15 p-2">
          <Button variant="outline" size="sm" className="mb-2 w-full justify-start" onClick={() => choose(null)}>
            <Plus className="h-4 w-4" />新建 Skill
          </Button>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {skills.map((skill) => {
              const active = selected?.id === skill.id;
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => choose(skill)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                    active ? 'bg-primary/12 text-foreground ring-1 ring-primary/30' : 'text-foreground hover:bg-muted/70',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{skill.name}</span>
                    {skill.builtIn ? <Badge variant="secondary" className="shrink-0 text-[10px]">默认</Badge> : null}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={skill.enabled ? 'text-success' : 'text-muted-foreground'}>{skill.enabled ? '已启用' : '已停用'}</span>
                    <span>·</span><span>{skill.filePatterns.length} 个模式</span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="border-t border-border px-2 pt-3 text-xs leading-5 text-muted-foreground">
            默认规则可编辑或停用；自定义规则可删除。原始配置不会发送给模型，敏感值始终脱敏。
          </p>
        </aside>

        <form onSubmit={submit} className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">{selected ? `编辑 · ${selected.name}` : '新建环境盘点 Skill'}</h3>
              <p className="mt-1 text-sm text-muted-foreground">配置扫描范围与 AI 提取边界。提交后，下一次扫描才会使用新的规则。</p>
            </div>
            <button
              type="button"
              onClick={() => setForm((current) => ({ ...current, enabled: current.enabled ? 0 : 1 }))}
              className={cn(
                'inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                form.enabled ? 'border-success/35 bg-success/10 text-success' : 'border-border bg-muted/30 text-foreground',
              )}
              aria-pressed={Boolean(form.enabled)}
            >
              {form.enabled ? '已启用' : '已停用'}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Skill 名称 <span className="text-destructive">*</span></label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：部署与入口拓扑" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">展示说明</label>
              <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="说明这条规则解决什么问题" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground"><FileSearch className="h-4 w-4 text-primary" />文件模式 <span className="text-destructive">*</span></label>
            <textarea
              value={joinRuleValues(form.filePatterns)}
              onChange={(event) => setForm({ ...form, filePatterns: splitRuleValues(event.target.value) })}
              rows={4}
              placeholder={'一行一个，例如：\napplication*.yml\nconfig/*.yaml\ndocker-compose*.yml'}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">支持单层通配符 <code className="font-mono text-foreground">*</code>；路径相对于仓库根目录。</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">关键词补充匹配</label>
              <textarea
                value={joinRuleValues(form.keywords)}
                onChange={(event) => setForm({ ...form, keywords: splitRuleValues(event.target.value) })}
                rows={4}
                placeholder={'一行一个，例如：\nredis\njdbc\nproxy_pass'}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">用于从未明确命名的文本配置文件中补充发现候选文件。</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">重点资产类型</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TOOL_META) as EnvToolType[]).map((toolType) => {
                  const checked = form.toolTypes.includes(toolType);
                  return (
                    <button
                      key={toolType}
                      type="button"
                      onClick={() => toggleToolType(toolType)}
                      className={cn(
                        'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                        checked ? 'border-primary/40 bg-primary/12 text-primary' : 'border-border bg-background text-foreground hover:bg-muted/60',
                      )}
                      aria-pressed={checked}
                    >
                      {TOOL_META[toolType].label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">为 AI 提取结果提供分类重点；静态扫描始终对敏感字段脱敏。</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground"><Bot className="h-4 w-4 text-primary" />AI 提取指令</label>
            <textarea
              value={form.aiInstruction}
              onChange={(event) => setForm({ ...form, aiInstruction: event.target.value })}
              rows={5}
              placeholder="告诉 AI 应识别的资产、应输出的元数据与敏感信息边界。"
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs leading-5 text-muted-foreground">该指令随扫描快照固化，供后续基于脱敏摘要的 AI 架构解释使用；不会将密码、Token 或 Secret 明文发送给模型。</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <div>
              {selected && !selected.builtIn ? (
                <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={deleting || saving}>
                  <Trash2 className="h-4 w-4" />{deleting ? '删除中…' : '删除'}
                </Button>
              ) : selected?.builtIn ? <span className="text-xs text-muted-foreground">默认 Skill 可编辑、可停用，但不可删除。</span> : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>关闭</Button>
              <Button type="submit" variant="default" disabled={saving || !form.name.trim() || !form.filePatterns.length}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {selected ? '保存规则' : '创建规则'}
              </Button>
            </div>
          </div>
        </form>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="删除环境盘点规则"
        description={`删除后「${selected?.name ?? ''}」将不再用于后续扫描。确定删除吗？`}
        loading={deleting}
        onConfirm={async () => {
          if (!selected) return;
          setDeleting(true);
          try {
            await onDelete(selected);
            setConfirmDelete(false);
            choose(null);
          } finally {
            setDeleting(false);
          }
        }}
        onCancel={() => { if (!deleting) setConfirmDelete(false); }}
      />
    </Sheet>
  );
}

// ============ 主页面 ============
export default function EnvInventoryPage() {
  const params = useParams();
  const router = useRouter();
  const pid = params.id as string;
  const { show, node } = useToast();

  const [summary, setSummary] = React.useState<EnvInventorySummary | null>(null);
  const [entries, setEntries] = React.useState<EnvInventoryEntry[]>([]);
  const [scans, setScans] = React.useState<EnvInventoryScan[]>([]);
  const [projectName, setProjectName] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [scanning, setScanning] = React.useState<null | 'full' | 'incremental'>(null);
  const [envFilter, setEnvFilter] = React.useState<EnvName | 'all'>('all');
  const [toolFilter, setToolFilter] = React.useState<EnvToolType | null>(null);
  const [query, setQuery] = React.useState('');
  const [revealed, setRevealed] = React.useState<Set<string>>(new Set());
  const [confirmFull, setConfirmFull] = React.useState(false);
  const [skills, setSkills] = React.useState<EnvInventorySkill[]>([]);
  const [skillSheetOpen, setSkillSheetOpen] = React.useState(false);

  const reload = React.useCallback(async () => {
    const [s, e, sc] = await Promise.all([
      api.getEnvInventorySummary(pid),
      api.getEnvInventory(pid),
      api.getEnvInventoryScans(pid),
    ]);
    setSummary(s); setEntries(e); setScans(sc);
  }, [pid]);

  React.useEffect(() => {
    Promise.all([
      reload(),
      api.getEnvInventorySkills().then(setSkills),
      api.getProjectDetail(pid).then((p) => setProjectName(p?.name || '')),
    ])
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [reload, pid]);

  const toggleReveal = (id: string) => {
    setRevealed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const doScan = async (scanType: 'full' | 'incremental') => {
    setScanning(scanType);
    try {
      const enabledSkillIds = skills.filter((skill) => skill.enabled).map((skill) => skill.id);
      if (!enabledSkillIds.length) {
        show('请先在「盘点 Skills」中启用至少一条规则', 'error');
        return;
      }
      const scan = await api.scanEnvInventory(pid, scanType, enabledSkillIds);
      await reload();
      if (scan.status === 'failed') {
        show(`扫描失败：${scan.message || '未知错误'}`, 'error');
      } else if (scanType === 'incremental') {
        show(`增量扫描完成：新增 ${scan.added} / 变更 ${scan.changed} / 失效 ${scan.removed}`, 'success');
      } else {
        show(`全量扫描完成：扫描 ${scan.filesScanned} 文件，发现 ${scan.entriesFound} 条目`, 'success');
      }
    } catch (err) {
      show('扫描请求失败', 'error');
    } finally {
      setScanning(null);
    }
  };

  const saveSkill = async (skill: EnvInventorySkill | null, payload: EnvInventorySkillPayload) => {
    try {
      const saved = skill
        ? await api.updateEnvInventorySkill(skill.id, payload)
        : await api.createEnvInventorySkill(payload);
      setSkills((current) => skill
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved]);
      show(skill ? '环境盘点 Skill 已保存' : '环境盘点 Skill 已创建', 'success');
    } catch (error) {
      show(error instanceof Error ? error.message : '保存 Skill 失败', 'error');
      throw error;
    }
  };

  const deleteSkill = async (skill: EnvInventorySkill) => {
    try {
      await api.deleteEnvInventorySkill(skill.id);
      setSkills((current) => current.filter((item) => item.id !== skill.id));
      show('环境盘点 Skill 已删除', 'success');
    } catch (error) {
      show(error instanceof Error ? error.message : '删除 Skill 失败', 'error');
      throw error;
    }
  };

  // 过滤 + 分组（按 toolType）
  const filtered = React.useMemo(() => {
    const ql = query.toLowerCase().trim();
    return entries.filter((e) => {
      if (envFilter !== 'all' && e.env !== envFilter) return false;
      if (toolFilter && e.toolType !== toolFilter) return false;
      if (ql && ![e.key, e.value, e.sourceFile, e.toolName].join(' ').toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [entries, envFilter, toolFilter, query]);

  const groups = React.useMemo(() => {
    const map = new Map<EnvToolType, EnvInventoryEntry[]>();
    for (const e of filtered) {
      if (!map.has(e.toolType)) map.set(e.toolType, []);
      map.get(e.toolType)!.push(e);
    }
    // 排序：非 other 优先，再按 toolType 字母序；组内按 sourceFile -> key
    return [...map.entries()]
      .sort((a, b) => {
        if (a[0] === 'other' && b[0] !== 'other') return 1;
        if (b[0] === 'other' && a[0] !== 'other') return -1;
        return a[0].localeCompare(b[0]);
      })
      .map(([t, list]) => [t, list.sort((x, y) => (x.sourceFile + x.key).localeCompare(y.sourceFile + y.key))] as const);
  }, [filtered]);

  const toolCounts = summary?.byToolType ?? ({} as Record<EnvToolType, number>);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton rounded" />
        <div className="grid gap-4 lg:grid-cols-4"><div className="h-28 skeleton rounded-xl" /><div className="h-28 skeleton rounded-xl" /><div className="h-28 skeleton rounded-xl" /><div className="h-28 skeleton rounded-xl" /></div>
        <div className="h-96 skeleton rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/projects/${pid}`)}>
          <ArrowLeft className="h-4 w-4" />返回项目详情
        </Button>
      </div>

      <PageHeader
        title={`环境配置盘点${projectName ? ` · ${projectName}` : ''}`}
        description="自动盘点项目配置文件中的基础设施依赖（数据库 / Redis / Nacos / MQ …），每个条目带来源文件、行号与更新时间，敏感字段已脱敏。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSkillSheetOpen(true)}>
              <Pencil className="h-4 w-4" />盘点 Skills
            </Button>
            <Button variant="outline" size="sm" onClick={() => doScan('incremental')} disabled={!!scanning}>
              {scanning === 'incremental' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              按此历史更新
            </Button>
            <Button variant="default" size="sm" onClick={() => setConfirmFull(true)} disabled={!!scanning}>
              {scanning === 'full' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              全量再次更新
            </Button>
          </div>
        }
      />

      <Card className="mb-4 border-primary/20 bg-primary/[0.04]">
        <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Zap className="h-4 w-4 text-primary" />
            本次扫描将使用
          </div>
          <div className="flex flex-wrap gap-1.5">
            {skills.filter((skill) => skill.enabled).map((skill) => (
              <Badge key={skill.id} variant="secondary">{skill.name}</Badge>
            ))}
            {!skills.some((skill) => skill.enabled) && <span className="text-sm font-medium text-destructive">暂无启用规则，请先配置盘点 Skills</span>}
          </div>
          <span className="text-xs text-muted-foreground">规则会随扫描记录固化，确保结果可解释、可追溯。</span>
        </CardContent>
      </Card>

      {/* 概览卡片：按 toolType 计数（点击过滤）+ 最近扫描 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <ShieldCheck className="h-3 w-3" />共 {summary?.total ?? 0} 条
        </Badge>
        {(Object.keys(TOOL_META) as EnvToolType[]).map((t) => {
          const count = toolCounts[t] ?? 0;
          if (count === 0) return null;
          const meta = TOOL_META[t];
          const Icon = meta.icon;
          const active = toolFilter === t;
          return (
            <button key={t} onClick={() => setToolFilter(active ? null : t)} className="cursor-pointer">
              <Badge variant={active ? 'default' : 'secondary'} className="gap-1">
                <Icon className="h-3 w-3" style={{ color: active ? undefined : meta.color }} />
                {meta.label} {count}
              </Badge>
            </button>
          );
        })}
        {toolFilter && (
          <Button size="sm" variant="ghost" onClick={() => setToolFilter(null)}>清除筛选</Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          最近扫描：{summary?.lastScanAt ? `${SCAN_TYPE_META[summary.lastScanType ?? 'full'].label} · ${formatTime(summary.lastScanAt)}` : '尚未扫描'}
        </span>
      </div>

      {/* 环境 Segmented + 搜索 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={envFilter} onChange={(v) => setEnvFilter(v as EnvName | 'all')} options={ENV_OPTIONS} />
        <div className="relative ml-auto min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索 key / 值 / 文件..."
            className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* 环境统计条 */}
      {envFilter === 'all' && summary && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
          环境分布：
          {(['prod', 'gray', 'test', 'dev', 'common'] as EnvName[]).map((e) => (
            <span key={e}>{ENV_LABEL[e]} <b className="font-mono text-foreground">{summary.byEnv[e] ?? 0}</b></span>
          ))}
        </div>
      )}

      {/* 条目表格（按 toolType 分组） */}
      {!filtered.length ? (
        <EmptyState
          icon={Database}
          title="没有匹配的配置条目"
          description={entries.length ? '调整筛选条件，或发起一次全量扫描。' : '该项目尚未扫描配置文件，点击「全量再次更新」发起首次扫描。'}
          action={!entries.length ? <Button onClick={() => setConfirmFull(true)}><Database className="h-4 w-4" />发起全量扫描</Button> : undefined}
        />
      ) : (
        <div className="space-y-4">
          {groups.map(([t, list]) => (
            <ToolGroupTable key={t} entries={list} revealedSet={revealed} onToggleReveal={toggleReveal} />
          ))}
        </div>
      )}

      {/* 扫描历史 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-4 w-4 text-primary" />扫描历史</CardTitle>
          <CardDescription>每次扫描记录文件数、条目数与增量变化统计</CardDescription>
        </CardHeader>
        <CardContent>
          <ScanTimeline scans={scans} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmFull}
        title="全量再次更新"
        description="将删除现有全部配置条目并重新扫描仓库，确定要重建吗？"
        loading={scanning === 'full'}
        onCancel={() => setConfirmFull(false)}
        onConfirm={() => { setConfirmFull(false); doScan('full'); }}
      />
      <EnvInventorySkillSheet
        open={skillSheetOpen}
        skills={skills}
        onClose={() => setSkillSheetOpen(false)}
        onSave={saveSkill}
        onDelete={deleteSkill}
      />
      {node}
    </>
  );
}
