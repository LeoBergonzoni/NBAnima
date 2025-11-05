import { SCORING } from '../constants';

interface TeamPick {
  gameId: string;
  selectedTeamId: string;
}

interface TeamResult {
  gameId: string;
  winnerTeamId: string;
}

interface PlayerPick {
  gameId: string;
  category: string;
  playerId: string;
}

interface PlayerResult {
  gameId: string;
  category: string;
  playerId: string;
}

interface HighlightPick {
  playerId: string;
  rank: number;
}

interface HighlightResult {
  playerId: string;
  rank: number;
}

export interface DailyScoreInput {
  teamPicks: TeamPick[];
  teamResults: TeamResult[];
  playerPicks: PlayerPick[];
  playerResults: PlayerResult[];
  highlightPicks: HighlightPick[];
  highlightResults: HighlightResult[];
}

export interface DailyScore {
  basePoints: number;
  totalPoints: number;
  hits: {
    teams: number;
    players: number;
    highlights: number;
    total: number;
  };
}

const determineMultiplier = (totalHits: number) => {
  for (const { threshold, multiplier } of SCORING.MULTIPLIERS) {
    if (totalHits >= threshold) {
      return multiplier;
    }
  }
  return 1;
};

type GameCategoryKey = `${string}:${string}`;

const keyFor = (gameId: string, category: string): GameCategoryKey =>
  `${gameId}:${category}`;

export const computeDailyScore = ({
  teamPicks,
  teamResults,
  playerPicks,
  playerResults,
  highlightPicks,
  highlightResults,
}: DailyScoreInput): DailyScore => {
  const teamResultMap = new Map<string, string>();
  teamResults.forEach((result) =>
    teamResultMap.set(result.gameId, result.winnerTeamId),
  );

  const teamHits = teamPicks.filter(
    (pick) => teamResultMap.get(pick.gameId) === pick.selectedTeamId,
  );

  const winnersByKey = new Map<GameCategoryKey, Set<string>>();
  playerResults.forEach((result) => {
    const key = keyFor(result.gameId, result.category);
    if (!winnersByKey.has(key)) {
      winnersByKey.set(key, new Set<string>());
    }
    winnersByKey.get(key)!.add(result.playerId);
  });

  const playerHits = playerPicks.filter(
    (pick) => winnersByKey.get(keyFor(pick.gameId, pick.category))?.has(pick.playerId) ?? false,
  );

  const highlightPointsMap = new Map<string, number>();
  highlightResults.forEach((result) => {
    const index = result.rank - 1;
    const points = SCORING.HIGHLIGHTS_RANK_POINTS[index] ?? 0;
    highlightPointsMap.set(result.playerId, points);
  });

  const highlightHits = highlightPicks.filter((pick) =>
    highlightPointsMap.has(pick.playerId),
  );

  const teamPoints = teamHits.length * SCORING.TEAMS_HIT;
  const playerPoints = playerHits.length * SCORING.PLAYER_HIT;
  const highlightPoints = highlightHits.reduce(
    (acc, pick) => acc + (highlightPointsMap.get(pick.playerId) ?? 0),
    0,
  );

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
