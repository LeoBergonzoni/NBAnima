import type { Locale } from '../../lib/constants';

export interface ProviderTeam {
  id: string;
  name: string;
  city: string | null;
  logo: string | null;
}

export interface ProviderPlayer {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  position: string | null;
  teamId: string;
}

export interface ProviderGame {
  id: string;
  startsAt: string;
  homeTeam: ProviderTeam;
  awayTeam: ProviderTeam;
  arena?: string | null;
  status: 'scheduled' | 'in_progress' | 'final';
}

export interface ProviderBoxScore {
  winnerTeamId: string | null;
  leaders: {
    category: string;
    playerId: string;
    value: number;
  }[];
}

export interface GameProvider {
  listNextNightGames(options: {
    locale: Locale;
    timezone?: string;
  }): Promise<ProviderGame[]>;
  listPlayersForGame(gameId: string): Promise<ProviderPlayer[]>;
  getGameResults(gameId: string): Promise<ProviderBoxScore>;
}
