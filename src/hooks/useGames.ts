'use client';

import useSWR from 'swr';

import type { Locale } from '@/lib/constants';

interface GameTeam {
  id: string;
  name: string;
  city: string | null;
  logo: string | null;
  abbreviation?: string | null;
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
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to load games');
  }
  return response.json();
};

export const useGames = (_locale?: Locale) => {
  void _locale;
  const { data, error, isLoading, mutate } = useSWR<GameSummary[]>(
    '/api/games',
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
