"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapBalldontliePlayer = exports.balldontlieProvider = void 0;
exports.listTeamPlayers = listTeamPlayers;
exports.listNextNightGames = listNextNightGames;
const logos_1 = require("../../../lib/logos");
const BASE_URL = 'https://api.balldontlie.io/v1';
async function blFetch(endpoint, init) {
    const headers = {
        Accept: 'application/json',
        'User-Agent': 'NBAnima/1.0',
        Authorization: process.env.BALLDONTLIE_API_KEY ?? '',
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
    };
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        ...init,
        headers,
        cache: 'no-store',
        credentials: init?.credentials ?? 'omit',
    });
    if (!res.ok) {
        const err = await res.text().catch(() => '');
        console.error('[Games API]', res.status, err || res.statusText);
        throw new Error(`Balldontlie request failed (${res.status}): ${err}`);
    }
    return res.json();
}
const PER_PAGE = 100;
async function listTeamPlayers(teamId, season) {
    // Balldontlie usa paginazione page/next_page e il filtro season con "seasons[]"
    let page = 1;
    const all = [];
    while (true) {
        const payload = await blFetch(`/players?team_ids[]=${teamId}&seasons[]=${season}&active=true&per_page=${PER_PAGE}&page=${page}`);
        all.push(...(payload.data ?? []));
        const nextPage = payload.meta?.next_page;
        if (!nextPage || nextPage === page) {
            break;
        }
        page = nextPage;
    }
    return all;
}
function nextSlateDateNY(now = new Date()) {
    // Oggi nel fuso America/New_York (senza offset/shift)
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = formatter
        .formatToParts(now)
        .reduce((acc, part) => {
        if (part.type !== 'literal')
            acc[part.type] = part.value;
        return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
}
async function listNextNightGames() {
    // Ora usa la "data di oggi" secondo NY
    const date = nextSlateDateNY();
    const resp = await blFetch(`/games?dates[]=${date}&per_page=${PER_PAGE}`);
    return resp.data ?? [];
}
// Alias invariato per compatibilità con il resto del codice
const fetchNextSlateGames = listNextNightGames;
const mapStatus = (status) => {
    const normalized = status.toLowerCase();
    if (normalized.includes('final'))
        return 'final';
    if (normalized.includes('in progress'))
        return 'in_progress';
    return 'scheduled';
};
const toProviderPlayer = (player) => ({
    id: String(player.id),
    fullName: `${player.first_name} ${player.last_name}`.trim(),
    firstName: player.first_name,
    lastName: player.last_name,
    position: player.position || null,
    teamId: String(player.team?.id ?? ''),
});
const toProviderGame = (game) => ({
    id: String(game.id),
    startsAt: game.datetime ?? game.date,
    status: mapStatus(game.status ?? 'scheduled'),
    homeTeam: {
        id: String(game.home_team.id),
        name: game.home_team.full_name,
        city: null,
        logo: (0, logos_1.getTeamLogoByAbbr)(game.home_team.abbreviation),
        abbreviation: game.home_team.abbreviation,
    },
    awayTeam: {
        id: String(game.visitor_team.id),
        name: game.visitor_team.full_name,
        city: null,
        logo: (0, logos_1.getTeamLogoByAbbr)(game.visitor_team.abbreviation),
        abbreviation: game.visitor_team.abbreviation,
    },
    arena: null,
});
exports.balldontlieProvider = {
    async listNextNightGames() {
        const games = await fetchNextSlateGames();
        return games.map(toProviderGame);
    },
    async listPlayersForGame(gameId) {
        const game = await blFetch(`/games/${gameId}`);
        const season = game.season ?? new Date(game.date).getFullYear();
        const [home, away] = await Promise.all([
            listTeamPlayers(game.home_team.id, season),
            listTeamPlayers(game.visitor_team.id, season),
        ]);
        const seen = new Set();
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
            blFetch(`/games/${gameId}`),
            blFetch(`/stats?game_ids[]=${gameId}&per_page=${PER_PAGE}`),
        ]);
        const winnerTeamId = (game.home_team_score ?? 0) > (game.visitor_team_score ?? 0)
            ? String(game.home_team.id)
            : String(game.visitor_team.id);
        const leadersMap = new Map();
        (stats.data ?? []).forEach((stat) => {
            const playerId = String(stat.player.id);
            const ensure = (category, value) => {
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
        };
    },
};
exports.mapBalldontliePlayer = toProviderPlayer;
