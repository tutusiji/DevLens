/**
 * 能力标准管理页
 * 5 角色 tab + 级别矩阵表(可编辑) + 雷达预览
 */
'use client';

import * as React from 'react';
import { Ruler, Save, RotateCcw, Eye } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageHeader } from '@/components/widgets';
import { CapabilityRadar } from '@/components/charts';
import { roleConfigs, roleStandards, DIMENSION_LABELS, ALL_LEVELS } from '@/lib/mock-data';
import { scoreColor } from '@/lib/utils';
import type { Role, Level } from '@/lib/types';
import { LEVEL_GROUPS } from '@/lib/types';

const ROLE_TABS = roleConfigs.map((r) => ({ value: r.key, label: r.name }));

export default function CapabilityStandardsPage() {
  const [role, setRole] = React.useState<Role>('backend');
  const [selectedLevel, setSelectedLevel] = React.useState<Level>('E3');
  const [standards, setStandards] = React.useState(JSON.parse(JSON.stringify(roleStandards)));

  const currentConfig = roleConfigs.find((r) => r.key === role)!;
  const currentDimensions = currentConfig.dimensions;
  const currentStandards = standards[role];

  const handleStandardChange = (level: Level, dim: string, value: number) => {
    setStandards((prev: any) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [level]: { ...prev[role][level], [dim]: value },
      },
    }));
  };

  const resetRole = () => {
    setStandards((prev: any) => ({ ...prev, [role]: JSON.parse(JSON.stringify(roleStandards[role])) }));
  };

  // 雷达预览数据
  const previewSeries = [{
    name: `${currentConfig.name} ${selectedLevel} 标准`,
    data: Object.fromEntries(
      currentDimensions.map((dim) => [DIMENSION_LABELS[dim], currentStandards[selectedLevel][dim]])
    ),
    color: 'var(--chart-1)',
  }];

  // 按大级分组渲染级别行
  const groupedLevels = LEVEL_GROUPS.map((g) => ({
    ...g,
    levels: ALL_LEVELS.filter((l) => l.startsWith(g.prefix)),
  }));

  return (
    <>
      <PageHeader
        title="能力标准管理"
        description="按开发角色 × D1-G3 职级定义能力标准；D 级为稀缺高阶能力层，不固定岗位称谓"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={resetRole}>
              <RotateCcw className="h-4 w-4" />
              重置当前角色
            </Button>
            <Button variant="accent" size="sm">
              <Save className="h-4 w-4" />
              保存
            </Button>
          </>
        }
      />

      {/* 角色选择 */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Ruler className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">开发角色</span>
            <Segmented
              value={role}
              onChange={(v) => setRole(v as Role)}
              options={ROLE_TABS}
            />
            <span className="ml-auto text-xs text-muted-foreground">
              {currentConfig.dimensions.length} 个维度 · {ALL_LEVELS.length} 个职级
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {currentDimensions.map((dim) => (
              <Badge key={dim} variant="outline">{DIMENSION_LABELS[dim]}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* 级别矩阵表（可编辑） */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>标准阈值矩阵</CardTitle>
            <CardDescription>
              行=职级（{ROLE_TABS.find((r) => r.value === role)?.label}），列=维度，单元格=标准分（0-100）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">职级</TableHead>
                  {currentDimensions.map((dim) => (
                    <TableHead key={dim} className="text-center min-w-[80px]">
                      {DIMENSION_LABELS[dim]}
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
                        <TableCell className="font-mono font-medium sticky left-0 bg-card">
                          <button
                            onClick={() => setSelectedLevel(level)}
                            className={`cursor-pointer hover:text-primary ${selectedLevel === level ? 'text-primary' : ''}`}
                          >
                            {level}
                          </button>
                        </TableCell>
                        {currentDimensions.map((dim) => {
                          const val = currentStandards[level][dim];
                          return (
                            <TableCell key={dim} className="p-1">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={val}
                                onChange={(e) => handleStandardChange(level, dim, Number(e.target.value))}
                                className="h-8 w-16 text-center font-mono text-xs tabular-nums"
                                style={{ color: scoreColor(val) }}
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  标准雷达预览
                </CardTitle>
                <CardDescription className="mt-1">
                  点击左侧职级行预览对应标准
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">预览职级</span>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value as Level)}
                className="rounded-md border border-input bg-background px-2 py-1 text-sm font-mono outline-none cursor-pointer"
              >
                {ALL_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <CapabilityRadar series={previewSeries} height={300} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {currentDimensions.map((dim) => {
                const val = currentStandards[selectedLevel][dim];
                return (
                  <div key={dim} className="flex items-center justify-between rounded border border-border/60 px-2 py-1">
                    <span className="text-xs text-muted-foreground">{DIMENSION_LABELS[dim]}</span>
                    <span className="font-mono text-xs tabular-nums font-medium" style={{ color: scoreColor(val) }}>
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
