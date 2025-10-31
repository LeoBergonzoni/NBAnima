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

  const mapByProviderId = (Array.isArray(data) ? data : []).reduce<Record<string, string>>(
    (acc, game) => {
      const providerId = (game as unknown as { provider_game_id?: string })?.provider_game_id;
      const supabaseId = (game as unknown as { id?: string })?.id;
      if (providerId && typeof providerId === 'string' && supabaseId && typeof supabaseId === 'string') {
        acc[providerId] = supabaseId;
      }
      return acc;
    },
    {},
  );

  return {
    games: data ?? [],
    isLoading,
    error,
    refresh: mutate,
    mapByProviderId,
  };
};
