"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BalldontlieError = void 0;
exports.balldontlieFetch = balldontlieFetch;
exports.fetchGamesByDate = fetchGamesByDate;
exports.fetchStatsForGame = fetchStatsForGame;
// Centralized client for BallDontlie NBA API (ALL-STAR plan).
// All requests attach the Authorization header with the API key as required by the docs.
const env_1 = require("./env");
const BALLDONTLIE_BASE_URL = 'https://api.balldontlie.io/v1';
class BalldontlieError extends Error {
    status;
    details;
    constructor(message, status, details) {
        super(message);
        this.name = 'BalldontlieError';
        this.status = status;
        this.details = details;
    }
}
exports.BalldontlieError = BalldontlieError;
const resolveApiKey = () => {
    const { BALLDONTLIE_API_KEY } = (0, env_1.getServerEnv)();
    if (!BALLDONTLIE_API_KEY) {
        throw new BalldontlieError('BALLDONTLIE_API_KEY is not configured. Add it to the environment for ALL-STAR requests.', 401);
    }
    return BALLDONTLIE_API_KEY;
};
async function balldontlieFetch(path, init) {
    const apiKey = resolveApiKey();
    const headers = {
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
        let errorDetails;
        try {
            errorDetails = await response.json();
        }
        catch {
            errorDetails = await response.text().catch(() => undefined);
        }
        throw new BalldontlieError(`BallDontLie request failed with status ${response.status}`, response.status, errorDetails);
    }
    return response.json();
}
async function fetchGamesByDate(date) {
    const payload = await balldontlieFetch(`/games?dates[]=${encodeURIComponent(date)}&per_page=100`);
    return Array.isArray(payload.data) ? payload.data : [];
}
async function fetchStatsForGame(gameId) {
    const payload = await balldontlieFetch(`/stats?game_ids[]=${encodeURIComponent(String(gameId))}&per_page=100`);
    return Array.isArray(payload.data) ? payload.data : [];
}
