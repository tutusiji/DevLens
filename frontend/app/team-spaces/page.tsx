/**
 * 团队空间管理（统一组织团队树）
 * 团队空间是项目、人员、子团队与仓库归属的组织根；通过 parentId 构建树。
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Building2, FolderGit2, Layers3, Plus, Users, ArrowUpRight, Pencil, UserRound } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState, FilterBar } from '@/components/filter-bar';
import { PageHeader, StatCard } from '@/components/widgets';
import { useTeamSpace, type TeamTreeNode } from '@/components/team-space-provider';
import { api } from '@/lib/api';
import type { TeamSpace, Developer, Project, Repository } from '@/lib/types';

/** 扁平化团队树（先序遍历），用于父级下拉候选 */
function flattenTeams(nodes: TeamTreeNode[]): TeamTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTeams(node.children)]);
}

/** 由扁平团队列表重建树（用于筛选后的可见树） */
function buildTree(list: TeamSpace[]): TeamTreeNode[] {
  const byId = new Map<string, TeamTreeNode>();
  for (const s of list) byId.set(s.id, { ...s, children: [] });
  const roots: TeamTreeNode[] = [];
  for (const s of list) {
    const node = byId.get(s.id)!;
    const parent = s.parentId ? byId.get(s.parentId) : undefined;
    if (parent) parent.children.push(node); else roots.push(node);
  }
  return roots;
}

function TeamNode({ team, depth, onSelect }: { team: TeamTreeNode; depth: number; onSelect: (t: TeamSpace) => void }) {
  const [open, setOpen] = React.useState(depth === 0);
  return <div>
    <div className="flex items-center gap-2 rounded-lg border border-border/60 p-2.5 hover:bg-muted/40" style={{ marginLeft: depth * 20 }} onClick={() => onSelect(team)}>
      {team.children.length ? <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="w-4 shrink-0 cursor-pointer text-muted-foreground">{open ? '▼' : '▶'}</button> : <span className="w-4 shrink-0" />}
      <Building2 className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">{team.name}</span>
      <Badge variant="outline">{team.memberIds.length} 人</Badge>
      <span className="text-xs text-muted-foreground">{team.projectIds.length} 项目</span>
    </div>
    {open && team.children.map((c) => <TeamNode key={c.id} team={c} depth={depth + 1} onSelect={onSelect} />)}
  </div>;
}

