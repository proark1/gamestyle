import type { PartyOutcome, PartyResult } from '../../shared/ui/party-round';

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

/** A human's report for the round; null when they gave up or never sent one. */
export type RoundReports = Record<string, PartyResult | null>;

/**
 * The two sides of a team round. Partners rotate with the round, so over a
 * tournament everyone gets a turn alongside everyone else.
 */
export function roundTeams(
  playerIds: readonly string[],
  round: number,
): [string[], string[]] {
  if (playerIds.length < 4) {
    return [
      playerIds.filter((_, i) => i % 2 === 0),
      playerIds.filter((_, i) => i % 2 === 1),
    ];
  }
  const [first, ...rest] = playerIds;
  const partner = rest[round % rest.length];
  return [[first, partner], rest.filter((id) => id !== partner)];
}

const LEG_VALUE: Record<PartyOutcome, number> = { won: 1, draw: 0.5, lost: 0 };

/**
 * Scores a team round. Each human played their own match, with NPCs standing
 * in for everyone else, so each human's match is one leg of the round, won or
 * lost for that human's side. A side scores the share of legs it took, which
 * gives both teammates the same score. A human who gave up loses their leg.
 *
 * `reports` has an entry for every human in the party.
 */
export function scoreTeamRound(
  teams: [string[], string[]],
  reports: RoundReports,
): Record<string, number> {
  const [first, second] = teams;
  let taken = 0;
  let legs = 0;
  for (const [id, report] of Object.entries(reports)) {
    const value = report?.kind === 'versus' ? LEG_VALUE[report.outcome] : 0;
    taken += first.includes(id) ? value : 1 - value;
    legs++;
  }
  const share = legs ? taken / legs : 0.5;
  const scores: Record<string, number> = {};
  for (const id of first) scores[id] = share;
  for (const id of second) scores[id] = 1 - share;
  return scores;
}

/**
 * Scores a goal round, where every human played alone or with NPC crewmates
 * against the game's own goal or clock. The bots stand in for that goal: a
 * human who cleared it finishes above them, one who failed finishes below
 * them, and one who gave up finishes last. Humans on the same side of the goal
 * are ranked by their score.
 *
 * `reports` has an entry for every human; every other player is a bot. Each
 * player's score is the number of players they beat.
 */
export function scoreGoalRound(
  playerIds: readonly string[],
  reports: RoundReports,
): Record<string, number> {
  const standing = playerIds.map((id) => {
    if (!(id in reports)) return { id, tier: 2, score: 0 };
    const report = reports[id];
    if (report?.kind !== 'goal') return { id, tier: 0, score: 0 };
    return { id, tier: report.cleared ? 3 : 1, score: report.score };
  });
  const beats = (a: (typeof standing)[number], b: (typeof standing)[number]) =>
    a.tier > b.tier || (a.tier === b.tier && a.score > b.score);
  const scores: Record<string, number> = {};
  for (const entry of standing) {
    scores[entry.id] = standing.filter((other) => beats(entry, other)).length;
  }
  return scores;
}
