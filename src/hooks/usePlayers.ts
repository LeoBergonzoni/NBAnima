'use client';

import { useMemo } from 'react';
import useSWR from 'swr';

import type { PlayerLite } from './useTeamPlayers';

type Rosters = Record<string, { id: string; name: string; pos?: string; jersey?: string }[]>;

interface PlayerSummary {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  position: string | null;
  teamId: string;
}

interface UsePlayersParams {
  teamId?: string | number;
  teamName?: string;
  triCode?: string | null;
}

const fetchRosters = async (): Promise<Rosters> => {
  const response = await fetch('/rosters.json', { cache: 'force-cache', credentials: 'omit' });
  if (!response.ok) {
    throw new Error('Failed to load rosters.json');
  }
  return response.json();
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toLookupKeys = ({ teamId, teamName, triCode }: UsePlayersParams): string[] => {
  const keys = new Set<string>();
  if (teamId !== undefined && teamId !== null && `${teamId}`.trim() !== '') {
    keys.add(`${teamId}`.trim());
  }
  if (triCode) {
    const trimmed = triCode.trim();
    if (trimmed) {
      keys.add(trimmed.toUpperCase());
    }
  }
  if (teamName) {
    const trimmed = teamName.trim();
    if (trimmed) {
      keys.add(slugify(trimmed));
      keys.add(trimmed.toUpperCase());
    }
  }
  return Array.from(keys);
};

const mapPlayer = (player: PlayerLite): PlayerSummary => ({
  id: player.id,
  fullName: player.full_name,
  firstName: player.first_name,
  lastName: player.last_name,
  position: player.position || null,
  teamId: player.team_id,
});

export const usePlayers = ({ teamId, teamName, triCode }: UsePlayersParams) => {
  const { data, error, isLoading } = useSWR<Rosters>('local-rosters', fetchRosters, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const keys = useMemo(() => toLookupKeys({ teamId, teamName, triCode }), [teamId, teamName, triCode]);

  const players = useMemo(() => {
    if (!data) {
      return [] as PlayerSummary[];
    }
    for (const key of keys) {
      const roster = data[key];
      if (roster && roster.length) {
        const mapped: PlayerLite[] = roster.map((player) => {
          const fullName = player.name ? player.name.replace(/\s+/g, ' ').trim() : `Player ${player.id}`;
          const parts = fullName.split(' ');
          const firstName = parts[0] ?? fullName;
          const lastName = parts.slice(1).join(' ');
          return {
            id: player.id,
            full_name: fullName,
            first_name: firstName,
            last_name: lastName,
            position: player.pos ?? '',
            team_id: key,
            jersey: player.jersey,
          } satisfies PlayerLite;
        });
        return mapped.map(mapPlayer);
      }
    }
    return [] as PlayerSummary[];
  }, [data, keys]);

  return { players, isLoading, error };
};
