/**
 * How a game tells party mode that its round is over.
 *
 * Every party game marks its root element with `data-party-round`: `playing`
 * while the match runs, `ended` once the final result is on screen. The party
 * ribbon watches for the `ended` value, so it needs no game's class names.
 * Mark only the end of the whole match, never a point, goal, end or wave inside
 * it, or the ribbon offers the standings mid-match.
 */
export type PartyRoundState = 'playing' | 'ended';

export const PARTY_ROUND_ATTRIBUTE = 'data-party-round';

/** Matches a game root whose match has finished. */
export const PARTY_ROUND_ENDED_SELECTOR = `[${PARTY_ROUND_ATTRIBUTE}="ended"]`;

/** Props for a game's root element: `<main {...partyRound(isOver)}>`. */
export function partyRound(ended: boolean): {
  [PARTY_ROUND_ATTRIBUTE]: PartyRoundState;
} {
  return { [PARTY_ROUND_ATTRIBUTE]: ended ? 'ended' : 'playing' };
}
