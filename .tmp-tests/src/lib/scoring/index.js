"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDailyScore = void 0;
const constants_1 = require("../constants");
const determineMultiplier = (totalHits) => {
    for (const { threshold, multiplier } of constants_1.SCORING.MULTIPLIERS) {
        if (totalHits >= threshold) {
            return multiplier;
        }
    }
    return 1;
};
const keyFor = (gameId, category) => `${gameId}:${category}`;
const normalize = (value) => (value ?? '').trim().toLowerCase();
const normalizeName = (value) => normalize(value)
    .replace(/[^a-z0-9]/g, '')
    .trim();
const collectIdentifiers = (playerId, providerPlayerId, playerName) => {
    const ids = new Set();
    const normalizedPrimary = normalize(playerId);
    if (normalizedPrimary) {
        ids.add(normalizedPrimary);
    }
    const normalizedProvider = normalize(providerPlayerId);
    if (normalizedProvider) {
        ids.add(normalizedProvider);
    }
    const normalizedName = normalizeName(playerName);
    if (normalizedName) {
        ids.add(normalizedName);
    }
    return ids;
};
const computeDailyScore = ({ teamPicks, teamResults, playerPicks, playerResults, highlightPicks, highlightResults, }) => {
    const teamResultMap = new Map();
    teamResults.forEach((result) => teamResultMap.set(result.gameId, result.winnerTeamId));
    const teamHits = teamPicks.filter((pick) => teamResultMap.get(pick.gameId) === pick.selectedTeamId);
    const winnersByKey = new Map();
    playerResults.forEach((result) => {
        const key = keyFor(result.gameId, result.category);
        if (!winnersByKey.has(key)) {
            winnersByKey.set(key, new Set());
        }
        const identifiers = collectIdentifiers(result.playerId, result.providerPlayerId, result.playerName);
        identifiers.forEach((id) => winnersByKey.get(key).add(id));
    });
    const playerHits = playerPicks.filter((pick) => {
        const key = keyFor(pick.gameId, pick.category);
        const winners = winnersByKey.get(key);
        if (!winners) {
            return false;
        }
        const identifiers = collectIdentifiers(pick.playerId, pick.providerPlayerId, pick.playerName);
        return Array.from(identifiers).some((id) => winners.has(id));
    });
    const highlightPointsMap = new Map();
    highlightResults.forEach((result) => {
        const index = result.rank - 1;
        const points = constants_1.SCORING.HIGHLIGHTS_RANK_POINTS[index] ?? 0;
        const identifiers = collectIdentifiers(result.playerId, result.providerPlayerId, result.playerName);
        identifiers.forEach((id) => {
            const existing = highlightPointsMap.get(id);
            if (existing == null || points > existing) {
                highlightPointsMap.set(id, points);
            }
        });
    });
    const highlightHits = highlightPicks.filter((pick) => {
        const identifiers = collectIdentifiers(pick.playerId, pick.providerPlayerId, pick.playerName);
        return Array.from(identifiers).some((id) => highlightPointsMap.has(id));
    });
    const teamPoints = teamHits.length * constants_1.SCORING.TEAMS_HIT;
    const playerPoints = playerHits.length * constants_1.SCORING.PLAYER_HIT;
    const highlightPoints = highlightHits.reduce((acc, pick) => {
        const identifiers = collectIdentifiers(pick.playerId, pick.providerPlayerId, pick.playerName);
        const maxPoints = Array.from(identifiers).reduce((max, id) => Math.max(max, highlightPointsMap.get(id) ?? 0), 0);
        return acc + maxPoints;
    }, 0);
    const basePoints = teamPoints + playerPoints + highlightPoints;
    const totalHits = teamHits.length + playerHits.length + highlightHits.length;
    const multiplier = determineMultiplier(totalHits);
    return {
        basePoints,
        totalPoints: basePoints * multiplier,
        hits: {
            teams: teamHits.length,
            players: playerHits.length,
            highlights: highlightHits.length,
            total: totalHits,
        },
    };
};
exports.computeDailyScore = computeDailyScore;
