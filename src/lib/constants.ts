export const APP_TITLE = 'NBAnima';

export const SUPPORTED_LOCALES = ['it', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'it';

export const LOCAL_STORAGE_LOCALE_KEY = 'nb-anima-locale';

export const API_PROVIDER = {
  BALDONTLIE: 'balldontlie',
  SPORTSDATAIO: 'sportsdataio',
} as const;

export const LOCK_WINDOW_BUFFER_MINUTES = 5;

export const SCORING = {
  TEAMS_HIT: 30,
  PLAYER_HIT: 50,
  HIGHLIGHTS_RANK_POINTS: [100, 90, 80, 70, 60, 50, 40, 30, 20, 10] as const,
  MULTIPLIERS: [
    { threshold: 10, multiplier: 3 },
    { threshold: 5, multiplier: 2 },
    { threshold: 0, multiplier: 1 },
  ] as const,
};

export const TIMEZONES = {
  US_EASTERN: 'America/New_York',
};

export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  ADMIN: '/admin',
  API_GAMES: '/api/games',
  API_BOXSCORE: '/api/boxscore',
  API_PLAYERS: '/api/players',
  API_PICKS: '/api/picks',
  API_SETTLE: '/api/settle',
} as const;
