'use client';

import { useMemo } from 'react';
import useSWR from 'swr';

export type PlayerLite = {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team_id: string;
  jersey?: string;
};

type PlayerResponse = {
  id: string;
  name: string;
  pos?: string;
  jersey?: string;
};

type PlayersApiResponse =
  | {
      ok: true;
      players: { home: PlayerResponse[]; away: PlayerResponse[] };
      source: string;
      missing?: string[];
    }
  | { ok: false; error: string };

type TeamPlayersParams = {
  homeId?: string | number | null;
  homeAbbr?: string | null;
  homeName?: string | null;
  awayId?: string | number | null;
  awayAbbr?: string | null;
  awayName?: string | null;
};

const fetcher = async (url: string): Promise<PlayersApiResponse> => {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) {
    const text = await response.text().catch(() => 'Failed to load players');
    throw new Error(text || 'Failed to load players');
  }
  return response.json();
};

const toLite = (players: PlayerResponse[], teamId: string): PlayerLite[] =>
  players.map((player) => {
    const fullName = player.name ? player.name.replace(/\s+/g, ' ').trim() : `Player ${player.id}`;
    const parts = fullName.split(' ');
    const firstName = parts[0] ?? fullName;
    const lastName = parts.slice(1).join(' ');
    return {
      id: player.id,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      position: player.pos?.toUpperCase?.() ?? '',
      team_id: teamId,
      jersey: player.jersey,
    } satisfies PlayerLite;
  });

export function useTeamPlayers({
  homeId,
  homeAbbr,
  homeName,
  awayId,
  awayAbbr,
  awayName,
}: TeamPlayersParams) {
  const homeIdString = homeId !== undefined && homeId !== null ? String(homeId) : '';
  const awayIdString = awayId !== undefined && awayId !== null ? String(awayId) : '';

  const hasHomeIdentifier = Boolean(homeIdString || homeAbbr || homeName);
  const hasAwayIdentifier = Boolean(awayIdString || awayAbbr || awayName);

  const searchParams = useMemo(() => {
    if (!hasHomeIdentifier || !hasAwayIdentifier) {
      return null;
    }
    const params = new URLSearchParams();
    if (homeIdString) params.set('homeId', homeIdString);
    if (homeAbbr) params.set('homeAbbr', homeAbbr);
    if (homeName) params.set('homeName', homeName);
    if (awayIdString) params.set('awayId', awayIdString);
    if (awayAbbr) params.set('awayAbbr', awayAbbr);
    if (awayName) params.set('awayName', awayName);
    return params.toString();
  }, [hasHomeIdentifier, hasAwayIdentifier, homeIdString, homeAbbr, homeName, awayIdString, awayAbbr, awayName]);

  const key = searchParams ? `/api/players?${searchParams}` : null;

  const { data, error, isLoading, mutate } = useSWR<PlayersApiResponse>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const homePlayers = useMemo(() => {
    if (!data || !('ok' in data) || !data.ok) {
      return [] as PlayerLite[];
    }
    return toLite(data.players.home ?? [], homeIdString || homeAbbr || homeName || 'home');
  }, [data, homeAbbr, homeIdString, homeName]);

  const awayPlayers = useMemo(() => {
    if (!data || !('ok' in data) || !data.ok) {
      return [] as PlayerLite[];
    }
    return toLite(data.players.away ?? [], awayIdString || awayAbbr || awayName || 'away');
  }, [data, awayAbbr, awayIdString, awayName]);

  const players = useMemo(
    () => [...homePlayers, ...awayPlayers],
    [homePlayers, awayPlayers],
  );

  const missing = useMemo(() => {
    if (!data || !('ok' in data) || !data.ok) {
      return [] as string[];
    }
    return data.missing ?? [];
  }, [data]);

  return {
    players,
    homePlayers,
    awayPlayers,
    missing,
    isLoading,
    isError: Boolean(error) || (data !== undefined && 'ok' in data && data.ok === false),
    error: error
      ? String(error)
      : data && 'ok' in data && data.ok === false
        ? String(data.error)
        : null,
    reload: mutate,
  };
}
