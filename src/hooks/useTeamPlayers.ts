'use client';

import { useMemo, useRef } from 'react';
import useSWR from 'swr';

type PlayerLite = {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team_id: string;
  jersey?: string | null;
};

type ApiSuccess = {
  ok: true;
  source: string;
  home: PlayerLite[];
  away: PlayerLite[];
};

type ApiError = {
  ok: false;
  error: string;
  missing?: unknown;
};

type ApiResponse = ApiSuccess | ApiError;

type TeamPlayersParams = {
  homeId?: string | number | null;
  homeAbbr?: string | null;
  homeName?: string | null;
  awayId?: string | number | null;
  awayAbbr?: string | null;
  awayName?: string | null;
};

const fetcher = async (url: string): Promise<ApiResponse> => {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    const text = await response.text().catch(() => 'Failed to load players');
    throw new Error(text || 'Failed to load players');
  }
  return response.json();
};

const buildQuery = (params: TeamPlayersParams): string | null => {
  const search = new URLSearchParams();
  if (params.homeId !== undefined && params.homeId !== null) {
    search.set('homeId', String(params.homeId));
  }
  if (params.homeAbbr) {
    search.set('homeAbbr', params.homeAbbr);
  }
  if (params.homeName) {
    search.set('homeName', params.homeName);
  }
  if (params.awayId !== undefined && params.awayId !== null) {
    search.set('awayId', String(params.awayId));
  }
  if (params.awayAbbr) {
    search.set('awayAbbr', params.awayAbbr);
  }
  if (params.awayName) {
    search.set('awayName', params.awayName);
  }
  const query = search.toString();
  return query ? `/api/players?${query}` : null;
};

export function useTeamPlayers(params: TeamPlayersParams) {
  const key = useMemo(() => buildQuery(params), [params]);

  const lastSuccessRef = useRef<ApiSuccess | null>(null);
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  });

  const success = data && 'ok' in data && data.ok;
  if (success) {
    lastSuccessRef.current = data;
  }

  const latestSuccess = lastSuccessRef.current;

  const homePlayers = useMemo(() => {
    if (success && data.ok) {
      return data.home;
    }
    return latestSuccess?.home ?? [];
  }, [success, data, latestSuccess]);

  const awayPlayers = useMemo(() => {
    if (success && data.ok) {
      return data.away;
    }
    return latestSuccess?.away ?? [];
  }, [success, data, latestSuccess]);

  const players = useMemo(
    () => [...homePlayers, ...awayPlayers],
    [homePlayers, awayPlayers],
  );

  const errorMessage = useMemo(() => {
    if (error) {
      return String(error);
    }
    if (data && 'ok' in data && !data.ok) {
      return data.error || 'unresolved teams';
    }
    return null;
  }, [data, error]);

  const missing = useMemo(() => {
    if (success) {
      return [] as string[];
    }
    if (data && 'ok' in data && !data.ok && data.missing) {
      try {
        return [JSON.stringify(data.missing)];
      } catch {
        return ['unresolved teams'];
      }
    }
    return [] as string[];
  }, [data, success]);

  return {
    players,
    homePlayers,
    awayPlayers,
    missing,
    isLoading,
    isError: Boolean(errorMessage),
    error: errorMessage,
    reload: mutate,
  };
}

export type { PlayerLite };
