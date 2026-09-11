import { useEffect } from 'react';
import type { GameAnalytics, PlayState } from './protocol';
import { SessionTracker, type TrackerEnvironment } from './tracker';

/**
 * A game's reporting handle, created once at module scope so the callbacks
 * that use it never become hook dependencies. Whenever the game mounts again
 * after it was left, the handle follows a new visit.
 */
export class GameTracker {
  private visit?: SessionTracker;

  constructor(
    private readonly definition: GameAnalytics,
    private readonly createEnvironment?: () => TrackerEnvironment,
  ) {}

  private get current() {
    this.visit ??= new SessionTracker(this.definition, this.createEnvironment);
    return this.visit;
  }

  mount() {
    if (this.visit?.finished) this.visit = undefined;
    this.current.start();
  }

  unmount() {
    this.visit?.stop();
  }

  observe(state: PlayState) {
    this.current.observe(state);
  }

  action(name: string) {
    this.current.action(name);
  }

  milestone(key: string) {
    this.current.milestone(key);
  }

  flush() {
    this.visit?.flush();
  }
}

/** Keeps the game's visit open while its component is mounted. */
export function useGameTracker(tracker: GameTracker) {
  useEffect(() => {
    tracker.mount();
    return () => tracker.unmount();
  }, [tracker]);
}
