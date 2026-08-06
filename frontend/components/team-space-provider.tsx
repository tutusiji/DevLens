/**
 * 团队空间上下文（统一组织团队树）
 * 从后端 API 加载全部团队（根团队/空间/子团队，通过 parentId 成树）；
 * 创建/编辑/移动均走 API。
 */
'use client';

import * as React from 'react';
import type { TeamSpace } from '@/lib/types';
import { api } from '@/lib/api';

/** 团队树节点：TeamSpace + 子节点（由 provider 构建） */
export type TeamTreeNode = TeamSpace & { children: TeamTreeNode[] };

interface TeamSpaceContextValue {
  spaces: TeamSpace[];
  teamsTree: TeamTreeNode[];
  teamIndex: Map<string, TeamTreeNode>;
  activeTeamSpaceId: string | null;
  activeTeamSpace: TeamSpace | null;
  setActiveTeamSpaceId: (id: string) => void;
  createTeamSpace: (draft: Parameters<typeof api.createTeamSpace>[0]) => Promise<TeamSpace>;
  updateTeamSpace: (id: string, patch: Partial<TeamSpace>) => Promise<TeamSpace>;
  moveTeam: (id: string, parentId: string | null) => Promise<TeamSpace>;
}

const TeamSpaceContext = React.createContext<TeamSpaceContextValue | null>(null);
const STORAGE_KEY_TEAM = 'devlens-active-team-space';

export function TeamSpaceProvider({ children }: { children: React.ReactNode }) {
  const [spaces, setSpaces] = React.useState<TeamSpace[]>([]);
  const [activeTeamSpaceId, setActiveTeamSpaceIdState] = React.useState<string | null>(null);
  React.useEffect(() => {
    api.getTeamSpaces().then((s) => {
      setSpaces(s);
      const saved = window.localStorage.getItem(STORAGE_KEY_TEAM);
      setActiveTeamSpaceIdState(saved && s.some((x) => x.id === saved) ? saved : (s.find((x) => !x.parentId)?.id ?? s[0]?.id ?? null));
    }).catch(() => {});
  }, []);
  const teamsTree = React.useMemo(() => {
    const byId = new Map<string, TeamTreeNode>();
    for (const s of spaces) byId.set(s.id, { ...s, children: [] });
    const roots: TeamTreeNode[] = [];
    for (const s of spaces) {
      const node = byId.get(s.id)!;
      const parent = s.parentId ? byId.get(s.parentId) : undefined;
      if (parent) parent.children.push(node); else roots.push(node);
    }
    return roots;
  }, [spaces]);
  const teamIndex = React.useMemo(() => {
    const map = new Map<string, TeamTreeNode>();
    const walk = (nodes: TeamTreeNode[]) => {
      for (const node of nodes) { map.set(node.id, node); walk(node.children); }
    };
    walk(teamsTree);
    return map;
  }, [teamsTree]);
  const createTeamSpace = React.useCallback(async (draft: Parameters<typeof api.createTeamSpace>[0]) => {
    const space = await api.createTeamSpace(draft);
    setSpaces((c) => [...c, space]);
    setActiveTeamSpaceIdState(space.id); window.localStorage.setItem(STORAGE_KEY_TEAM, space.id);
    return space;
  }, []);
  const updateTeamSpace = React.useCallback(async (id: string, patch: Partial<TeamSpace>) => {
    const updated = await api.updateTeamSpace(id, patch);
    // 合并返回结果，避免 mock 的局部 patch 覆盖整个对象
    setSpaces((c) => c.map((s) => s.id === id ? { ...s, ...updated } : s));
    return { ...spaces.find((s) => s.id === id), ...updated } as TeamSpace;
  }, [spaces]);
  const moveTeam = React.useCallback((id: string, parentId: string | null) => updateTeamSpace(id, { parentId }), [updateTeamSpace]);
  const setActiveTeamSpaceId = React.useCallback((id: string) => { setActiveTeamSpaceIdState(id); window.localStorage.setItem(STORAGE_KEY_TEAM, id); }, []);
  const activeTeamSpace = spaces.find((s) => s.id === activeTeamSpaceId) || null;
  const value = React.useMemo(() => ({
    spaces, teamsTree, teamIndex, activeTeamSpaceId, activeTeamSpace,
    setActiveTeamSpaceId, createTeamSpace, updateTeamSpace, moveTeam,
  }), [spaces, teamsTree, teamIndex, activeTeamSpaceId, activeTeamSpace, setActiveTeamSpaceId, createTeamSpace, updateTeamSpace, moveTeam]);
  return <TeamSpaceContext.Provider value={value}>{children}</TeamSpaceContext.Provider>;
}

export function useTeamSpace() {
  const context = React.useContext(TeamSpaceContext);
  if (!context) throw new Error('useTeamSpace 必须在 TeamSpaceProvider 内使用');
  return context;
}
