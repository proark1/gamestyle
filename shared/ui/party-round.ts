/**
 * How a game tells party mode that its round is over, and how it went.
 *
 * Every party game marks its root element with `data-party-round`: `playing`
 * while the match runs, `ended` once the final result is on screen. The party
 * ribbon watches for the `ended` value, so it needs no game's class names.
 * Mark only the end of the whole match, never a point, goal, end or wave inside
 * it, or the ribbon offers the standings mid-match.
 *
 * An ended root also carries `data-party-result`, the player's result as JSON.
 * The ribbon reports the first result it sees, so a rematch afterwards changes
 * nothing.
 */
export type PartyRoundState = 'playing' | 'ended';

export const PARTY_ROUND_ATTRIBUTE = 'data-party-round';
export const PARTY_RESULT_ATTRIBUTE = 'data-party-result';

/** Matches a game root whose match has finished. */
export const PARTY_ROUND_ENDED_SELECTOR = `[${PARTY_ROUND_ATTRIBUTE}="ended"]`;

export type PartyOutcome = 'won' | 'lost' | 'draw';

/**
 * One player's result in the shared match. Teammates report the same outcome;
 * the coordinator awards humans points without inventing tournament teams.
 *
 * - `versus`: two sides played each other, and `outcome` is how the local
 *   player's side did. Every team game (`teams: true` in the playlist)
 *   reports this.
 * - `goal`: the player, alone or with crewmates, played against the
 *   game's own goal or clock. `cleared` says whether they beat it. `score`
 *   ranks two players who both cleared it, or both failed: higher is better,
 *   and it only has to be comparable between two plays of the same game.
 */
export type PartyResult =
  | { kind: 'versus'; outcome: PartyOutcome }
  | { kind: 'goal'; cleared: boolean; score: number };

/**
 * A team game's result for the local player's `side`. `winner` is the winning
 * side, or 'draw'. A match that ended without a winner counts as a draw.
 */
export function partyVersus(
  side: string | undefined,
  winner: string | null | undefined,
): PartyResult {
  if (!winner || winner === 'draw') return { kind: 'versus', outcome: 'draw' };
  return { kind: 'versus', outcome: winner === side ? 'won' : 'lost' };
}

/** The side with the highest score, or 'draw' when the top is shared. */
export function leadingSide(scores: Record<string, number>): string {
  let best = 'draw';
  let top = -Infinity;
  for (const [side, score] of Object.entries(scores)) {
    if (score > top) {
      top = score;
      best = side;
    } else if (score === top) {
      best = 'draw';
    }
  }
  return best;
}

/** A goal game's result. A score that is not a finite number counts as 0. */
export function partyGoal(cleared: boolean, score: number): PartyResult {
  return {
    kind: 'goal',
    cleared,
    score: Number.isFinite(score) ? score : 0,
  };
}

/**
 * Props for a game's root element:
 * `<main {...partyRound(isOver, isOver ? partyGoal(won, points) : null)}>`.
 * The result is published only once the round has ended.
 */
export function partyRound(
  ended: boolean,
  result: PartyResult | null,
): {
  [PARTY_ROUND_ATTRIBUTE]: PartyRoundState;
  [PARTY_RESULT_ATTRIBUTE]?: string;
} {
  if (!ended) return { [PARTY_ROUND_ATTRIBUTE]: 'playing' };
  return result
    ? {
        [PARTY_ROUND_ATTRIBUTE]: 'ended',
        [PARTY_RESULT_ATTRIBUTE]: JSON.stringify(result),
      }
    : { [PARTY_ROUND_ATTRIBUTE]: 'ended' };
}

const OUTCOMES: readonly unknown[] = ['won', 'lost', 'draw'];

/**
 * Checks a result that came from outside (a DOM attribute or a request body)
 * and returns a clean copy, or null when it is not a valid result.
 */
export function parsePartyResult(value: unknown): PartyResult | null {
  if (typeof value === 'string') {
    try {
      return parsePartyResult(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.kind === 'versus' && OUTCOMES.includes(raw.outcome)) {
    return { kind: 'versus', outcome: raw.outcome as PartyOutcome };
  }
  if (
    raw.kind === 'goal' &&
    typeof raw.cleared === 'boolean' &&
    typeof raw.score === 'number' &&
    Number.isFinite(raw.score)
  ) {
    return { kind: 'goal', cleared: raw.cleared, score: raw.score };
  }
  return null;
}

/** The result a finished game has published under `root`, if any. */
export function readPartyResult(root: ParentNode): PartyResult | null {
  const ended = root.querySelector(PARTY_ROUND_ENDED_SELECTOR);
  return parsePartyResult(ended?.getAttribute(PARTY_RESULT_ATTRIBUTE));
}
