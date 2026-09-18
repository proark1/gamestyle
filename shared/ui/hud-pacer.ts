/**
 * Decides which snapshots the HUD needs to re-render for.
 *
 * The peer connection ticks every 50ms and hands each game a freshly built
 * snapshot, which goes straight into `setState`. React sees a new identity
 * twenty times a second and re-renders the whole HUD; since no game memoises
 * anything, the largest of them rebuild a several-hundred-element tree at that
 * rate, next to the WebGL frame loop, on phones.
 *
 * The scene does not go through React — it is handed the same snapshot directly
 * — so only the HUD is affected, and a HUD does not need twenty updates a
 * second. What it does need is to react instantly to what a player is waiting
 * for: a round starting, a score changing, a hazard appearing. A game names
 * those with `signal`; everything else waits for the interval.
 *
 * Eight games had each arrived at this rule independently, six of them
 * character for character, with the interval and the watched fields spelled out
 * inline. It deliberately drops a snapshot rather than deferring it: with a
 * continuous feed the next one is along in 50ms, and a deferred publish could
 * land after the player has left the room and put a stale world back on screen.
 */
export type HudPacer<S> = {
  /**
   * True when the HUD should re-render for this snapshot. Assumes the caller
   * then renders it — a call that returns true starts the next interval.
   */
  due(snapshot: S): boolean;
  /** Forget the last snapshot, so the next one renders. Use when leaving a room. */
  reset(): void;
};

/**
 * The gap between routine HUD updates. Below one animation frame the pacing
 * would do nothing; far above this and a changing number starts to look stuck.
 */
export const HUD_INTERVAL_MS = 90;

export function hudPacer<S>(
  /**
   * What must show immediately. Return a primitive, or a template string of the
   * few fields that matter — it is computed for every snapshot, so keep it
   * cheap and free of allocation beyond the string itself.
   */
  signal: (snapshot: S) => unknown,
  options: { interval?: number; now?: () => number } = {},
): HudPacer<S> {
  const { interval = HUD_INTERVAL_MS, now = () => performance.now() } = options;
  const none = Symbol('none');
  let lastSignal: unknown = none;
  let lastAt = -Infinity;
  return {
    due(snapshot) {
      const next = signal(snapshot);
      // The first snapshot, and anything the game called out, cannot wait.
      const important = lastSignal === none || !Object.is(next, lastSignal);
      if (!important && now() - lastAt < interval) return false;
      lastSignal = next;
      lastAt = now();
      return true;
    },
    reset() {
      lastSignal = none;
      lastAt = -Infinity;
    },
  };
}
