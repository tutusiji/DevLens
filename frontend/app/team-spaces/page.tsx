/**
 * 团队空间管理
 * 团队空间是项目、人员、小组与仓库归属的组织根。
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Building2, FolderGit2, Layers3, Plus, Users, ArrowUpRight, Pencil, UserRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, FilterBar } from '@/components/filter-bar';
import { PageHeader, StatCard } from '@/components/widgets';
import { useTeamSpace } from '@/components/team-space-provider';
import { api } from '@/lib/api';
import type { TeamSpace, Developer, Project, Repository } from '@/lib/types';

function SpaceSheet({ space, open, onClose, developers, projects, repos }: { space: TeamSpace | null; open: boolean; onClose: () => void; developers: Developer[]; projects: Project[]; repos: Repository[] }) {
  const { groups, createTeamGroup, updateTeamSpace } = useTeamSpace();
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(space?.name || '');
  const [description, setDescription] = React.useState(space?.description || '');
  const [groupName, setGroupName] = React.useState('');

  React.useEffect(() => {
    setName(space?.name || '');
    setDescription(space?.description || '');
    setEditing(false);
  }, [space]);

  if (!space) return null;
  const spaceGroups = groups.filter((group) => group.teamId === space.id);
  const members = developers.filter((developer) => developer.teamId === space.id);
  const spaceProjects = projects.filter((project) => project.teamId === space.id);
  const spaceRepos = repos.filter((repo) => repo.teamId === space.id);
  const addGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!groupName.trim()) return;
    await createTeamGroup({ teamId: space.id, name: groupName.trim() });
    setGroupName('');
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    updateTeamSpace(space.id, { name: name.trim(), description: description.trim() });
    setEditing(false);
  };

  return <Sheet open={open} onClose={onClose} title={editing ? '编辑团队空间' : space.name} description={editing ? '更新团队空间的基础信息' : `${space.description || '尚未填写团队说明'} · ${space.updatedAt}`} width="lg">
    {editing ? <form className="space-y-4" onSubmit={save}>
      <div className="space-y-1.5"><label htmlFor="space-name" className="text-sm font-medium">团队空间名称 <span className="text-destructive">*</span></label><Input id="space-name" required value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="space-y-1.5"><label htmlFor="space-description" className="text-sm font-medium">团队说明</label><textarea id="space-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditing(false)}>取消</Button><Button type="submit" variant="accent">保存变更</Button></div>
    </form> : <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/25 p-4"><div><div className="text-xs text-muted-foreground">团队负责人</div><div className="mt-1 text-sm font-medium">{space.ownerName || '尚未指定'}</div></div><div><div className="text-xs text-muted-foreground">创建时间</div><div className="mt-1 text-sm font-medium">{space.createdAt}</div></div><Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />编辑信息</Button></div>
      <section className="space-y-3"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">小组</h3><p className="text-xs text-muted-foreground">小组用于细分人员归属；项目归属于大团队，可由多组协作。</p></div><Badge variant="outline">{spaceGroups.length} 个</Badge></div>{spaceGroups.length ? <div className="space-y-2">{spaceGroups.map((group) => <div key={group.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3"><div><div className="text-sm font-medium">{group.name}</div><div className="mt-1 text-xs text-muted-foreground">负责人 {group.leadName || '未指定'} · {group.memberIds.length} 人</div></div><Badge variant="secondary">小组</Badge></div>)}</div> : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">暂无小组，成员和项目仍归属于当前团队空间。</p>}<form onSubmit={addGroup} className="flex gap-2"><Input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="新建小组名称，例如：核心服务小组" /><Button type="submit" variant="outline"><Plus className="h-4 w-4" />新建小组</Button></form></section>
      <section className="space-y-3"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">人员</h3><p className="text-xs text-muted-foreground">已归属到当前团队空间的研发成员。</p></div><Badge variant="outline">{members.length} 人</Badge></div>{members.length ? <div className="grid gap-2 sm:grid-cols-2">{members.map((member) => <div key={member.id} className="rounded-lg border border-border/60 p-3"><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /><span className="text-sm font-medium">{member.name}</span><Badge variant="outline">{member.level}</Badge></div><div className="mt-1 text-xs text-muted-foreground">{member.role} · {member.groupId ? spaceGroups.find((group) => group.id === member.groupId)?.name || '已分组' : '直属团队'}</div></div>)}</div> : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">暂无已归属成员。项目接入时会将匹配人员归入团队上下文。</p>}</section>
      <section className="space-y-3"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">项目与仓库</h3><p className="text-xs text-muted-foreground">项目归属于大团队，可由多组协作；仓库通过项目建立关联。</p></div><Badge variant="outline">{spaceProjects.length} 项目 / {spaceRepos.length} 仓库</Badge></div><div className="space-y-2">{spaceProjects.map((project) => <div key={project.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3"><div><div className="font-mono text-sm">{project.name}</div><div className="mt-1 text-xs text-muted-foreground">{project.language}</div></div><Link href={`/projects/${project.id}`} className="text-xs font-medium text-primary hover:underline">查看评估</Link></div>)}</div></section>
      <Link href="/teams"><Button variant="outline" className="w-full">进入团队能力分析 <ArrowUpRight className="h-4 w-4" /></Button></Link>
    </div>}
  </Sheet>;
}

function CreateSpaceSheet({ open, onClose, developers }: { open: boolean; onClose: () => void; developers: Developer[] }) {
  const { createTeamSpace, largeTeams, activeLargeTeamId } = useTeamSpace();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [ownerId, setOwnerId] = React.useState('');
  const [largeTeamId, setLargeTeamId] = React.useState(activeLargeTeamId || largeTeams[0]?.id || '');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const owner = developers.find((developer) => developer.id === ownerId);
    await createTeamSpace({ name: name.trim(), description: description.trim(), largeTeamId, ownerId: owner?.id, ownerName: owner?.name });
    setName(''); setDescription(''); setOwnerId(''); setLargeTeamId(activeLargeTeamId || largeTeams[0]?.id || ''); onClose();
  };
  return <Sheet open={open} onClose={onClose} title="新建团队空间" description="团队空间是项目、人员与小组的组织根。" width="md"><form onSubmit={submit} className="space-y-4"><div className="space-y-1.5"><label htmlFor="new-space-name" className="text-sm font-medium">团队空间名称 <span className="text-destructive">*</span></label><Input id="new-space-name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：平台架构组" /></div><div className="space-y-1.5"><label htmlFor="new-space-large-team" className="text-sm font-medium">归属大团队 <span className="text-destructive">*</span></label><select id="new-space-large-team" required value={largeTeamId} onChange={(event) => setLargeTeamId(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{largeTeams.map((lt) => <option key={lt.id} value={lt.id}>{lt.name}</option>)}</select></div><div className="space-y-1.5"><label htmlFor="new-space-description" className="text-sm font-medium">团队说明</label><textarea id="new-space-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="说明团队负责的业务或技术边界" className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div><div className="space-y-1.5"><label htmlFor="new-space-owner" className="text-sm font-medium">负责人</label><select id="new-space-owner" value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">暂不指定</option>{developers.map((developer) => <option key={developer.id} value={developer.id}>{developer.name} · {developer.role}</option>)}</select></div><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose}>取消</Button><Button type="submit" variant="accent"><Plus className="h-4 w-4" />创建团队空间</Button></div></form></Sheet>;
}

export default function TeamSpacesPage() {
  const { spaces, groups, setActiveTeamSpaceId, activeTeamSpaceId } = useTeamSpace();
  const [developers, setDevelopers] = React.useState<Developer[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [repos, setRepos] = React.useState<Repository[]>([]);
  React.useEffect(() => {
    Promise.all([api.getDevelopers(), api.getProjects(), api.getRepos()])
      .then(([d, p, r]) => { setDevelopers(d); setProjects(p); setRepos(r); });
  }, []);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [sort, setSort] = React.useState('updated');
  const [selected, setSelected] = React.useState<TeamSpace | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const visible = React.useMemo(() => spaces.filter((space) => (!search.trim() || `${space.name} ${space.ownerName || ''}`.toLowerCase().includes(search.toLowerCase())) && (status === 'all' || space.status === status)).sort((a, b) => sort === 'members' ? b.memberIds.length - a.memberIds.length : sort === 'projects' ? b.projectIds.length - a.projectIds.length : b.updatedAt.localeCompare(a.updatedAt)), [spaces, search, status, sort]);
  const totalMembers = spaces.reduce((count, space) => count + space.memberIds.length, 0);
  const unassignedRepos = repos.filter((repo) => !repo.projectId).length;

  return <><PageHeader title="团队空间管理" description="团队是项目、人员与小组的组织根；接入项目之前需要先归属团队。" actions={<Button variant="accent" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />新建团队空间</Button>} />
    {!spaces.length ? <EmptyState icon={Building2} title="先创建首个团队空间" description="项目、人员、小组和仓库都需要先归属团队空间，才能开始分析。" action={<Button variant="accent" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />创建团队空间</Button>} /> : <>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="团队空间" value={spaces.length} unit="个" delta={1} icon={Building2} /><StatCard label="已归属成员" value={totalMembers} unit="人" delta={2} icon={Users} /><StatCard label="关联项目" value={spaces.reduce((count, space) => count + space.projectIds.length, 0)} unit="个" delta={1} icon={FolderGit2} /><StatCard label="待归档仓库" value={unassignedRepos} unit="个" delta={-1} icon={Layers3} /></div>
      <FilterBar searchPlaceholder="搜索团队空间或负责人..." searchValue={search} onSearchChange={setSearch} filters={[{ key: 'status', label: '状态', options: [{ value: 'active', label: '启用' }, { value: 'archived', label: '已归档' }] }]} filterValues={{ status }} onFilterChange={(_, value) => setStatus(value)} sortOptions={[{ value: 'updated', label: '按更新时间' }, { value: 'members', label: '按成员数' }, { value: 'projects', label: '按项目数' }]} sortValue={sort} onSortChange={setSort} summary={<><span>显示 <b className="font-mono">{visible.length}</b> 个团队空间</span><span className="text-muted-foreground">·</span><span>当前空间 <b className="font-medium">{spaces.find((space) => space.id === activeTeamSpaceId)?.name || '未选择'}</b></span></>} />
      {!visible.length ? <EmptyState icon={Building2} title="没有匹配的团队空间" description="调整筛选条件，或创建新的团队空间。" action={<Button variant="accent" onClick={() => setCreateOpen(true)}>新建团队空间</Button>} /> : <Card><Table className="min-w-[900px]"><TableHeader><TableRow><TableHead>团队空间</TableHead><TableHead>负责人</TableHead><TableHead className="text-right">小组</TableHead><TableHead className="text-right">成员</TableHead><TableHead className="text-right">项目</TableHead><TableHead>最近更新</TableHead><TableHead>状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{visible.map((space) => <TableRow key={space.id} className="cursor-pointer" onClick={() => setSelected(space)}><TableCell><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10"><Building2 className="h-3.5 w-3.5 text-primary" /></div><div><div className="font-medium">{space.name}</div><div className="max-w-[260px] truncate text-xs text-muted-foreground">{space.description || '尚未填写说明'}</div></div></div></TableCell><TableCell>{space.ownerName || <span className="text-muted-foreground">未指定</span>}</TableCell><TableCell className="text-right font-mono">{groups.filter((group) => group.teamId === space.id).length}</TableCell><TableCell className="text-right font-mono">{space.memberIds.length}</TableCell><TableCell className="text-right font-mono">{space.projectIds.length}</TableCell><TableCell className="text-xs text-muted-foreground">{space.updatedAt}</TableCell><TableCell><Badge variant={space.status === 'active' ? 'success' : 'secondary'}>{space.status === 'active' ? '启用' : '已归档'}</Badge></TableCell><TableCell className="text-right"><Button size="sm" variant={space.id === activeTeamSpaceId ? 'secondary' : 'outline'} onClick={(event) => { event.stopPropagation(); setActiveTeamSpaceId(space.id); }}>{space.id === activeTeamSpaceId ? '当前空间' : '设为当前'}</Button></TableCell></TableRow>)}</TableBody></Table></Card>}
    </>}
    <CreateSpaceSheet open={createOpen} onClose={() => setCreateOpen(false)} developers={developers} /><SpaceSheet space={selected} open={Boolean(selected)} onClose={() => setSelected(null)} developers={developers} projects={projects} repos={repos} />
  </>;
}
