/**
 * Skill 管理页
 * 三 tab：编组管理 / 规则库 / 规范来源
 * 把「评估规则」从代码中解放出来，变成可管理的资产：
 * 规范文档 -> AI 抽取 -> 规则库 -> 编组 -> 注入 LLM 分析
 */
'use client';

import * as React from 'react';
import {
  BookOpenCheck, Plus, Sparkles, Trash2, Pencil, Layers, FileText,
  CheckCircle2, XCircle, AlertCircle, ShieldCheck, GripVertical, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/widgets';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  SkillSource, Skill, SkillGroup, SkillCategory, SkillSeverity,
  SkillSourceCreateRequest, SkillCreateRequest, SkillGroupCreateRequest, ExtractResult,
  SkillGroupAnalysisType,
} from '@/lib/types';

type Tab = 'groups' | 'skills' | 'sources';

const TABS: { value: Tab; label: string }[] = [
  { value: 'groups', label: '编组管理' },
  { value: 'skills', label: '规则库' },
  { value: 'sources', label: '规范来源' },
];

/** Skill 驱动架构：分析模块 → 编组类型 中文名 */
const ANALYSIS_TYPE_LABEL: Record<string, string> = {
  repo_analysis: '仓库分析',
  developer_review: '开发者评估',
  team_aggregation: '团队聚合',
  skills_matrix: '技能矩阵',
  iceberg: '冰山模型',
  swot: 'SWOT 分析',
  hiring_advice: '招聘建议',
  growth_advice: '成长建议',
  career_path: '晋升路径',
  env_scan: '环境盘点',
};

const CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: 'quality', label: '质量' }, { value: 'security', label: '安全' },
  { value: 'performance', label: '性能' }, { value: 'architecture', label: '架构' },
  { value: 'maintainability', label: '可维护性' }, { value: 'reliability', label: '可靠性' },
  { value: 'logic', label: '逻辑' }, { value: 'complexity', label: '复杂度' },
  { value: 'configuration', label: '配置' }, { value: 'dependency', label: '依赖' },
  { value: 'testing', label: '测试' }, { value: 'delivery', label: '交付' },
];
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

const SEVERITIES: { value: SkillSeverity; label: string; variant: 'danger' | 'warning' | 'accent' | 'secondary' | 'default' }[] = [
  { value: 'critical', label: '严重', variant: 'danger' },
  { value: 'high', label: '高', variant: 'warning' },
  { value: 'medium', label: '中', variant: 'accent' },
  { value: 'low', label: '低', variant: 'secondary' },
  { value: 'info', label: '信息', variant: 'default' },
];
const SEVERITY_META: Record<string, { label: string; variant: 'danger' | 'warning' | 'accent' | 'secondary' | 'default' }> =
  Object.fromEntries(SEVERITIES.map((s) => [s.value, { label: s.label, variant: s.variant }]));

const LANGS = [
  { value: 'all', label: '通用' }, { value: 'java', label: 'Java' },
  { value: 'frontend', label: '前端' }, { value: 'go', label: 'Go' }, { value: 'python', label: 'Python' },
];

// ============ 轻量 toast ============
function useToast() {
  const [msg, setMsg] = React.useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const show = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
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

// ============ 启停开关 ============
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer',
        on ? 'bg-success' : 'bg-muted-foreground/30',
      )}
      aria-label={on ? '启用' : '停用'}
      role="switch"
      aria-checked={on}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
          on ? 'left-[18px]' : 'left-[2px]',
        )}
      />
    </button>
  );
}

