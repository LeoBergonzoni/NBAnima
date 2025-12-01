'use client';

import { useMemo } from 'react';

export type TeamRecord = {
  wins: number;
  losses: number;
};

/**
 * Placeholder hook for attaching team W–L records near team names.
 * Replace the mocked data below with:
 * - a direct call to `/v1/standings` when upgrading to GOAT, or
 * - a custom calculation built from `/v1/games` history.
 */
export const useTeamRecords = (teamIds: Array<string | number>) => {
  const records = useMemo(() => {
    const map: Record<string, TeamRecord | null> = {};
    teamIds.forEach((id) => {
      map[String(id)] = null; // TODO: fill with real record data once available.
    });
    return map;
  }, [teamIds]);

  return {
    records,
    isLoading: false,
  };
};
