"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_path_1 = __importDefault(require("node:path"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { computeDailyScore } = require(node_path_1.default.join(__dirname, '..', 'scoring', 'index.js'));
const constants_1 = require("../constants");
(0, node_test_1.describe)('computeDailyScore player winners', () => {
    (0, node_test_1.it)('treats a pick as a win when the player is among multiple winners', () => {
        const score = computeDailyScore({
            teamPicks: [],
            teamResults: [],
            playerPicks: [
                {
                    gameId: 'game-1',
                    category: 'top_scorer',
                    playerId: 'player-a',
                },
            ],
            playerResults: [
                {
                    gameId: 'game-1',
                    category: 'top_scorer',
                    playerId: 'player-a',
                },
                {
                    gameId: 'game-1',
                    category: 'top_scorer',
                    playerId: 'player-b',
                },
            ],
            highlightPicks: [],
            highlightResults: [],
        });
        strict_1.default.equal(score.hits.players, 1);
        strict_1.default.equal(score.basePoints, constants_1.SCORING.PLAYER_HIT);
        strict_1.default.equal(score.totalPoints, constants_1.SCORING.PLAYER_HIT);
    });
    (0, node_test_1.it)('does not double count duplicate winners for the same player', () => {
        const score = computeDailyScore({
            teamPicks: [],
            teamResults: [],
            playerPicks: [
                {
                    gameId: 'game-2',
                    category: 'top_rebound',
                    playerId: 'player-c',
                },
            ],
            playerResults: [
                {
                    gameId: 'game-2',
                    category: 'top_rebound',
                    playerId: 'player-c',
                },
                {
                    gameId: 'game-2',
                    category: 'top_rebound',
                    playerId: 'player-c',
                },
            ],
            highlightPicks: [],
            highlightResults: [],
        });
        strict_1.default.equal(score.hits.players, 1);
        strict_1.default.equal(score.basePoints, constants_1.SCORING.PLAYER_HIT);
    });
    (0, node_test_1.it)('treats matching names as a hit when provider ids differ', () => {
        const score = computeDailyScore({
            teamPicks: [],
            teamResults: [],
            playerPicks: [
                {
                    gameId: 'game-3',
                    category: 'top_assist',
                    playerId: 'local-rosters:brunson',
                    providerPlayerId: 'local-slug',
                    playerName: 'Jalen Brunson',
                },
            ],
            playerResults: [
                {
                    gameId: 'game-3',
                    category: 'top_assist',
                    playerId: 'balldontlie-uuid',
                    providerPlayerId: 'balldontlie-123',
                    playerName: 'Jalen Brunson',
                },
            ],
            highlightPicks: [],
            highlightResults: [],
        });
        strict_1.default.equal(score.hits.players, 1);
        strict_1.default.equal(score.basePoints, constants_1.SCORING.PLAYER_HIT);
    });
});
