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

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to load players');
  }
  return response.json();
};

export const usePlayers = (gameId?: string) => {
  const { data, error, isLoading } = useSWR<PlayerSummary[]>(
    gameId ? `/api/players?gameId=${gameId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  return {
    players: data ?? [],
    isLoading,
    error,
  };
};
