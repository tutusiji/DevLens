/**
 * 能力标准管理页
 * 5 角色 tab + 级别矩阵表（可编辑）+ Skill Group 关联 + 雷达预览
 */
'use client';

import * as React from 'react';
import { CheckCircle2, Eye, RotateCcw, Ruler, Save, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageHeader } from '@/components/widgets';
import { CapabilityRadar } from '@/components/charts';
import { api } from '@/lib/api';
import { scoreColor } from '@/lib/utils';
import type { CapabilityMeta, CapabilityRoleInfo, Level, Role, SkillGroup } from '@/lib/types';

type Toast = { text: string; type: 'success' | 'error' };

export default function CapabilityStandardsPage() {
  const [role, setRole] = React.useState<Role>('backend');
  const [selectedLevel, setSelectedLevel] = React.useState<Level>('E3');
  const [roles, setRoles] = React.useState<CapabilityRoleInfo[]>([]);
  const [meta, setMeta] = React.useState<CapabilityMeta | null>(null);
  const [skillGroups, setSkillGroups] = React.useState<SkillGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<Toast | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = React.useCallback((text: string, type: Toast['type'] = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  React.useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [capabilityMeta, response, groups] = await Promise.all([
        api.getCapabilityMeta(),
        api.getCapabilityStandards(),
        api.getSkillGroups().catch(() => []),
      ]);
      setMeta(response.meta ?? capabilityMeta);
      setRoles(response.roles);
      setSkillGroups(groups);
      setRole((previousRole) => (
        response.roles.some((item) => item.roleKey === previousRole)
          ? previousRole
          : (response.roles[0]?.roleKey ?? previousRole)
      ));
    } catch {
      showToast('能力标准加载失败，请稍后重试', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const currentConfig = roles.find((item) => item.roleKey === role);
  const allLevels = meta?.allLevels ?? [];

  React.useEffect(() => {
    if (allLevels.length > 0 && !allLevels.includes(selectedLevel)) {
      setSelectedLevel(allLevels[0]);
    }
  }, [allLevels, selectedLevel]);

  const updateCurrentRole = (updater: (item: CapabilityRoleInfo) => CapabilityRoleInfo) => {
    setRoles((previous) => previous.map((item) => (
      item.roleKey === role ? updater(item) : item
    )));
  };

  const handleStandardChange = (level: Level, dimension: string, value: number) => {
    const threshold = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    updateCurrentRole((item) => ({
      ...item,
      standards: {
        ...item.standards,
        [level]: {
          ...item.standards[level],
          [dimension]: threshold,
        },
      },
    }));
  };

  const handleSkillGroupChange = (skillGroupId: string) => {
    const selectedGroup = skillGroups.find((group) => group.id === skillGroupId);
    updateCurrentRole((item) => ({
      ...item,
      skillGroupId: skillGroupId || null,
      skillGroupName: selectedGroup?.name ?? null,
    }));
  };

  const saveRole = async () => {
    if (!currentConfig) return;
    setSaving(true);
    try {
      const saved = await api.saveCapabilityRole(role, {
        dimensions: currentConfig.dimensions,
        standards: currentConfig.standards,
        skillGroupId: currentConfig.skillGroupId ?? null,
      });
      setRoles((previous) => previous.map((item) => (
        item.roleKey === role ? saved : item
      )));
      setLastSavedAt(new Date().toISOString());
      showToast(`${saved.roleName}能力标准已保存`);
    } catch {
      showToast('保存失败，请检查后端服务后重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetAll = async () => {
    setSaving(true);
    try {
      const result = await api.resetCapabilityStandards();
      setRoles(result.roles);
      setMeta(result.meta);
      setLastSavedAt(new Date().toISOString());
      showToast('全部能力标准已重置为默认阈值');
    } catch {
      showToast('重置失败，请检查后端服务后重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton rounded" />
        <div className="h-28 skeleton rounded-xl" />
        <div className="h-[460px] skeleton rounded-xl" />
      </div>
    );
  }

  if (!currentConfig || !meta) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>能力标准暂不可用</CardTitle>
          <CardDescription>未加载到角色配置，请确认后端服务正常后刷新页面。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" onClick={() => void load()}>重新加载</Button>
        </CardContent>
      </Card>
    );
  }

  const roleTabs = roles.map((item) => ({ value: item.roleKey, label: item.roleName }));
  const currentDimensions = currentConfig.dimensions;
  const currentStandards = currentConfig.standards;
  const groupedLevels = meta.levelGroups.map((group) => ({
    ...group,
    levels: allLevels.filter((level) => level.startsWith(group.prefix)),
  }));
  const previewThresholds = currentStandards[selectedLevel] ?? {};
  const previewSeries = [{
    name: `${currentConfig.roleName} ${selectedLevel} 标准`,
    data: Object.fromEntries(
      currentDimensions.map((dimension) => [
        meta.dimensionLabels[dimension] ?? dimension,
        previewThresholds[dimension] ?? 0,
      ]),
    ),
    color: 'var(--chart-1)',
  }];

  return (
    <>
      <PageHeader
        title="能力标准管理"
        description="按开发角色 × D1-G3 职级定义能力标准；D 级为稀缺高阶能力层，不固定岗位称谓"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void resetAll()} disabled={saving}>
              <RotateCcw className="h-4 w-4" />
              重置全部标准
            </Button>
            <Button variant="accent" size="sm" onClick={() => void saveRole()} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? '保存中…' : '保存'}
            </Button>
          </>
        }
      />

      {/* 角色选择与 Skill Group 关联 */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-4">
              <Ruler className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm font-medium">开发角色</span>
              <Segmented
                value={role}
                onChange={(value) => setRole(value as Role)}
                options={roleTabs}
              />
            </div>
            <label className="flex min-w-0 items-center gap-2 xl:ml-auto">
              <span className="whitespace-nowrap text-sm font-medium">关联 Skill 组</span>
              <select
                aria-label="关联 Skill 组"
                value={currentConfig.skillGroupId ?? ''}
                onChange={(event) => handleSkillGroupChange(event.target.value)}
                className="min-w-[180px] rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">未关联（仅通用能力阈值）</option>
                {skillGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}{group.enabled ? '' : '（已停用）'}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-muted-foreground">
              {currentDimensions.length} 个维度 · {allLevels.length} 个职级
              {lastSavedAt && ` · 最近保存 ${new Date(lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {currentDimensions.map((dimension) => (
              <Badge key={dimension} variant="outline">
                {meta.dimensionLabels[dimension] ?? dimension}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* 级别矩阵表（可编辑） */}
        <Card className="overflow-x-auto lg:col-span-3">
          <CardHeader>
            <CardTitle>标准阈值矩阵</CardTitle>
            <CardDescription>
              行=职级（{currentConfig.roleName}），列=维度，单元格=标准分（0-100）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">职级</TableHead>
                  {currentDimensions.map((dimension) => (
                    <TableHead key={dimension} className="min-w-[80px] text-center">
                      {meta.dimensionLabels[dimension] ?? dimension}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedLevels.map((group) => (
                  <React.Fragment key={group.prefix}>
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={currentDimensions.length + 1} className="py-1">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {group.prefix} 级 · {group.label}（{group.range}）
                        </span>
                      </TableCell>
                    </TableRow>
                    {group.levels.map((level) => (
                      <TableRow key={level} className={selectedLevel === level ? 'bg-primary/5' : ''}>
                        <TableCell className="sticky left-0 bg-card font-mono font-medium">
                          <button
                            onClick={() => setSelectedLevel(level)}
                            className={`cursor-pointer hover:text-primary ${selectedLevel === level ? 'text-primary' : ''}`}
                          >
                            {level}
                          </button>
                        </TableCell>
                        {currentDimensions.map((dimension) => {
                          const value = currentStandards[level]?.[dimension] ?? 0;
                          return (
                            <TableCell key={dimension} className="p-1">
                              <Input
                                aria-label={`${level} ${meta.dimensionLabels[dimension] ?? dimension} 阈值`}
                                type="number"
                                min={0}
                                max={100}
                                value={value}
                                onChange={(event) => handleStandardChange(level, dimension, Number(event.target.value))}
                                className="h-8 w-16 text-center font-mono text-xs tabular-nums"
                                style={{ color: scoreColor(value) }}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 雷达预览 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              标准雷达预览
            </CardTitle>
            <CardDescription className="mt-1">点击左侧职级行预览对应标准</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">预览职级</span>
              <select
                value={selectedLevel}
                onChange={(event) => setSelectedLevel(event.target.value as Level)}
                className="cursor-pointer rounded-md border border-input bg-background px-2 py-1 text-sm font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {allLevels.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <CapabilityRadar series={previewSeries} height={300} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {currentDimensions.map((dimension) => {
                const value = previewThresholds[dimension] ?? 0;
                return (
                  <div key={dimension} className="flex items-center justify-between rounded border border-border/60 px-2 py-1">
                    <span className="text-xs text-muted-foreground">
                      {meta.dimensionLabels[dimension] ?? dimension}
                    </span>
                    <span className="font-mono text-xs font-medium tabular-nums" style={{ color: scoreColor(value) }}>
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl ${
            toast.type === 'success'
              ? 'border-success/30 bg-success/15 text-success'
              : 'border-destructive/30 bg-destructive/15 text-destructive'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.text}
        </div>
      )}
    </>
  );
}
