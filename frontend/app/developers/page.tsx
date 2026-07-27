/**
 * ③ 开发者列表
 * FilterBar + 排序 + 筛选 + stagger 入场
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GitCommit, Eye, Code2, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, ScoreRing, staggerContainer, cardItem } from '@/components/widgets';
import { FilterBar, EmptyState } from '@/components/filter-bar';
import { DiceBearAvatar } from '@/components/dicebear-avatar';
import { api } from '@/lib/api';
import { teamGroups } from '@/lib/mock-data';
import type { Developer } from '@/lib/types';

const LEVEL_VARIANT: Record<string, 'default' | 'secondary' | 'accent' | 'success'> = {
  // D 高阶能力层用紫色（accent），E 资深工程师用绿色，F 中高级用蓝色，G 成长层用次级色
  D: 'accent',
  E: 'success',
  F: 'default',
  G: 'secondary',
};

function levelVariant(level: string) {
  return LEVEL_VARIANT[level[0]] || 'secondary';
}

// D > E > F > G；同一大级内 3 > 2 > 1
const LEVEL_ORDER: Record<string, number> = {
  D1: 10, D2: 11, D3: 12,
  E1: 7, E2: 8, E3: 9,
  F1: 4, F2: 5, F3: 6,
  G1: 1, G2: 2, G3: 3,
};

type SortKey = 'overall' | 'commits' | 'reviews' | 'level';

function DeveloperCard({ dev }: { dev: Developer }) {
  return (
    <motion.div variants={cardItem}>
      <Link href={`/developers/${dev.id}`}>
        <Card className="cursor-pointer transition-all hover:scale-[1.02] hover:border-primary/40 hover:shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DiceBearAvatar seed={dev.username} size={52} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{dev.name}</h3>
                  <Badge variant={levelVariant(dev.level)} className="font-mono">{dev.level}</Badge>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{dev.role}</span><span>·</span><span>{dev.team}</span>{dev.groupId && <Badge variant="secondary">{teamGroups.find((group) => group.id === dev.groupId)?.name || '已分组'}</Badge>}
                </div>
              </div>
              <ScoreRing score={dev.overall} size={52} stroke={5} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {dev.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <Code2 className="h-3 w-3 text-muted-foreground" />
              {dev.langs.map((lang) => <Badge key={lang} variant="secondary" className="font-mono">{lang}</Badge>)}
            </div>
            <div className="mt-3 flex items-center gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><GitCommit className="h-3 w-3" /><span className="font-mono tabular-nums">{dev.commits}</span> commits</span>
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" /><span className="font-mono tabular-nums">{dev.reviews}</span> reviews</span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

export default function DevelopersPage() {
  const [developers, setDevelopers] = React.useState<Developer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sortBy, setSortBy] = React.useState<SortKey>('overall');
  const [teamFilter, setTeamFilter] = React.useState('all');
  const [levelFilter, setLevelFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    api.getDevelopers().then((d) => { setDevelopers(d); setLoading(false); });
  }, []);

  const teamOptions = React.useMemo(() => {
    const teams = [...new Set(developers.map((d) => d.team))];
    return teams.map((t) => ({ value: t, label: t }));
  }, [developers]);

  const filtered = React.useMemo(() => {
    let result = developers;
    if (teamFilter !== 'all') result = result.filter((d) => d.team === teamFilter);
    if (levelFilter !== 'all') result = result.filter((d) => d.level.startsWith(levelFilter));
    if (search.trim()) result = result.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.username.includes(search.toLowerCase()));
    return [...result].sort((a, b) => {
      if (sortBy === 'overall') return b.overall - a.overall;
      if (sortBy === 'commits') return b.commits - a.commits;
      if (sortBy === 'reviews') return b.reviews - a.reviews;
      if (sortBy === 'level') return (LEVEL_ORDER[b.level] || 0) - (LEVEL_ORDER[a.level] || 0);
      return 0;
    });
  }, [developers, teamFilter, levelFilter, search, sortBy]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-48 skeleton rounded-xl" />)}
        </div>
      </div>
    );
  }

  const avgScore = developers.length ? (developers.reduce((s, d) => s + d.overall, 0) / developers.length).toFixed(1) : 0;

  return (
    <>
      <PageHeader title="开发者画像" description="从 Git 行为与代码质量推导个人能力，辅助成长而非考核" />

      <FilterBar
        searchPlaceholder="搜索姓名或用户名..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          { key: 'team', label: '团队', options: teamOptions },
          { key: 'level', label: '职级', options: [
            { value: 'D', label: 'D 级（高阶能力）' },
            { value: 'E', label: 'E 级（资深工程师）' },
            { value: 'F', label: 'F 级（中高级工程师）' },
            { value: 'G', label: 'G 级（成长层）' },
          ] },
        ]}
        filterValues={{ team: teamFilter, level: levelFilter }}
        onFilterChange={(key, val) => key === 'team' ? setTeamFilter(val) : setLevelFilter(val)}
        sortOptions={[
          { value: 'overall', label: '按综合评分' },
          { value: 'commits', label: '按 commits' },
          { value: 'reviews', label: '按 reviews' },
          { value: 'level', label: '按级别' },
        ]}
        sortValue={sortBy}
        onSortChange={(v) => setSortBy(v as SortKey)}
        summary={
          <>
            <span>共 <span className="font-mono tabular-nums font-medium">{filtered.length}</span> 人</span>
            <span className="text-muted-foreground">·</span>
            <span>平均评分 <span className="font-mono tabular-nums font-medium">{avgScore}</span></span>
          </>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="无匹配开发者" description="尝试调整筛选条件或搜索关键词" />
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((d) => <DeveloperCard key={d.id} dev={d} />)}
        </motion.div>
      )}
    </>
  );
}
