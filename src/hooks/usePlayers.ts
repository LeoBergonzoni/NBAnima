'use client';

import useSWR from 'swr';

interface PlayerSummary {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  position: string | null;
  teamId: string;
}

const fetcher = async ([, teamId, season]: [string, string, number]) => {
  const params = new URLSearchParams({
    teamId,
    season: String(season),
  });
  const response = await fetch(`/api/players?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to load players');
  }
  return response.json();
};

export const usePlayers = (teamId?: string, season?: number) => {
  const normalizedSeason = season ?? new Date().getFullYear();
  const swrKey = teamId ? (['players', teamId, normalizedSeason] as const) : null;
  const { data, error, isLoading } = useSWR<PlayerSummary[]>(
    swrKey,
    fetcher,
    { revalidateOnFocus: false },
  );

  return {
    players: data ?? [],
    isLoading,
    error,
  };
};
