"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sportsDataIoProvider = void 0;
const date_fns_1 = require("date-fns");
const date_fns_tz_1 = require("date-fns-tz");
const env_1 = require("../../env");
const time_1 = require("../../time");
const BASE_URL = 'https://api.sportsdata.io/v3/nba';
const makeRequest = async (path) => {
    const { SPORTSDATAIO_API_KEY } = (0, env_1.getServerEnv)();
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
    return res.json();
};
exports.sportsDataIoProvider = {
    async listNextNightGames() {
        const { start } = (0, time_1.getNextUsNightWindow)();
        const date = (0, date_fns_1.format)((0, date_fns_tz_1.toZonedTime)(start, 'America/New_York'), 'yyyy-MM-dd');
        const games = await makeRequest(`/scores/json/GamesByDate/${date}`);
        return games.map((game) => ({
            id: String(game.GameID),
            startsAt: game.DateTime,
            status: game.Status === 'Final' ? 'final' : 'scheduled',
            homeTeam: {
                id: String(game.HomeTeamID),
                name: game.HomeTeam,
                city: game.HomeTeamCity,
                logo: null,
                abbreviation: null,
            },
            awayTeam: {
                id: String(game.AwayTeamID),
                name: game.AwayTeam,
                city: game.AwayTeamCity,
                logo: null,
                abbreviation: null,
            },
            arena: game.StadiumDetails?.Name ?? null,
        }));
    },
    async listPlayersForGame(gameId) {
        const game = await makeRequest(`/scores/json/Game/${gameId}`);
        const [homeRoster, awayRoster] = await Promise.all([
            makeRequest(`/scores/json/Players/${game.HomeTeam}`),
            makeRequest(`/scores/json/Players/${game.AwayTeam}`),
        ]);
        const allPlayers = [...homeRoster, ...awayRoster];
        const seen = new Set();
        return allPlayers
            .map((player) => ({
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
        const summary = await makeRequest(`/stats/json/BoxScore/${gameId}`);
        const winnerTeamId = summary.Game.HomeScore > summary.Game.AwayScore
            ? String(summary.Game.HomeTeamID)
            : String(summary.Game.AwayTeamID);
        const leaders = [];
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
        const topDunk = summary.PlayerGames?.reduce((acc, stat) => {
            const dunks = Number(stat.Dunks ?? stat.FieldGoalsMade ?? 0);
            if (dunks > acc.value) {
                return { playerId: String(stat.PlayerID), value: dunks };
            }
            return acc;
        }, { playerId: null, value: 0 });
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
