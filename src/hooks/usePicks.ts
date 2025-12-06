'use client';

import useSWR from 'swr';

import { TIMEZONES } from '@/lib/constants';
import { useGames } from './useGames';

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
}

export interface GameMetaTeam {
  abbr: string;
  name: string;
  providerTeamId?: string;
}

export interface GameMeta {
  provider: 'balldontlie' | 'stub';
  providerGameId: string;
  gameDateISO: string;
  season: string;
  status?: string;
  home: GameMetaTeam;
  away: GameMetaTeam;
}

export interface PicksResponse {
  pickDate: string;
  teams: Array<{
    game_id: string;
    selected_team_id: string;
    selected_team_abbr?: string | null;
    selected_team_name?: string | null;
    game?: {
      home_team_id?: string | null;
      away_team_id?: string | null;
      home_team_abbr?: string | null;
      away_team_abbr?: string | null;
      home_team_name?: string | null;
      away_team_name?: string | null;
    } | null;
    updated_at?: string;
    changes_count?: number;
  }>;
  players: Array<{
    game_id: string;
    category: string;
    player_id: string;
    player?: {
      provider_player_id?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      position?: string | null;
    } | null;
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
  gamesMeta?: GameMeta[];
  gameUuids: string[];
  gameRefs?: GameRef[];
}

type ClientGameTeamDTO = {
  abbr?: string;
  providerTeamId?: string;
  name?: string;
};

type ClientGameDTO = {
  provider: 'bdl';
  providerGameId: string;
  season: string;
  status: string;
  dateNY: string;
  startTimeUTC?: string | null;
  home: ClientGameTeamDTO;
  away: ClientGameTeamDTO;
};

type GameRef = {
  provider: 'bdl';
  providerGameId: string;
  dto?: ClientGameDTO;
};

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
  const { mapByProviderId } = useGames();

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

  const FORMATTER_NY = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONES.US_EASTERN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const toDateNy = (iso: string | null | undefined, fallback: string) => {
    if (!iso) {
      return fallback;
    }
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      return fallback;
    }
    return FORMATTER_NY.format(parsed);
  };

  const cloneGameRef = (ref: GameRef): GameRef => ({
    provider: ref.provider,
    providerGameId: ref.providerGameId,
    dto: ref.dto
      ? {
          provider: ref.dto.provider,
          providerGameId: ref.dto.providerGameId,
          season: ref.dto.season,
          status: ref.dto.status,
          dateNY: ref.dto.dateNY,
          startTimeUTC: ref.dto.startTimeUTC ?? null,
          home: { ...ref.dto.home },
          away: { ...ref.dto.away },
        }
      : undefined,
  });

  const buildDtoFromMeta = (meta: GameMeta, fallbackDate: string): ClientGameDTO => ({
    provider: 'bdl',
    providerGameId: meta.providerGameId,
    season: meta.season,
    status: meta.status ?? 'scheduled',
    dateNY: toDateNy(meta.gameDateISO ?? null, fallbackDate),
    startTimeUTC: meta.gameDateISO ?? null,
    home: {
      abbr: meta.home?.abbr,
      name: meta.home?.name,
      providerTeamId: meta.home?.providerTeamId,
    },
    away: {
      abbr: meta.away?.abbr,
      name: meta.away?.name,
      providerTeamId: meta.away?.providerTeamId,
    },
  });

  const optimisticBase = () => ({
    pickDate,
    teams: data?.teams ?? [],
    players: data?.players ?? [],
    highlights: data?.highlights ?? [],
    changesCount: data?.changesCount ?? 0,
  });

  const save = async (payload: SavePicksPayload, method: 'POST' | 'PUT') => {
    const sanitizedPayload: SavePicksPayload = {
      ...payload,
      teams: payload.teams.map((pick) => ({ ...pick })),
      players: payload.players.map((pick) => ({ ...pick })),
      highlights: payload.highlights.map((pick) => ({ ...pick })),
      gameRefs: payload.gameRefs ? payload.gameRefs.map(cloneGameRef) : undefined,
    };

    const resolvedUuidSet = new Set<string>();
    const requestedIds = new Set<string>();
    const existingRefs = sanitizedPayload.gameRefs ?? [];
    const seenRefs = new Set(existingRefs.map((ref) => ref.providerGameId));
    const gameRefs: GameRef[] = [...existingRefs];

    sanitizedPayload.gameUuids.forEach((rawId) => {
      if (!rawId) {
        return;
      }

      const mappedUuid = mapByProviderId[rawId];
      if (mappedUuid && isUuid(mappedUuid)) {
        resolvedUuidSet.add(mappedUuid);
        requestedIds.add(mappedUuid);
        return;
      }

      if (isUuid(rawId)) {
        resolvedUuidSet.add(rawId);
        requestedIds.add(rawId);
        return;
      }

      requestedIds.add(rawId);

      if (seenRefs.has(rawId)) {
        return;
      }

      const meta =
        sanitizedPayload.gamesMeta?.find((entry) => entry.providerGameId === rawId) ?? null;

      if (meta) {
        gameRefs.push({
          provider: 'bdl',
          providerGameId: rawId,
          dto: buildDtoFromMeta(meta, sanitizedPayload.pickDate),
        });
      } else {
        gameRefs.push({
          provider: 'bdl',
          providerGameId: rawId,
        });
      }

      seenRefs.add(rawId);
    });

    sanitizedPayload.gameUuids = Array.from(
      new Set([...requestedIds, ...resolvedUuidSet]),
    );
    sanitizedPayload.gameRefs = gameRefs.length > 0 ? gameRefs : undefined;

    return mutate(
      () => mutatePicks(sanitizedPayload, method),
      {
        optimisticData: {
          ...optimisticBase(),
          teams: sanitizedPayload.teams.map((pick) => ({
            game_id: pick.gameId,
            selected_team_id: pick.teamId,
            changes_count:
              method === 'PUT' ? (data?.changesCount ?? 0) + 1 : 0,
          })),
          players: sanitizedPayload.players.map((pick) => ({
            game_id: pick.gameId,
            category: pick.category,
            player_id: pick.playerId,
            changes_count:
              method === 'PUT' ? (data?.changesCount ?? 0) + 1 : 0,
          })),
          highlights: sanitizedPayload.highlights.map((pick, index) => ({
            player_id: pick.playerId,
            rank: index + 1,
            changes_count:
              method === 'PUT' ? (data?.changesCount ?? 0) + 1 : 0,
          })),
          changesCount:
            method === 'PUT'
              ? (data?.changesCount ?? 0) + 1
              : 0,
        },
        rollbackOnError: true,
        revalidate: true,
      },
    );
  };

  return {
    data,
    isLoading,
    error,
    saveInitialPicks: (payload: SavePicksPayload) => save(payload, 'POST'),
    updatePicks: (payload: SavePicksPayload) => save(payload, 'PUT'),
    refresh: mutate,
  };
};
