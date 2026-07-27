/**
 * 团队空间上下文
 * UI-first 阶段在浏览器会话中维护团队与小组归属，后续可直接替换为组织 API。
 */
'use client';

import * as React from 'react';
import type { TeamGroup, TeamSpace, LargeTeam } from '@/lib/types';
import { teamGroups, teamSpaces, largeTeams } from '@/lib/mock-data';

type TeamSpaceDraft = Pick<TeamSpace, 'name' | 'description' | 'ownerId' | 'ownerName' | 'largeTeamId'>;

interface TeamSpaceContextValue {
  spaces: TeamSpace[];
  visibleSpaces: TeamSpace[];
  groups: TeamGroup[];
  largeTeams: LargeTeam[];
  activeTeamSpaceId: string | null;
  activeTeamSpace: TeamSpace | null;
  activeLargeTeamId: string | null;
  activeLargeTeam: LargeTeam | null;
  setActiveTeamSpaceId: (id: string) => void;
  setActiveLargeTeamId: (id: string) => void;
  createTeamSpace: (draft: TeamSpaceDraft) => TeamSpace;
  updateTeamSpace: (id: string, patch: Partial<TeamSpace>) => void;
  createTeamGroup: (draft: Omit<TeamGroup, 'id' | 'memberIds' | 'projectIds'>) => TeamGroup;
}

const TeamSpaceContext = React.createContext<TeamSpaceContextValue | null>(null);
const STORAGE_KEY_TEAM = 'devlens-active-team-space';
const STORAGE_KEY_LARGE = 'devlens-active-large-team';

export function TeamSpaceProvider({ children }: { children: React.ReactNode }) {
  const [spaces, setSpaces] = React.useState<TeamSpace[]>(teamSpaces);
  const [groups, setGroups] = React.useState<TeamGroup[]>(teamGroups);
  const [largeTeamsState] = React.useState<LargeTeam[]>(largeTeams);
  const [activeLargeTeamId, setActiveLargeTeamIdState] = React.useState<string | null>(largeTeams[0]?.id || null);
  const [activeTeamSpaceId, setActiveTeamSpaceIdState] = React.useState<string | null>(teamSpaces[0]?.id || null);

  // 初始化时从 localStorage 恢复大团队和团队空间，并确保团队空间归属于当前大团队
  React.useEffect(() => {
    const savedLarge = window.localStorage.getItem(STORAGE_KEY_LARGE);
    const initialLargeId = savedLarge && largeTeams.some((lt) => lt.id === savedLarge)
      ? savedLarge
      : largeTeams[0]?.id || null;
    setActiveLargeTeamIdState(initialLargeId);

    const savedTeam = window.localStorage.getItem(STORAGE_KEY_TEAM);
    const validTeam = savedTeam && teamSpaces.some((space) => space.id === savedTeam) ? savedTeam : null;
    const teamInLarge = validTeam && teamSpaces.find((space) => space.id === validTeam)?.largeTeamId === initialLargeId
      ? validTeam
      : teamSpaces.find((space) => space.largeTeamId === initialLargeId)?.id || null;
    setActiveTeamSpaceIdState(teamInLarge);
  }, []);

  const setActiveTeamSpaceId = React.useCallback((id: string) => {
    setActiveTeamSpaceIdState(id);
    window.localStorage.setItem(STORAGE_KEY_TEAM, id);
  }, []);

  const setActiveLargeTeamId = React.useCallback((id: string) => {
    setActiveLargeTeamIdState(id);
    window.localStorage.setItem(STORAGE_KEY_LARGE, id);
    // 切换大团队时，自动选中该大团队下的第一个团队空间
    const firstTeam = teamSpaces.find((space) => space.largeTeamId === id);
    if (firstTeam) {
      setActiveTeamSpaceIdState(firstTeam.id);
      window.localStorage.setItem(STORAGE_KEY_TEAM, firstTeam.id);
    }
  }, []);

  const createTeamSpace = React.useCallback((draft: TeamSpaceDraft) => {
    const now = new Date();
    const space: TeamSpace = {
      id: `team-${now.getTime()}`,
      name: draft.name,
      largeTeamId: draft.largeTeamId || activeLargeTeamId || largeTeams[0]?.id || '',
      description: draft.description,
      ownerId: draft.ownerId,
      ownerName: draft.ownerName,
      status: 'active',
      createdAt: now.toLocaleDateString('zh-CN'),
      updatedAt: '刚刚',
      memberIds: draft.ownerId ? [draft.ownerId] : [],
      projectIds: [],
    };
    setSpaces((current) => [...current, space]);
    setActiveTeamSpaceId(space.id);
    return space;
  }, [activeLargeTeamId]);

  const updateTeamSpace = React.useCallback((id: string, patch: Partial<TeamSpace>) => {
    setSpaces((current) => current.map((space) => space.id === id ? { ...space, ...patch, updatedAt: '刚刚' } : space));
  }, []);

  const createTeamGroup = React.useCallback((draft: Omit<TeamGroup, 'id' | 'memberIds' | 'projectIds'>) => {
    const group: TeamGroup = { ...draft, id: `group-${Date.now()}`, memberIds: [], projectIds: [] };
    setGroups((current) => [...current, group]);
    return group;
  }, []);

  const activeTeamSpace = spaces.find((space) => space.id === activeTeamSpaceId) || null;
  const activeLargeTeam = largeTeamsState.find((lt) => lt.id === activeLargeTeamId) || null;
  const visibleSpaces = React.useMemo(
    () => spaces.filter((space) => space.largeTeamId === activeLargeTeamId),
    [spaces, activeLargeTeamId]
  );
  const value = React.useMemo(() => ({
    spaces,
    visibleSpaces,
    groups,
    largeTeams: largeTeamsState,
    activeTeamSpaceId,
    activeTeamSpace,
    activeLargeTeamId,
    activeLargeTeam,
    setActiveTeamSpaceId,
    setActiveLargeTeamId,
    createTeamSpace,
    updateTeamSpace,
    createTeamGroup,
  }), [spaces, visibleSpaces, groups, largeTeamsState, activeTeamSpaceId, activeTeamSpace, activeLargeTeamId, activeLargeTeam, setActiveTeamSpaceId, setActiveLargeTeamId, createTeamSpace, updateTeamSpace, createTeamGroup]);

  return <TeamSpaceContext.Provider value={value}>{children}</TeamSpaceContext.Provider>;
}

export function useTeamSpace() {
  const context = React.useContext(TeamSpaceContext);
  if (!context) throw new Error('useTeamSpace 必须在 TeamSpaceProvider 内使用');
  return context;
}
