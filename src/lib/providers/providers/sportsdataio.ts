import { format } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';

import { getServerEnv } from '../../env';
import { getNextUsNightWindow } from '../../time';
import type {
  GameProvider,
  ProviderBoxScore,
  ProviderGame,
  ProviderPlayer,
} from '../types';

const BASE_URL = 'https://api.sportsdata.io/v3/nba';

interface SportsDataGame {
  GameID: number;
  DateTime: string;
  Status: string;
  HomeTeamID: number;
  AwayTeamID: number;
  HomeTeam: string;
  AwayTeam: string;
  HomeTeamCity: string;
  AwayTeamCity: string;
  StadiumDetails?: { Name?: string | null } | null;
}

interface SportsDataPlayer {
  PlayerID: number;
  FirstName: string;
  LastName: string;
  Position: string | null;
  TeamID: number;
}

interface SportsDataBoxScore {
  Game: {
    HomeScore: number;
    AwayScore: number;
    HomeTeamID: number;
    AwayTeamID: number;
    LeadingScorerPlayerID: number | null;
    LeadingScorerPoints: number | null;
    LeadingAssistsPlayerID: number | null;
    LeadingAssists: number | null;
    LeadingReboundsPlayerID: number | null;
    LeadingRebounds: number | null;
    LeadingThreePointPlayerID: number | null;
    LeadingThreePointFieldGoalsMade: number | null;
  };
  PlayerGames?: SportsDataPlayerGame[];
}

interface SportsDataPlayerGame {
  PlayerID: number;
  Dunks?: number | null;
  FieldGoalsMade?: number | null;
}

const makeRequest = async <T>(path: string): Promise<T> => {
  const { SPORTSDATAIO_API_KEY } = getServerEnv();
  if (!SPORTSDATAIO_API_KEY) {
    throw new Error('SPORTSDATAIO_API_KEY is required for this provider');
  }

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'Ocp-Apim-Subscription-Key': SPORTSDATAIO_API_KEY,
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SportsdataIO request failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<T>;
};

export const sportsDataIoProvider: GameProvider = {
  async listNextNightGames() {
    const { start } = getNextUsNightWindow();
    const date = format(utcToZonedTime(start, 'America/New_York'), 'yyyy-MM-dd');

    const games = await makeRequest<SportsDataGame[]>(
      `/scores/json/GamesByDate/${date}`,
    );

    return games.map<ProviderGame>((game) => ({
      id: String(game.GameID),
      startsAt: game.DateTime,
      status: game.Status === 'Final' ? 'final' : 'scheduled',
      homeTeam: {
        id: String(game.HomeTeamID),
        name: game.HomeTeam,
        city: game.HomeTeamCity,
        logo: null,
      },
      awayTeam: {
        id: String(game.AwayTeamID),
        name: game.AwayTeam,
        city: game.AwayTeamCity,
        logo: null,
      },
      arena: game.StadiumDetails?.Name ?? null,
    }));
  },

  async listPlayersForGame(gameId) {
    const game = await makeRequest<SportsDataGame>(
      `/scores/json/Game/${gameId}`,
    );
    const [homeRoster, awayRoster] = await Promise.all([
      makeRequest<SportsDataPlayer[]>(
        `/scores/json/Players/${game.HomeTeam}`,
      ),
      makeRequest<SportsDataPlayer[]>(
        `/scores/json/Players/${game.AwayTeam}`,
      ),
    ]);

    const allPlayers = [...homeRoster, ...awayRoster];
    const seen = new Set<string>();

    return allPlayers
      .map<ProviderPlayer>((player) => ({
        id: String(player.PlayerID),
        fullName: `${player.FirstName} ${player.LastName}`.trim(),
        firstName: player.FirstName,
        lastName: player.LastName,
        position: player.Position,
        teamId: String(player.TeamID),
      }))
      .filter((player) => {
        if (seen.has(player.id)) {
          return false;
        }
        seen.add(player.id);
        return true;
      });
  },

  async getGameResults(gameId) {
    const summary = await makeRequest<SportsDataBoxScore>(
      `/stats/json/BoxScore/${gameId}`,
    );
    const winnerTeamId =
      summary.Game.HomeScore > summary.Game.AwayScore
        ? String(summary.Game.HomeTeamID)
        : String(summary.Game.AwayTeamID);

    const leaders: ProviderBoxScore['leaders'] = [];

    if (summary.Game.LeadingScorerPlayerID) {
      leaders.push({
        category: 'top_scorer',
        playerId: String(summary.Game.LeadingScorerPlayerID),
        value: Number(summary.Game.LeadingScorerPoints ?? 0),
      });
    }
    if (summary.Game.LeadingAssistsPlayerID) {
      leaders.push({
        category: 'top_assist',
        playerId: String(summary.Game.LeadingAssistsPlayerID),
        value: Number(summary.Game.LeadingAssists ?? 0),
      });
    }
    if (summary.Game.LeadingReboundsPlayerID) {
      leaders.push({
        category: 'top_rebound',
        playerId: String(summary.Game.LeadingReboundsPlayerID),
        value: Number(summary.Game.LeadingRebounds ?? 0),
      });
    }
    if (summary.Game.LeadingThreePointPlayerID) {
      leaders.push({
        category: 'top_threes',
        playerId: String(summary.Game.LeadingThreePointPlayerID),
        value: Number(summary.Game.LeadingThreePointFieldGoalsMade ?? 0),
      });
    }

    const topDunk = summary.PlayerGames?.reduce(
      (acc: { playerId: string | null; value: number }, stat: SportsDataPlayerGame) => {
        const dunks = Number(stat.Dunks ?? stat.FieldGoalsMade ?? 0);
        if (dunks > acc.value) {
          return { playerId: String(stat.PlayerID), value: dunks };
        }
        return acc;
      },
      { playerId: null, value: 0 },
    );

    if (topDunk?.playerId) {
      leaders.push({
        category: 'top_dunk',
        playerId: topDunk.playerId,
        value: topDunk.value,
      });
    }

    return {
      winnerTeamId,
      leaders,
    };
  },
};