export default function SkillsPage() {
  const [tab, setTab] = React.useState<Tab>('groups');
  const { show, node } = useToast();

  const [groups, setGroups] = React.useState<SkillGroup[]>([]);
  const [skills, setSkills] = React.useState<Skill[]>([]);
  const [sources, setSources] = React.useState<SkillSource[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reloadAll = React.useCallback(async () => {
    const [g, s, src] = await Promise.all([api.getSkillGroups(), api.getSkills(), api.getSkillSources()]);
    setGroups(g); setSkills(s); setSources(src);
  }, []);

  React.useEffect(() => {
    reloadAll().catch(() => undefined).finally(() => setLoading(false));
  }, [reloadAll]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton rounded" />
        <div className="h-96 skeleton rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Skill 管理"
        description="把评估规则从代码中解放出来：规范文档 → AI 抽取 → 规则库 → 编组 → 注入 LLM 分析"
        actions={<Badge variant="outline"><BookOpenCheck className="h-3 w-3" />{groups.filter((g) => g.enabled).length} 个启用编组</Badge>}
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <Segmented value={tab} onChange={(v) => setTab(v as Tab)} options={TABS} />
            <span className="ml-auto text-xs text-muted-foreground">
              {groups.length} 编组 · {skills.length} 规则 · {sources.length} 来源
            </span>
          </div>
        </CardContent>
      </Card>

      {tab === 'groups' && <GroupsTab groups={groups} skills={skills} reload={reloadAll} show={show} />}
      {tab === 'skills' && <SkillsTab skills={skills} sources={sources} reload={reloadAll} show={show} />}
      {tab === 'sources' && <SourcesTab sources={sources} skills={skills} reload={reloadAll} show={show} />}

      {node}
    </>
  );
}

// ============ Tab 1: 编组管理 ============
function GroupsTab({ groups, skills, reload, show }: {
  groups: SkillGroup[]; skills: Skill[]; reload: () => Promise<void>;
  show: (t: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [creating, setCreating] = React.useState(false);
  const [previewGroup, setPreviewGroup] = React.useState<SkillGroup | null>(null);
  const [editingGroup, setEditingGroup] = React.useState<SkillGroup | null>(null);

  const toggleEnabled = async (g: SkillGroup) => {
    await api.updateSkillGroup(g.id, { enabled: g.enabled ? 0 : 1 });
    await reload();
    show(`${g.name} 已${g.enabled ? '停用' : '启用'}`);
  };
  const del = async (g: SkillGroup) => {
    if (!confirm(`确认删除编组「${g.name}」？组内规则不会被删除。`)) return;
    await api.deleteSkillGroup(g.id);
    await reload();
    show(`已删除编组 ${g.name}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="accent" size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />新建编组
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyHint icon={Layers} text="还没有编组，点击「新建编组」从规则库选择规则组成评估组" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const ruleCount = g.skillIds.length;
            const enabledRules = g.skillIds.filter((id) => skills.find((s) => s.id === id)?.enabled).length;
            return (
              <Card key={g.id} className={cn('transition-all hover:shadow-lg', !g.enabled && 'opacity-60')}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Layers className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">{g.name}</span>
                      </CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">{g.description || '暂无说明'}</CardDescription>
                    </div>
                    <Toggle on={!!g.enabled} onChange={() => toggleEnabled(g)} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{ruleCount} 条规则</Badge>
                    <Badge variant="secondary">{enabledRules} 启用</Badge>
                    <Badge variant="default">{ANALYSIS_TYPE_LABEL[g.analysisType] || g.analysisType}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setPreviewGroup(g)}>
                      <FileText className="h-3 w-3" />查看规则
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditingGroup(g)} aria-label="编辑规则组">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => del(g)} aria-label="删除">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateGroupSheet
        open={creating}
        onClose={() => setCreating(false)}
        skills={skills}
        onSubmit={async (body) => {
          await api.createSkillGroup(body);
          await reload();
          setCreating(false);
          show(`编组「${body.name}」已创建`);
        }}
      />

      <GroupPreviewSheet group={previewGroup} skills={skills} onClose={() => setPreviewGroup(null)} />

      <GroupEditSheet
        group={editingGroup}
        skills={skills}
        onClose={() => setEditingGroup(null)}
        onSaved={async () => { setEditingGroup(null); await reload(); show('规则组已更新'); }}
      />
    </div>
  );
}

function CreateGroupSheet({ open, onClose, skills, onSubmit }: {
  open: boolean; onClose: () => void; skills: Skill[];
  onSubmit: (body: SkillGroupCreateRequest) => Promise<void>;
}) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [analysisType, setAnalysisType] = React.useState<SkillGroupCreateRequest['analysisType']>('repo_analysis');

  React.useEffect(() => {
    if (open) { setName(''); setDescription(''); setSelected([]); setAnalysisType('repo_analysis'); }
  }, [open]);

  const toggle = (id: string) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const byCategory = CATEGORIES.map((c) => ({ ...c, items: skills.filter((s) => s.category === c.value) })).filter((g) => g.items.length > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selected.length === 0) return;
    await onSubmit({ name: name.trim(), description: description.trim(), skillIds: selected, analysisType });
  };

  return (
    <Sheet open={open} onClose={onClose} title="新建编组" description="从规则库选择规则组成评估组，分析时按组内规则逐条审查" width="lg">
      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">编组名称 <span className="text-destructive">*</span></label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：Java 后端规范组" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">说明</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="一句话说明编组用途" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">分析类型</label>
          <select
            value={analysisType}
            onChange={(e) => setAnalysisType(e.target.value as SkillGroupCreateRequest['analysisType'])}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <option value="repo_analysis">仓库分析</option>
            <option value="developer_review">开发者评审</option>
            <option value="team_aggregation">团队聚合</option>
          </select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">选择规则 <span className="text-destructive">*</span></label>
            <Badge variant="outline">{selected.length} 已选</Badge>
          </div>
          <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-border/60 p-3">
            {byCategory.map((g) => (
              <div key={g.value}>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{g.label}</div>
                <div className="space-y-1">
                  {g.items.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-muted/30">
                      <input
                        type="checkbox"
                        checked={selected.includes(s.id)}
                        onChange={() => toggle(s.id)}
                        className="mt-0.5 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{s.name}</span>
                          <Badge variant={SEVERITY_META[s.severity]?.variant || 'default'} className="text-[10px]">
                            {SEVERITY_META[s.severity]?.label || s.severity}
                          </Badge>
                          {!s.enabled && <Badge variant="secondary" className="text-[10px]">停用</Badge>}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.ruleContent}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {byCategory.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">规则库为空，请先在「规范来源」抽取或手工创建规则</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button type="submit" variant="accent" disabled={!name.trim() || selected.length === 0}>创建编组</Button>
        </div>
      </form>
    </Sheet>
  );
}

function GroupPreviewSheet({ group, skills, onClose }: {
  group: SkillGroup | null; skills: Skill[]; onClose: () => void;
}) {
  const map = React.useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const ordered = (group?.skillIds || []).map((id) => map.get(id)).filter(Boolean) as Skill[];
  if (!group) return null;
  return (
    <Sheet open={!!group} onClose={onClose} title={group.name} description={`${ordered.length} 条规则 · ${ANALYSIS_TYPE_LABEL[group.analysisType] || group.analysisType}`} width="lg">
      {group.description && <p className="mb-4 rounded-lg bg-muted/25 p-3 text-sm text-muted-foreground">{group.description}</p>}
      <div className="space-y-3">
        {ordered.map((s, i) => (
          <div key={s.id} className="rounded-lg border border-border/60 p-3">
            <div className="flex items-start gap-2">
              <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground/50">#{i + 1}</span>
                  <span className="text-sm font-semibold">{s.name}</span>
                  <Badge variant={SEVERITY_META[s.severity]?.variant || 'default'} className="text-[10px]">{SEVERITY_META[s.severity]?.label || s.severity}</Badge>
                  <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[s.category] || s.category}</Badge>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{s.ruleContent}</p>
              </div>
            </div>
          </div>
        ))}
        {ordered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">组内无规则</p>}
      </div>
    </Sheet>
  );
}

/** 编辑编组：基本信息 + prompt 模板（Skill 驱动核心入口） */
function GroupEditSheet({ group, skills, onClose, onSaved }: {
  group: SkillGroup | null; skills: Skill[]; onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [analysisType, setAnalysisType] = React.useState<SkillGroupAnalysisType>('repo_analysis');
  const [promptTemplate, setPromptTemplate] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!group) return;
    setName(group.name);
    setDescription(group.description || '');
    setAnalysisType(group.analysisType);
    setPromptTemplate(group.promptTemplate || '');
  }, [group]);

  if (!group) return null;

  return (
    <Sheet open={!!group} onClose={onClose} title="编辑规则组" description="修改即时影响该模块的后续分析（Skill 驱动）" width="lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">组名</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">分析模块</label>
            <select value={analysisType} onChange={(e) => setAnalysisType(e.target.value as SkillGroupAnalysisType)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none">
              {Object.entries(ANALYSIS_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">说明</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Prompt 模板</label>
          <p className="text-[11px] text-muted-foreground">分析 prompt 骨架，支持 {`{rules}`} 及模块专属占位符；组内规则会自动注入 {`{rules}`}</p>
          <textarea value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value)} rows={12} className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="未设置时使用内置默认模板" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">组内规则（{group.skillIds.length}）</label>
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {group.skillIds.map((id) => {
              const s = skills.find((x) => x.id === id);
              if (!s) return null;
              return (
                <div key={s.id} className="rounded-lg border border-border/60 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{s.name}</span>
                    <Badge variant={s.enabled ? 'success' : 'secondary'} className="text-[10px]">{s.enabled ? '启用' : '停用'}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{s.ruleContent}</p>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">规则的启停与正文请在「规则库」页维护</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>取消</Button>
        <Button
          type="button"
          variant="accent"
          disabled={saving || !name.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              await api.updateSkillGroup(group.id, {
                name: name.trim(),
                description: description.trim(),
                analysisType,
                promptTemplate,
              });
              await onSaved();
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}保存
        </Button>
      </div>
    </Sheet>
  );
}

// ============ Tab 2: 规则库 ============
function SkillsTab({ skills, sources, reload, show }: {
  skills: Skill[]; sources: SkillSource[]; reload: () => Promise<void>;
  show: (t: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [filterCategory, setFilterCategory] = React.useState<string>('');
  const [filterSource, setFilterSource] = React.useState<string>('');
  const [filterEnabled, setFilterEnabled] = React.useState<string>('');
  const [editing, setEditing] = React.useState<Skill | null>(null);
  const [creating, setCreating] = React.useState(false);

  const filtered = skills.filter((s) =>
    (!filterCategory || s.category === filterCategory) &&
    (!filterSource || s.sourceId === filterSource) &&
    (filterEnabled === '' || (filterEnabled === '1' ? s.enabled : !s.enabled))
  );

  const toggleEnabled = async (s: Skill) => {
    await api.updateSkill(s.id, { enabled: s.enabled ? 0 : 1 });
    await reload();
  };
  const del = async (s: Skill) => {
    if (!confirm(`确认删除规则「${s.name}」？`)) return;
    await api.deleteSkill(s.id);
    await reload();
    show(`已删除规则 ${s.name}`);
  };

  const sourceName = (id?: string) => sources.find((x) => x.id === id)?.name || '手工创建';

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none cursor-pointer">
              <option value="">全部分类</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none cursor-pointer">
              <option value="">全部来源</option>
              {sources.map((src) => <option key={src.id} value={src.id}>{src.name}</option>)}
              <option value="manual">手工创建</option>
            </select>
            <select value={filterEnabled} onChange={(e) => setFilterEnabled(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none cursor-pointer">
              <option value="">全部状态</option>
              <option value="1">启用</option>
              <option value="0">停用</option>
            </select>
            <span className="ml-auto text-xs text-muted-foreground">{filtered.length} / {skills.length} 条</span>
            <Button variant="accent" size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />新建规则
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>规则名</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>严重级</TableHead>
                <TableHead>来源</TableHead>
                <TableHead className="text-center">启用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">{s.ruleContent}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{CATEGORY_LABEL[s.category] || s.category}</Badge></TableCell>
                  <TableCell><Badge variant={SEVERITY_META[s.severity]?.variant || 'default'}>{SEVERITY_META[s.severity]?.label || s.severity}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{sourceName(s.sourceId)}</TableCell>
                  <TableCell className="text-center"><Toggle on={!!s.enabled} onChange={() => toggleEnabled(s)} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(s)} aria-label="编辑"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => del(s)} aria-label="删除"><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && <EmptyHint icon={BookOpenCheck} text="没有符合条件的规则" />}
        </CardContent>
      </Card>

      <SkillEditSheet
        open={creating || !!editing}
        skill={editing}
        sources={sources}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSubmit={async (body, id) => {
          if (id) {
            await api.updateSkill(id, body);
            show(`规则「${body.name}」已更新`);
          } else {
            await api.createSkill(body as SkillCreateRequest);
            show(`规则「${body.name}」已创建`);
          }
          await reload();
          setCreating(false); setEditing(null);
        }}
      />
    </div>
  );
}

function SkillEditSheet({ open, skill, sources, onClose, onSubmit }: {
  open: boolean; skill: Skill | null; sources: SkillSource[];
  onClose: () => void;
  onSubmit: (body: Partial<Skill>, id?: string) => Promise<void>;
}) {
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState<SkillCategory>('quality');
  const [severity, setSeverity] = React.useState<SkillSeverity>('medium');
  const [ruleContent, setRuleContent] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [sourceId, setSourceId] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setName(skill?.name || '');
      setCategory(skill?.category || 'quality');
      setSeverity(skill?.severity || 'medium');
      setRuleContent(skill?.ruleContent || '');
      setDescription(skill?.description || '');
      setSourceId(skill?.sourceId || '');
    }
  }, [open, skill]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ruleContent.trim()) return;
    await onSubmit({
      name: name.trim(), category, severity, ruleContent: ruleContent.trim(),
      description: description.trim(), sourceId: sourceId || undefined,
    }, skill?.id);
  };

  return (
    <Sheet open={open} onClose={onClose} title={skill ? '编辑规则' : '新建规则'} description="一条 Skill = 一条可执行的评估规则，规则正文将注入 LLM 审查 prompt" width="md">
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">规则名 <span className="text-destructive">*</span></label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：禁止硬编码密钥" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">分类</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as SkillCategory)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none cursor-pointer">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">严重级</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as SkillSeverity)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none cursor-pointer">
              {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">规则正文 <span className="text-destructive">*</span></label>
          <textarea
            value={ruleContent} onChange={(e) => setRuleContent(e.target.value)} rows={4}
            placeholder="可直接作为 LLM 审查指令的完整句子，≤200字"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">说明（可选）</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="规则说明，展示用" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">来源（可选）</label>
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none cursor-pointer">
            <option value="">手工创建</option>
            {sources.map((src) => <option key={src.id} value={src.id}>{src.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button type="submit" variant="accent" disabled={!name.trim() || !ruleContent.trim()}>{skill ? '保存' : '创建'}</Button>
        </div>
      </form>
    </Sheet>
  );
}

// ============ Tab 3: 规范来源 ============
function SourcesTab({ sources, skills, reload, show }: {
  sources: SkillSource[]; skills: Skill[]; reload: () => Promise<void>;
  show: (t: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [creating, setCreating] = React.useState(false);
  const [extracting, setExtracting] = React.useState<string | null>(null);

  const extract = async (src: SkillSource) => {
    setExtracting(src.id);
    try {
      const res: ExtractResult = await api.extractSkills(src.id);
      await reload();
      show(res.message || `抽取完成`, res.status === 'failed' ? 'error' : 'success');
    } catch {
      show('抽取失败，请检查 LLM 配置', 'error');
    } finally {
      setExtracting(null);
    }
  };
  const del = async (src: SkillSource) => {
    if (!confirm(`确认删除来源「${src.name}」？关联规则不会被删除（sourceId 置空）。`)) return;
    await api.deleteSkillSource(src.id);
    await reload();
    show(`已删除来源 ${src.name}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="accent" size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />导入规范
        </Button>
      </div>

      {sources.length === 0 ? (
        <EmptyHint icon={FileText} text="还没有规范来源，点击「导入规范」录入编码规范文档" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sources.map((src) => {
            const ruleCount = skills.filter((s) => s.sourceId === src.id).length;
            return (
              <Card key={src.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">{src.name}</span>
                      </CardTitle>
                      <CardDescription className="mt-1 line-clamp-1">{src.description || '暂无说明'}</CardDescription>
                    </div>
                    {src.status === 'extracted' ? (
                      <Badge variant="success"><CheckCircle2 className="h-3 w-3" />已抽取</Badge>
                    ) : src.status === 'failed' ? (
                      <Badge variant="danger"><XCircle className="h-3 w-3" />失败</Badge>
                    ) : (
                      <Badge variant="secondary">待抽取</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{LANGS.find((l) => l.value === src.sourceLang)?.label || src.sourceLang || '通用'}</Badge>
                    <Badge variant="outline">{src.docType}</Badge>
                    <Badge variant="default">{ruleCount} 条规则</Badge>
                  </div>
                  <div className="max-h-24 overflow-y-auto rounded-md bg-muted/20 p-2 text-xs text-muted-foreground">
                    <pre className="whitespace-pre-wrap font-sans">{src.content || '（无内容）'}</pre>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline" size="sm" className="flex-1"
                      onClick={() => extract(src)} disabled={extracting === src.id}
                    >
                      <Sparkles className="h-3 w-3" />
                      {extracting === src.id ? '抽取中...' : 'AI 抽取'}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => del(src)} aria-label="删除">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateSourceSheet
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={async (body) => {
          await api.createSkillSource(body);
          await reload();
          setCreating(false);
          show(`来源「${body.name}」已导入，可点击 AI 抽取`);
        }}
      />
    </div>
  );
}

function CreateSourceSheet({ open, onClose, onSubmit }: {
  open: boolean; onClose: () => void;
  onSubmit: (body: SkillSourceCreateRequest) => Promise<void>;
}) {
  const [name, setName] = React.useState('');
  const [sourceLang, setSourceLang] = React.useState('all');
  const [docType, setDocType] = React.useState<'markdown' | 'text'>('markdown');
  const [content, setContent] = React.useState('');
  const [description, setDescription] = React.useState('');

  React.useEffect(() => {
    if (open) { setName(''); setSourceLang('all'); setDocType('markdown'); setContent(''); setDescription(''); }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    await onSubmit({ name: name.trim(), sourceLang, docType, content, description: description.trim() });
  };

  return (
    <Sheet open={open} onClose={onClose} title="导入规范" description="录入编码规范文档（Markdown / 文本），导入后可点击 AI 抽取生成规则草稿" width="lg">
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">规范名称 <span className="text-destructive">*</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：Java编码规范v3.2" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">语言</label>
            <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none cursor-pointer">
              {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">说明</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="一句话说明" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">规范内容 <span className="text-destructive">*</span></label>
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                <input type="radio" checked={docType === 'markdown'} onChange={() => setDocType('markdown')} /> Markdown
              </label>
              <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                <input type="radio" checked={docType === 'text'} onChange={() => setDocType('text')} /> 纯文本
              </label>
            </div>
          </div>
          <textarea
            value={content} onChange={(e) => setContent(e.target.value)} rows={12}
            placeholder={'# 编码规范\n## 安全\n- 禁止硬编码密钥\n- SQL 必须参数化查询\n...'}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button type="submit" variant="accent" disabled={!name.trim() || !content.trim()}>导入</Button>
        </div>
      </form>
    </Sheet>
  );
}

function EmptyHint({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
        <Icon className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
