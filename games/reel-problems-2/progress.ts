import type { ReelWorld } from './types';
const KEY = 'reel-problems-2-survival-v1';
export type CampaignProgress = {
  version: 1;
  completed: boolean;
  fast: boolean;
  careful: boolean;
  bestMs: number;
};
export function readProgress(): CampaignProgress {
  const empty: CampaignProgress = {
    version: 1,
    completed: false,
    fast: false,
    careful: false,
    bestMs: 0,
  };
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (
      data?.version !== 1 ||
      typeof data.bestMs !== 'number' ||
      !Number.isFinite(data.bestMs) ||
      data.bestMs < 0
    )
      return empty;
    return {
      version: 1,
      completed: data.completed === true,
      fast: data.fast === true,
      careful: data.careful === true,
      bestMs: data.bestMs,
    };
  } catch {
    return empty;
  }
}
export function saveMissionResult(w: ReelWorld) {
  if (w.phase !== 'won' || !w.mission) return;
  const old = readProgress(),
    elapsed = Math.max(0, w.clock - w.started);
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        completed: true,
        fast: old.fast || elapsed <= 360_000,
        careful:
          old.careful ||
          (w.mission.lost === 0 &&
            !w.mission.cargo.some((c) => c.location === 'water')),
        bestMs: old.bestMs ? Math.min(old.bestMs, elapsed) : elapsed,
      }),
    );
  } catch {
    /* Storage is optional; winning never depends on it. */
  }
}
