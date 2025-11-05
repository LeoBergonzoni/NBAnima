import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { computeDailyScore } = require(path.join(__dirname, '..', 'scoring', 'index.js')) as typeof import('../scoring/index');
import { SCORING } from '../constants';

describe('computeDailyScore player winners', () => {
  it('treats a pick as a win when the player is among multiple winners', () => {
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

    assert.equal(score.hits.players, 1);
    assert.equal(score.basePoints, SCORING.PLAYER_HIT);
    assert.equal(score.totalPoints, SCORING.PLAYER_HIT);
  });

  it('does not double count duplicate winners for the same player', () => {
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

    assert.equal(score.hits.players, 1);
    assert.equal(score.basePoints, SCORING.PLAYER_HIT);
  });
});
