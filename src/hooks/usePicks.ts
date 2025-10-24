'use client';

import useSWR from 'swr';

export interface TeamPick {
  gameId: string;
  teamId: string;
}

export interface PlayerPick {
  gameId: string;
  category: string;
  playerId: string;
}

export interface HighlightPick {
  playerId: string;
  rank: number;
}

export interface PicksResponse {
  pickDate: string;
  teams: Array<{
    game_id: string;
    selected_team_id: string;
    updated_at?: string;
    changes_count?: number;
  }>;
  players: Array<{
    game_id: string;
    category: string;
    player_id: string;
    updated_at?: string;
    changes_count?: number;
  }>;
  highlights: Array<{
    player_id: string;
    rank: number;
    updated_at?: string;
    changes_count?: number;
  }>;
  changesCount: number;
}

export interface SavePicksPayload {
  pickDate: string;
  teams: TeamPick[];
  players: PlayerPick[];
  highlights: HighlightPick[];
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to load picks');
  }
  return response.json();
};

const mutatePicks = async (
  payload: SavePicksPayload,
  method: 'POST' | 'PUT',
) => {
  const response = await fetch('/api/picks', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to save picks');
  }

  return response.json();
};

export const usePicks = (pickDate: string) => {
  const { data, error, isLoading, mutate } = useSWR<PicksResponse>(
    `/api/picks?date=${pickDate}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const optimisticBase = () => ({
    pickDate,
    teams: data?.teams ?? [],
    players: data?.players ?? [],
    highlights: data?.highlights ?? [],
    changesCount: data?.changesCount ?? 0,
  });

  const save = async (payload: SavePicksPayload, method: 'POST' | 'PUT') =>
    mutate(
      () => mutatePicks(payload, method),
      {
        optimisticData: {
          ...optimisticBase(),
          teams: payload.teams.map((pick) => ({
            game_id: pick.gameId,
            selected_team_id: pick.teamId,
            changes_count:
              method === 'PUT' ? Math.min((data?.changesCount ?? 0) + 1, 1) : 0,
          })),
          players: payload.players.map((pick) => ({
            game_id: pick.gameId,
            category: pick.category,
            player_id: pick.playerId,
            changes_count:
              method === 'PUT' ? Math.min((data?.changesCount ?? 0) + 1, 1) : 0,
          })),
          highlights: payload.highlights.map((pick) => ({
            player_id: pick.playerId,
            rank: pick.rank,
            changes_count:
              method === 'PUT' ? Math.min((data?.changesCount ?? 0) + 1, 1) : 0,
          })),
          changesCount:
            method === 'PUT'
              ? Math.min((data?.changesCount ?? 0) + 1, 1)
              : data?.changesCount ?? 0,
        },
        rollbackOnError: true,
        revalidate: true,
      },
    );

  return {
    data,
    isLoading,
    error,
    saveInitialPicks: (payload: SavePicksPayload) => save(payload, 'POST'),
    updatePicks: (payload: SavePicksPayload) => save(payload, 'PUT'),
    refresh: mutate,
  };
};
