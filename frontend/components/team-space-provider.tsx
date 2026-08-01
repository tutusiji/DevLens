/**
 * 团队空间上下文
 * 从后端 API 加载团队/小组/大团队；创建走 API。
 */
'use client';

import * as React from 'react';
import type { TeamGroup, TeamSpace, LargeTeam } from '@/lib/types';
import { api } from '@/lib/api';

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
  createTeamSpace: (draft: TeamSpaceDraft) => Promise<TeamSpace>;
  updateTeamSpace: (id: string, patch: Partial<TeamSpace>) => void;
  createTeamGroup: (draft: Omit<TeamGroup, 'id' | 'memberIds' | 'projectIds'>) => Promise<TeamGroup>;
}

const TeamSpaceContext = React.createContext<TeamSpaceContextValue | null>(null);
const STORAGE_KEY_TEAM = 'devlens-active-team-space';
const STORAGE_KEY_LARGE = 'devlens-active-large-team';

export function TeamSpaceProvider({ children }: { children: React.ReactNode }) {
  const [spaces, setSpaces] = React.useState<TeamSpace[]>([]);
  const [groups, setGroups] = React.useState<TeamGroup[]>([]);
  const [largeTeamsState, setLargeTeams] = React.useState<LargeTeam[]>([]);
  const [activeLargeTeamId, setActiveLargeTeamIdState] = React.useState<string | null>(null);
  const [activeTeamSpaceId, setActiveTeamSpaceIdState] = React.useState<string | null>(null);

  React.useEffect(() => {
    Promise.all([api.getTeamSpaces(), api.getTeamGroups(), api.getLargeTeams()])
      .then(([s, g, lt]) => {
        setSpaces(s);
        setGroups(g);
        setLargeTeams(lt);
        const savedLarge = window.localStorage.getItem(STORAGE_KEY_LARGE);
        const initialLargeId = savedLarge && lt.some((x) => x.id === savedLarge) ? savedLarge : lt[0]?.id || null;
        setActiveLargeTeamIdState(initialLargeId);
        const savedTeam = window.localStorage.getItem(STORAGE_KEY_TEAM);
        const validTeam = savedTeam && s.some((x) => x.id === savedTeam) ? savedTeam : null;
        const teamInLarge = validTeam && s.find((x) => x.id === validTeam)?.largeTeamId === initialLargeId
          ? validTeam : s.find((x) => x.largeTeamId === initialLargeId)?.id || null;
        setActiveTeamSpaceIdState(teamInLarge);
      })
      .catch(() => {
        // 加载失败静默，页面显示空状态
      });
  }, []);

  const setActiveTeamSpaceId = React.useCallback((id: string) => {
    setActiveTeamSpaceIdState(id);
    window.localStorage.setItem(STORAGE_KEY_TEAM, id);
  }, []);

  const setActiveLargeTeamId = React.useCallback((id: string) => {
    setActiveLargeTeamIdState(id);
    window.localStorage.setItem(STORAGE_KEY_LARGE, id);
    const firstTeam = spaces.find((space) => space.largeTeamId === id);
    if (firstTeam) {
      setActiveTeamSpaceIdState(firstTeam.id);
      window.localStorage.setItem(STORAGE_KEY_TEAM, firstTeam.id);
    }
  }, [spaces]);

  const createTeamSpace = React.useCallback(async (draft: TeamSpaceDraft) => {
    const space = await api.createTeamSpace(draft);
    setSpaces((current) => [...current, space]);
    setActiveTeamSpaceId(space.id);
    return space;
  }, []);

  const updateTeamSpace = React.useCallback((id: string, patch: Partial<TeamSpace>) => {
    setSpaces((current) => current.map((space) => space.id === id ? { ...space, ...patch, updatedAt: '刚刚' } : space));
  }, []);

  const createTeamGroup = React.useCallback(async (draft: Omit<TeamGroup, 'id' | 'memberIds' | 'projectIds'>) => {
    const group = await api.createTeamGroup(draft);
    setGroups((current) => [...current, group]);
    return group;
  }, []);

  const activeTeamSpace = spaces.find((space) => space.id === activeTeamSpaceId) || null;
  const activeLargeTeam = largeTeamsState.find((lt) => lt.id === activeLargeTeamId) || null;
  const visibleSpaces = React.useMemo(
    () => spaces.filter((space) => space.largeTeamId === activeLargeTeamId),
    [spaces, activeLargeTeamId],
  );
  const value = React.useMemo(() => ({
    spaces, visibleSpaces, groups, largeTeams: largeTeamsState,
    activeTeamSpaceId, activeTeamSpace, activeLargeTeamId, activeLargeTeam,
    setActiveTeamSpaceId, setActiveLargeTeamId, createTeamSpace, updateTeamSpace, createTeamGroup,
  }), [spaces, visibleSpaces, groups, largeTeamsState, activeTeamSpaceId, activeTeamSpace, activeLargeTeamId, activeLargeTeam, setActiveTeamSpaceId, setActiveLargeTeamId, createTeamSpace, updateTeamSpace, createTeamGroup]);

  return <TeamSpaceContext.Provider value={value}>{children}</TeamSpaceContext.Provider>;
}

export function useTeamSpace() {
  const context = React.useContext(TeamSpaceContext);
  if (!context) throw new Error('useTeamSpace 必须在 TeamSpaceProvider 内使用');
  return context;
}
