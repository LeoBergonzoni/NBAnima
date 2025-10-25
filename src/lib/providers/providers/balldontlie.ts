import { addDays } from 'date-fns';

import { getTeamLogoByAbbr } from '@/lib/logos';

import type {
  GameProvider,
  ProviderBoxScore,
  ProviderGame,
  ProviderPlayer,
} from '../types';

const BASE_URL = 'https://api.balldontlie.io/v1';

async function blFetch<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      Authorization: process.env.BALLDONTLIE_API_KEY ?? '',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Balldontlie request failed (${res.status}): ${err}`);
  }

  return res.json() as Promise<T>;
}

export type BLPlayer = {
  id: number;
  first_name: string;
  last_name: string;
  position: string | null;
  height: string | null;
  weight: string | null;
  team: {
    id: number;
    abbreviation: string;
    full_name: string;
  };
};

export type BLGame = {
  id: number;
  date: string;
  home_team: {
    id: number;
    abbreviation: string;
    full_name: string;
  };
  visitor_team: {
    id: number;
    abbreviation: string;
    full_name: string;
  };
  season: number;
  status: string;
  home_team_score?: number;
  visitor_team_score?: number;
};

type BLList<T> = { data: T[]; meta?: { next_cursor?: number | null } };

const PER_PAGE = 100;

export async function listTeamPlayers(
  teamId: number,
  season: number,
): Promise<BLPlayer[]> {
  let next: number | null | undefined = 0;
  const all: BLPlayer[] = [];

  while (next !== null) {
    const cursorParam: string =
      typeof next === 'number' && next > 0 ? `&cursor=${next}` : '';
    const page = await blFetch<BLList<BLPlayer>>(
      `/players?team_ids[]=${teamId}&season=${season}&per_page=${PER_PAGE}${cursorParam}`,
    );
    all.push(...(page.data ?? []));
    next = page.meta?.next_cursor ?? null;
  }

  return all;
}

function nextSlateDateNY(now = new Date()): string {
  // Oggi nel fuso America/New_York (senza offset/shift)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export async function listNextNightGames(): Promise<BLGame[]> {
  // Ora usa la "data di oggi" secondo NY
  const date = nextSlateDateNY();
  const resp = await blFetch<BLList<BLGame>>(`/games?dates[]=${date}&per_page=${PER_PAGE}`);
  return resp.data ?? [];
}

// Alias invariato per compatibilità con il resto del codice
const fetchNextSlateGames = listNextNightGames;

const mapStatus = (status: string): ProviderGame['status'] => {
  const normalized = status.toLowerCase();
  if (normalized.includes('final')) return 'final';
  if (normalized.includes('in progress')) return 'in_progress';
  return 'scheduled';
};

const toProviderPlayer = (player: BLPlayer): ProviderPlayer => ({
  id: String(player.id),
  fullName: `${player.first_name} ${player.last_name}`.trim(),
  firstName: player.first_name,
  lastName: player.last_name,
  position: player.position || null,
  teamId: String(player.team?.id ?? ''),
});

const toProviderGame = (game: BLGame): ProviderGame => ({
  id: String(game.id),
  startsAt: game.date,
  status: mapStatus(game.status ?? 'scheduled'),
  homeTeam: {
    id: String(game.home_team.id),
    name: game.home_team.full_name,
    city: null,
    logo: getTeamLogoByAbbr(game.home_team.abbreviation),
    abbreviation: game.home_team.abbreviation,
  },
  awayTeam: {
    id: String(game.visitor_team.id),
    name: game.visitor_team.full_name,
    city: null,
    logo: getTeamLogoByAbbr(game.visitor_team.abbreviation),
    abbreviation: game.visitor_team.abbreviation,
  },
  arena: null,
});

interface BalldontlieStat {
  player: { id: number };
  pts: number;
  ast: number;
  reb: number;
  dunk?: number | null;
  fgm?: number | null;
  fg3m?: number | null;
}

export const balldontlieProvider: GameProvider = {
  async listNextNightGames() {
    const games = await fetchNextSlateGames();
    return games.map(toProviderGame);
  },

  async listPlayersForGame(gameId) {
    const game = await blFetch<BLGame>(`/games/${gameId}`);
    const season = game.season ?? new Date(game.date).getFullYear();
    const [home, away] = await Promise.all([
      listTeamPlayers(game.home_team.id, season),
      listTeamPlayers(game.visitor_team.id, season),
    ]);

    const seen = new Set<string>();
    return [...home, ...away]
      .map(toProviderPlayer)
      .filter((player) => {
        if (!player.id || seen.has(player.id)) {
          return false;
        }
        seen.add(player.id);
        return true;
      });
  },

  async getGameResults(gameId) {
    const [game, stats] = await Promise.all([
      blFetch<BLGame>(`/games/${gameId}`),
      blFetch<BLList<BalldontlieStat>>(`/stats?game_ids[]=${gameId}&per_page=${PER_PAGE}`),
    ]);

    const winnerTeamId =
      (game.home_team_score ?? 0) > (game.visitor_team_score ?? 0)
        ? String(game.home_team.id)
        : String(game.visitor_team.id);

    const leadersMap = new Map<string, { playerId: string; value: number }>();

    (stats.data ?? []).forEach((stat) => {
      const playerId = String(stat.player.id);
      const ensure = (category: string, value: number) => {
        const existing = leadersMap.get(category);
        if (!existing || existing.value < value) {
          leadersMap.set(category, { playerId, value });
        }
      };

      ensure('top_scorer', Number(stat.pts ?? 0));
      ensure('top_assist', Number(stat.ast ?? 0));
      ensure('top_rebound', Number(stat.reb ?? 0));
      ensure('top_dunk', Number(stat.dunk ?? stat.fgm ?? 0));
      ensure('top_threes', Number(stat.fg3m ?? 0));
    });

    return {
      winnerTeamId,
      leaders: Array.from(leadersMap.entries()).map(([category, data]) => ({
        category,
        playerId: data.playerId,
        value: data.value,
      })),
    } satisfies ProviderBoxScore;
  },
};

export const mapBalldontliePlayer = toProviderPlayer;
