"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUTES = exports.FEATURES = exports.TIMEZONES = exports.SCORING = exports.LOCK_WINDOW_BUFFER_MINUTES = exports.API_PROVIDER = exports.LOCAL_STORAGE_LOCALE_KEY = exports.DEFAULT_LOCALE = exports.SUPPORTED_LOCALES = exports.APP_TITLE = void 0;
exports.APP_TITLE = 'NBAnima';
exports.SUPPORTED_LOCALES = ['it', 'en'];
exports.DEFAULT_LOCALE = 'it';
exports.LOCAL_STORAGE_LOCALE_KEY = 'nb-anima-locale';
exports.API_PROVIDER = {
    BALDONTLIE: 'balldontlie',
    SPORTSDATAIO: 'sportsdataio',
};
exports.LOCK_WINDOW_BUFFER_MINUTES = 5;
exports.SCORING = {
    TEAMS_HIT: 30,
    PLAYER_HIT: 50,
    HIGHLIGHTS_RANK_POINTS: [100, 90, 80, 70, 60, 50, 40, 30, 20, 10],
    MULTIPLIERS: [
        { threshold: 10, multiplier: 3 },
        { threshold: 5, multiplier: 2 },
        { threshold: 0, multiplier: 1 },
    ],
};
exports.TIMEZONES = {
    US_EASTERN: 'America/New_York',
};
exports.FEATURES = {
    HIGHLIGHTS_ENABLED: false,
};
exports.ROUTES = {
    HOME: '/',
    DASHBOARD: '/dashboard',
    ADMIN: '/admin',
    API_GAMES: '/api/games',
    API_BOXSCORE: '/api/boxscore',
    API_PLAYERS: '/api/players',
    API_PICKS: '/api/picks',
    API_SETTLE: '/api/settle',
};
