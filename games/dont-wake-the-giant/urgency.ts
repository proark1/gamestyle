import type { GiantWorld } from './types';

export const ESCAPE_WARNING_MS = 20_000;
export const WAKE_DELAY_MS = 3000;
export const GIANT_SHOUT =
  'What are you doing here? Why are you stealing my stuff? I will get you!';

/** The normal deadline includes the existing three-second waking reaction. */
export function untilGiantWakes(w: GiantWorld) {
  const scheduled = w.deadline + WAKE_DELAY_MS;
  return (
    Math.min(scheduled, w.pending?.kind === 'wake' ? w.pending.at : scheduled) -
    w.clock
  );
}

export function escapeWarning(w: GiantWorld) {
  return w.phase === 'playing' && untilGiantWakes(w) <= ESCAPE_WARNING_MS;
}