function SpaceSheet({ space, open, onClose, developers, projects, repos }: { space: TeamSpace | null; open: boolean; onClose: () => void; developers: Developer[]; projects: Project[]; repos: Repository[] }) {
  const { teamsTree, teamIndex, moveTeam, updateTeamSpace, createTeamSpace } = useTeamSpace();
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [parentId, setParentId] = React.useState('');
  const [childName, setChildName] = React.useState('');

  React.useEffect(() => {
    setName(space?.name || '');
    setDescription(space?.description || '');
    setParentId(space?.parentId ?? '');
    setChildName('');
    setEditing(false);
  }, [space]);

  if (!space) return null;
  // 用最新树节点渲染详情，保证编辑/移动后立即刷新
  const current = teamIndex.get(space.id) ?? space;
  const childTeams = teamIndex.get(space.id)?.children ?? [];
  const members = developers.filter((developer) => developer.teamId === space.id);
  const spaceProjects = projects.filter((project) => project.teamId === space.id);
  const spaceRepos = repos.filter((repo) => repo.teamId === space.id);

  // 父级候选：排除自身及其子孙，避免成环
  const excludeIds = new Set<string>([space.id]);
  const collectDescendants = (node: TeamTreeNode) => { for (const c of node.children) { excludeIds.add(c.id); collectDescendants(c); } };
  const selfNode = teamIndex.get(space.id);
  if (selfNode) collectDescendants(selfNode);
  const parentOptions = flattenTeams(teamsTree).filter((team) => !excludeIds.has(team.id));

  const addChild = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!childName.trim()) return;
    await createTeamSpace({ name: childName.trim(), parentId: space.id });
    setChildName('');
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const nextParent = parentId || null; // 空 = 无父团队（根）
    if (nextParent !== (current.parentId ?? null)) await moveTeam(current.id, nextParent);
    if (name.trim() !== current.name || description.trim() !== (current.description ?? '')) {
      await updateTeamSpace(current.id, { name: name.trim(), description: description.trim() });
    }
    setEditing(false);
  };

  return <Sheet open={open} onClose={onClose} title={editing ? '编辑团队' : current.name} description={editing ? '更新团队基础信息或移动父团队' : `${current.description || '尚未填写团队说明'} · ${current.updatedAt}`} width="lg">
    {editing ? <form className="space-y-4" onSubmit={save}>
      <div className="space-y-1.5"><label htmlFor="space-name" className="text-sm font-medium">团队名称 <span className="text-destructive">*</span></label><Input id="space-name" required value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="space-y-1.5"><label htmlFor="space-parent" className="text-sm font-medium">父团队</label><select id="space-parent" value={parentId} onChange={(event) => setParentId(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">无父团队（根）</option>{parentOptions.map((team) => <option key={team.id} value={team.id}>{team.parentName ? `${team.parentName} / ${team.name}` : team.name}</option>)}</select><p className="text-xs text-muted-foreground">修改父团队即可把团队移动到树的其它位置。</p></div>
      <div className="space-y-1.5"><label htmlFor="space-description" className="text-sm font-medium">团队说明</label><textarea id="space-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditing(false)}>取消</Button><Button type="submit" variant="accent">保存变更</Button></div>
    </form> : <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/25 p-4"><div><div className="text-xs text-muted-foreground">团队负责人</div><div className="mt-1 text-sm font-medium">{current.ownerName || '尚未指定'}</div></div><div><div className="text-xs text-muted-foreground">父团队</div><div className="mt-1 text-sm font-medium">{current.parentName || '根团队'}</div></div><div><div className="text-xs text-muted-foreground">创建时间</div><div className="mt-1 text-sm font-medium">{current.createdAt}</div></div><Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />编辑信息</Button></div>
      <section className="space-y-3"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">子团队</h3><p className="text-xs text-muted-foreground">子团队用于细分人员归属；项目归属于团队，可由多子团队协作。</p></div><Badge variant="outline">{childTeams.length} 个</Badge></div>{childTeams.length ? <div className="space-y-2">{childTeams.map((child) => <div key={child.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3"><div><div className="text-sm font-medium">{child.name}</div><div className="mt-1 text-xs text-muted-foreground">负责人 {child.ownerName || '未指定'} · {child.memberIds.length} 人 · {child.projectIds.length} 项目</div></div><Badge variant="secondary">子团队</Badge></div>)}</div> : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">暂无子团队，成员和项目仍归属于当前团队。</p>}<form onSubmit={addChild} className="flex gap-2"><Input value={childName} onChange={(event) => setChildName(event.target.value)} placeholder="新建子团队名称，例如：核心服务小组" /><Button type="submit" variant="outline"><Plus className="h-4 w-4" />新建子团队</Button></form></section>
      <section className="space-y-3"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">人员</h3><p className="text-xs text-muted-foreground">已归属到当前团队的研发成员。</p></div><Badge variant="outline">{members.length} 人</Badge></div>{members.length ? <div className="grid gap-2 sm:grid-cols-2">{members.map((member) => <div key={member.id} className="rounded-lg border border-border/60 p-3"><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /><span className="text-sm font-medium">{member.name}</span><Badge variant="outline">{member.level}</Badge></div><div className="mt-1 text-xs text-muted-foreground">{member.role} · {member.team}</div></div>)}</div> : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">暂无已归属成员。项目接入时会将匹配人员归入团队上下文。</p>}</section>
      <section className="space-y-3"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">项目与仓库</h3><p className="text-xs text-muted-foreground">项目归属于团队，可由多子团队协作；仓库通过项目建立关联。</p></div><Badge variant="outline">{spaceProjects.length} 项目 / {spaceRepos.length} 仓库</Badge></div><div className="space-y-2">{spaceProjects.map((project) => <div key={project.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3"><div><div className="font-mono text-sm">{project.name}</div><div className="mt-1 text-xs text-muted-foreground">{project.language}</div></div><Link href={`/projects/${project.id}`} className="text-xs font-medium text-primary hover:underline">查看评估</Link></div>)}</div></section>
      <Link href="/teams"><Button variant="outline" className="w-full">进入团队能力分析 <ArrowUpRight className="h-4 w-4" /></Button></Link>
    </div>}
  </Sheet>;
}

