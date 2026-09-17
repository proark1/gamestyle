export const TOURNAMENT_POINTS = [10, 6, 3, 1] as const;

export type PlayerScoreEntry = {
  playerId: string;
  score: number;
};

/**
 * Calculates tournament points for a round based on player in-game scores.
 * Handles ties by evenly distributing the pooled rank points.
 * Handles 2v2 team games by awarding winning team 10 pts each, losing team 3 pts each.
 */
export function calculateRoundPoints(
  playerScores: PlayerScoreEntry[],
  isTeamGame = false,
): Record<string, number> {
  if (!playerScores.length) return {};

  const sorted = [...playerScores].sort((a, b) => b.score - a.score);
  const points: Record<string, number> = {};

  if (isTeamGame && sorted.length >= 4) {
    // 2v2 Team format:
    // If top 2 players have identical or higher scores than bottom 2
    const isTie = sorted[0].score === sorted[sorted.length - 1].score;
    if (isTie) {
      for (const p of sorted) {
        points[p.playerId] = 6; // Draw: 6 points each
      }
      return points;
    }

    // Top half gets 10 points each, bottom half gets 3 points each
    const half = Math.ceil(sorted.length / 2);
    for (let i = 0; i < sorted.length; i++) {
      points[sorted[i].playerId] = i < half ? 10 : 3;
    }
    return points;
  }

  // Individual Free-for-all:
  let currentRank = 0;
  let i = 0;
  while (i < sorted.length) {
    const targetScore = sorted[i].score;
    const tiedGroup: string[] = [];

    let j = i;
    while (j < sorted.length && sorted[j].score === targetScore) {
      tiedGroup.push(sorted[j].playerId);
      j++;
    }

    // Calculate average points across the ranks occupied by this tied group
    let pooledPoints = 0;
    for (let k = 0; k < tiedGroup.length; k++) {
      pooledPoints += TOURNAMENT_POINTS[currentRank + k] ?? 1;
    }
    const pointsEach = Math.round(pooledPoints / tiedGroup.length);

    for (const id of tiedGroup) {
      points[id] = pointsEach;
    }

    currentRank += tiedGroup.length;
    i = j;
  }

  return points;
}
