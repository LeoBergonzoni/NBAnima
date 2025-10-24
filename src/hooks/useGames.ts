'use client';

import useSWR from 'swr';

import type { Locale } from '@/lib/constants';

interface GameTeam {
  id: string;
  name: string;
  city: string | null;
  logo: string | null;
}

export interface GameSummary {
  id: string;
  startsAt: string;
  status: string;
  arena?: string | null;
  homeTeam: GameTeam;
  awayTeam: GameTeam;
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { next: { revalidate: 60 } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to load games');
  }
  return response.json();
};

export const useGames = (locale: Locale) => {
  const timezone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';

  const { data, error, isLoading, mutate } = useSWR<GameSummary[]>(
    `/api/games?locale=${locale}&timezone=${encodeURIComponent(timezone)}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  return {
    games: data ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
};
