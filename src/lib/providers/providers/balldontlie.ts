import { formatISO } from 'date-fns';

import { getNextUsNightWindow } from '../../time';
import type {
  GameProvider,
  ProviderBoxScore,
  ProviderGame,
  ProviderPlayer,
} from '../types';

const BASE_URL = 'https://api.balldontlie.io/v1';

export async function fetchFromBalldontlie(endpoint: string) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Authorization: process.env.BALLDONTLIE_API_KEY ?? '',
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Balldontlie request failed (${res.status}): ${err}`);
  }

  return res.json();
}

interface BalldontlieTeam {
  id: number;
  full_name: string;
  city: string;
}

interface BalldontlieGame {
  id: number;
  date: string;
  status: string;
  arena?: string | null;
  home_team: BalldontlieTeam;
  visitor_team: BalldontlieTeam;
  home_team_score: number;
  visitor_team_score: number;
}

interface BalldontliePlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string | null;
  team: BalldontlieTeam | null;
}

interface BalldontlieStat {
  player: { id: number };
  pts: number;
  ast: number;
  reb: number;
  dunk?: number | null;
  fgm?: number | null;
  fg3m?: number | null;
}

const mapStatus = (status: string): ProviderGame['status'] => {
  if (status.toLowerCase().includes('final')) {
    return 'final';
  }
  if (status.toLowerCase().includes('in progress')) {
    return 'in_progress';
  }
  return 'scheduled';
};

const makeRequest = async <T>(
  path: string,
  searchParams: Record<string, string | number | undefined> = {},
): Promise<T> => {
  const url = new URL(path, BASE_URL);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const relativeEndpoint = `${url.pathname}${url.search}`;
  return fetchFromBalldontlie(relativeEndpoint) as Promise<T>;
};

export const balldontlieProvider: GameProvider = {
  async listNextNightGames() {
    const { start, end } = getNextUsNightWindow();
    const data = await makeRequest<{ data: BalldontlieGame[] }>('/games', {
      start_date: formatISO(start, { representation: 'date' }),
      end_date: formatISO(end, { representation: 'date' }),
      per_page: 100,
    });

    return data.data.map<ProviderGame>((game) => ({
      id: String(game.id),
      startsAt: game.date,
      arena: game.arena ?? null,
      homeTeam: {
        id: String(game.home_team.id),
        name: game.home_team.full_name,
        city: game.home_team.city,
        logo: null,
      },
      awayTeam: {
        id: String(game.visitor_team.id),
        name: game.visitor_team.full_name,
        city: game.visitor_team.city,
        logo: null,
      },
      status: mapStatus(game.status ?? 'scheduled'),
    }));
  },

  async listPlayersForGame(gameId) {
    const game = await makeRequest<BalldontlieGame>(`/games/${gameId}`);
    const teamIds = [game.home_team.id, game.visitor_team.id];

    const results = await Promise.all(
      teamIds.map((teamId: number) =>
        makeRequest<{ data: BalldontliePlayer[] }>('/players', {
          'team_ids[]': teamId,
          per_page: 100,
        }),
      ),
    );

    const seen = new Set<string>();

    return results.flatMap((result) =>
      result.data
        .map<ProviderPlayer>((player) => ({
          id: String(player.id),
          fullName: `${player.first_name} ${player.last_name}`.trim(),
          firstName: player.first_name,
          lastName: player.last_name,
          position: player.position || null,
          teamId: String(player.team?.id ?? ''),
        }))
        .filter((player) => {
          if (!player.id || seen.has(player.id)) {
            return false;
          }
          seen.add(player.id);
          return true;
        }),
    );
  },

  async getGameResults(gameId) {
    const [game, stats] = await Promise.all([
      makeRequest<BalldontlieGame>(`/games/${gameId}`),
      makeRequest<{ data: BalldontlieStat[] }>('/stats', {
        'game_ids[]': gameId,
        per_page: 100,
      }),
    ]);

    const winnerTeamId =
      game.home_team_score > game.visitor_team_score
        ? String(game.home_team?.id)
        : String(game.visitor_team?.id);

    const leadersMap = new Map<string, { playerId: string; value: number }>();

    stats.data.forEach((stat) => {
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