function CreateSpaceSheet({ open, onClose, developers }: { open: boolean; onClose: () => void; developers: Developer[] }) {
  const { createTeamSpace, teamsTree } = useTeamSpace();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [ownerId, setOwnerId] = React.useState('');
  const [parentId, setParentId] = React.useState('');
  const parentOptions = flattenTeams(teamsTree);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const owner = developers.find((developer) => developer.id === ownerId);
    await createTeamSpace({ name: name.trim(), parentId: parentId || null, description: description.trim(), ownerId: owner?.id, ownerName: owner?.name });
    setName(''); setDescription(''); setOwnerId(''); setParentId(''); onClose();
  };
  return <Sheet open={open} onClose={onClose} title="新建团队" description="团队是项目、人员与子团队的组织根；父团队可选。" width="md"><form onSubmit={submit} className="space-y-4"><div className="space-y-1.5"><label htmlFor="new-space-name" className="text-sm font-medium">团队名称 <span className="text-destructive">*</span></label><Input id="new-space-name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：平台架构组 / 核心服务小组" /></div><div className="space-y-1.5"><label htmlFor="new-space-parent" className="text-sm font-medium">父团队</label><select id="new-space-parent" value={parentId} onChange={(event) => setParentId(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">无父团队（根）</option>{parentOptions.map((team) => <option key={team.id} value={team.id}>{team.parentName ? `${team.parentName} / ${team.name}` : team.name}</option>)}</select><p className="text-xs text-muted-foreground">不选择则创建根团队；选择父团队则创建其子团队。</p></div><div className="space-y-1.5"><label htmlFor="new-space-description" className="text-sm font-medium">团队说明</label><textarea id="new-space-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="说明团队负责的业务或技术边界" className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div><div className="space-y-1.5"><label htmlFor="new-space-owner" className="text-sm font-medium">负责人</label><select id="new-space-owner" value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">暂不指定</option>{developers.map((developer) => <option key={developer.id} value={developer.id}>{developer.name} · {developer.role}</option>)}</select></div><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose}>取消</Button><Button type="submit" variant="accent"><Plus className="h-4 w-4" />创建团队</Button></div></form></Sheet>;
}

export default function TeamSpacesPage() {
  const { spaces, teamsTree, teamIndex, setActiveTeamSpaceId, activeTeamSpaceId } = useTeamSpace();
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

  // 筛选后的可见树：命中的团队保留其祖先链，使搜索结果可导航
  const visibleTree = React.useMemo(() => {
    if (!search.trim() && status === 'all') return teamsTree;
    const keep = new Set<string>();
    for (const s of spaces) {
      const matched = (!search.trim() || `${s.name} ${s.ownerName || ''}`.toLowerCase().includes(search.toLowerCase())) && (status === 'all' || s.status === status);
      if (matched) {
        let cur: TeamSpace | undefined = s;
        while (cur) { keep.add(cur.id); cur = cur.parentId ? teamIndex.get(cur.parentId) : undefined; }
      }
    }
    const filtered = spaces.filter((s) => keep.has(s.id));
    return buildTree(filtered);
  }, [spaces, search, status, teamIndex, teamsTree]);

  const sortedVisibleTree = React.useMemo(() => {
    const sorted = [...visibleTree];
    sorted.sort((a, b) => sort === 'members' ? b.memberIds.length - a.memberIds.length : sort === 'projects' ? b.projectIds.length - a.projectIds.length : b.updatedAt.localeCompare(a.updatedAt));
    return sorted;
  }, [visibleTree, sort]);

  const matchingCount = React.useMemo(() => spaces.filter((s) => (!search.trim() || `${s.name} ${s.ownerName || ''}`.toLowerCase().includes(search.toLowerCase())) && (status === 'all' || s.status === status)).length, [spaces, search, status]);
  const totalMembers = spaces.reduce((count, space) => count + space.memberIds.length, 0);
  const unassignedRepos = repos.filter((repo) => !repo.projectId).length;

  return <><PageHeader title="团队空间管理" description="团队是项目、人员与子团队的组织根；接入项目之前需要先归属团队。" actions={<Button variant="accent" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />新建团队</Button>} />
    {!spaces.length ? <EmptyState icon={Building2} title="先创建首个团队" description="项目、人员、子团队和仓库都需要先归属团队，才能开始分析。" action={<Button variant="accent" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />创建团队</Button>} /> : <>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="团队" value={spaces.length} unit="个" delta={1} icon={Building2} /><StatCard label="已归属成员" value={totalMembers} unit="人" delta={2} icon={Users} /><StatCard label="关联项目" value={spaces.reduce((count, space) => count + space.projectIds.length, 0)} unit="个" delta={1} icon={FolderGit2} /><StatCard label="待归档仓库" value={unassignedRepos} unit="个" delta={-1} icon={Layers3} /></div>
      <FilterBar searchPlaceholder="搜索团队或负责人..." searchValue={search} onSearchChange={setSearch} filters={[{ key: 'status', label: '状态', options: [{ value: 'active', label: '启用' }, { value: 'archived', label: '已归档' }] }]} filterValues={{ status }} onFilterChange={(_, value) => setStatus(value)} sortOptions={[{ value: 'updated', label: '按更新时间' }, { value: 'members', label: '按成员数' }, { value: 'projects', label: '按项目数' }]} sortValue={sort} onSortChange={setSort} summary={<><span>显示 <b className="font-mono">{matchingCount}</b> 个团队</span><span className="text-muted-foreground">·</span><span>当前团队 <b className="font-medium">{spaces.find((space) => space.id === activeTeamSpaceId)?.name || '未选择'}</b></span></>} />
      {!sortedVisibleTree.length ? <EmptyState icon={Building2} title="没有匹配的团队" description="调整筛选条件，或创建新的团队。" action={<Button variant="accent" onClick={() => setCreateOpen(true)}>新建团队</Button>} /> : <Card><div className="space-y-1 p-3">{sortedVisibleTree.map((root) => <TeamNode key={root.id} team={root} depth={0} onSelect={(team) => setSelected(team)} />)}</div></Card>}
    </>}
    <CreateSpaceSheet open={createOpen} onClose={() => setCreateOpen(false)} developers={developers} /><SpaceSheet space={selected} open={Boolean(selected)} onClose={() => setSelected(null)} developers={developers} projects={projects} repos={repos} />
  </>;
}
