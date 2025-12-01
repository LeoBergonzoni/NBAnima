// Centralized client for BallDontlie NBA API (ALL-STAR plan).
// All requests attach the Authorization header with the API key as required by the docs.
import { getServerEnv } from './env';

const BALLDONTLIE_BASE_URL = 'https://api.balldontlie.io/v1';

type BalldontlieListResponse<T> = {
  data?: T[];
  meta?: Record<string, unknown>;
};

export type BalldontlieTeam = {
  id: number;
  abbreviation?: string | null;
  full_name: string;
};

export type BalldontlieGame = {
  id: number;
  date: string;
  status: string;
  home_team: BalldontlieTeam;
  visitor_team: BalldontlieTeam;
  home_team_score?: number;
  visitor_team_score?: number;
};

export type BalldontlieStat = {
  id?: number;
  player: {
    id: number;
    first_name: string;
    last_name: string;
  };
  team: BalldontlieTeam;
  pts?: number | null;
  reb?: number | null;
  ast?: number | null;
};

export class BalldontlieError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'BalldontlieError';
    this.status = status;
    this.details = details;
  }
}

const resolveApiKey = () => {
  const { BALLDONTLIE_API_KEY } = getServerEnv();
  if (!BALLDONTLIE_API_KEY) {
    throw new BalldontlieError(
      'BALLDONTLIE_API_KEY is not configured. Add it to the environment for ALL-STAR requests.',
      401,
    );
  }
  return BALLDONTLIE_API_KEY;
};

export async function balldontlieFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = resolveApiKey();
  const headers: HeadersInit = {
    Accept: 'application/json',
    Authorization: apiKey,
    ...(init?.headers ?? {}),
  };

  const response = await fetch(`${BALLDONTLIE_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    let errorDetails: unknown;
    try {
      errorDetails = await response.json();
    } catch {
      errorDetails = await response.text().catch(() => undefined);
    }
    throw new BalldontlieError(
      `BallDontLie request failed with status ${response.status}`,
      response.status,
      errorDetails,
    );
  }

  return response.json() as Promise<T>;
}

export async function fetchGamesByDate(date: string): Promise<BalldontlieGame[]> {
  const payload = await balldontlieFetch<BalldontlieListResponse<BalldontlieGame>>(
    `/games?dates[]=${encodeURIComponent(date)}&per_page=100`,
  );
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function fetchStatsForGame(gameId: number | string): Promise<BalldontlieStat[]> {
  const payload = await balldontlieFetch<BalldontlieListResponse<BalldontlieStat>>(
    `/stats?game_ids[]=${encodeURIComponent(String(gameId))}&per_page=100`,
  );
  return Array.isArray(payload.data) ? payload.data : [];
}
