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
  // opzionale: missing per debug
  missing?: unknown;
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

// normalizza in stringa stabile
const s = (v?: string | number | null) => (v == null ? '' : String(v).trim());

export function useTeamPlayers(params: TeamPlayersParams) {
  // 🔑 chiave SWR deterministica e univoca per ogni matchup
  const homeKey = `${s(params.homeId)}|${s(params.homeAbbr)}|${s(params.homeName)}`;
  const awayKey = `${s(params.awayId)}|${s(params.awayAbbr)}|${s(params.awayName)}`;
  const swrKey = homeKey && awayKey ? (['team-players', homeKey, awayKey] as const) : null;

  const fetcher = async () => {
    const search = new URLSearchParams({
      homeId: s(params.homeId),
      homeAbbr: s(params.homeAbbr),
      homeName: s(params.homeName),
      awayId: s(params.awayId),
      awayAbbr: s(params.awayAbbr),
      awayName: s(params.awayName),
    });

    const res = await fetch(`/api/players?${search.toString()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      // prova a estrarre un json d’errore per messaggi più utili
      let msg = 'Failed to load players';
      try {
        const body = (await res.json()) as ApiError;
        if ('error' in body && body.error) msg = body.error;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    return (await res.json()) as ApiResponse;
  };

  const lastSuccessRef = useRef<ApiSuccess | null>(null);

  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(swrKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 0,     // 👈 evita unione “aggressiva” tra key simili
    keepPreviousData: true,  // 👈 UI più fluida mentre ricarica
  });

  const success = !!data && 'ok' in data && data.ok;
  if (success) {
    lastSuccessRef.current = data as ApiSuccess;
  }

  const latestSuccess = lastSuccessRef.current;

  const homePlayers = useMemo(() => {
    if (success) return (data as ApiSuccess).home;
    return latestSuccess?.home ?? [];
  }, [success, data, latestSuccess]);

  const awayPlayers = useMemo(() => {
    if (success) return (data as ApiSuccess).away;
    return latestSuccess?.away ?? [];
  }, [success, data, latestSuccess]);

  const players = useMemo(() => [...homePlayers, ...awayPlayers], [homePlayers, awayPlayers]);

  const errorMessage = useMemo(() => {
    if (error) return String(error.message ?? error);
    if (data && 'ok' in data && !data.ok) return (data as ApiError).error || 'unresolved teams';
    return null;
  }, [data, error]);

  const missing = useMemo(() => {
    if (success) return [] as string[];
    if (data && 'ok' in data && !data.ok && (data as ApiError).missing) {
      try {
        return [JSON.stringify((data as ApiError).missing)];
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