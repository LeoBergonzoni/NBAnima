'use client';

import { useMemo } from 'react';
import useSWR from 'swr';

type TeamPlayersParams = {
  homeId: string | number;
  awayId: string | number;
  season?: string | number;
};

export type PlayerLite = {
  id: string;
  full_name: string;
  number: string | number | null;
  position: string;
  team_id: string;
  active: boolean;
};

type PlayersResponse =
  | {
      ok: true;
      players: PlayerLite[];
    }
  | {
      ok: false;
      error: string;
    };

const fetcher = async (url: string): Promise<PlayersResponse> => {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    const text = await response.text().catch(() => 'Request failed');
    throw new Error(text || 'Failed to load players');
  }
  return response.json();
};

export function useTeamPlayers({ homeId, awayId, season }: TeamPlayersParams) {
  const key =
    homeId && awayId
      ? `/api/players?home_id=${homeId}&away_id=${awayId}${
          season ? `&season=${season}` : ''
        }`
      : null;

  const { data, error, isLoading, mutate } = useSWR<PlayersResponse>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const players: PlayerLite[] = useMemo(() => {
    if (!data || !('players' in data) || !data.players) {
      return [];
    }
    return [...data.players]
      .filter((player) => player && player.id && player.active !== false)
      .map((player) => ({
        ...player,
        id: String(player.id),
        team_id: String(player.team_id),
        position: player.position ?? '',
      }))
      .sort((a, b) =>
        a.full_name.localeCompare(b.full_name, 'en', { sensitivity: 'base' }),
      );
  }, [data]);

  return {
    players,
    isLoading,
    isError: Boolean(error) || data?.ok === false,
    error: error
      ? String(error)
      : data?.ok === false
        ? String(data.error || 'Failed to load players')
        : null,
    reload: mutate,
  };
}
