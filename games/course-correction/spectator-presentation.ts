import type { CourseEvent, CourseEventKind } from './types';

export type SpectatorReaction = {
  eventId: number;
  intensity: number;
  duration: number;
};

const INTENSITY: Partial<Record<CourseEventKind, number>> = {
  impact: 0.18,
  wall: 0.46,
  bridge: 0.5,
  recover: 0.38,
  platform: 0.7,
  cup: 0.82,
  assist: 0.88,
  'multi-cup': 1,
  match: 1,
};

export function spectatorDetail(reducedMotion: boolean, mobile: boolean) {
  if (reducedMotion)
    return { total: mobile ? 7 : 10, animated: 0, smallProps: !mobile };
  return {
    total: mobile ? 8 : 12,
    animated: mobile ? 3 : 6,
    smallProps: !mobile,
  };
}

export function spectatorReaction(
  event: CourseEvent,
): SpectatorReaction | null {
  const intensity = INTENSITY[event.kind];
  if (!intensity) return null;
  return {
    eventId: event.id,
    intensity,
    duration: intensity >= 0.8 ? 1_650 : intensity >= 0.6 ? 1_150 : 760,
  };
}

export class SpectatorEventTracker {
  private seen = new Set<number>();

  ingest(events: readonly CourseEvent[]): SpectatorReaction | null {
    let strongest: SpectatorReaction | null = null;
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      const reaction = spectatorReaction(event);
      if (!reaction) continue;
      if (!strongest || reaction.intensity >= strongest.intensity)
        strongest = reaction;
    }
    return strongest;
  }

  reset() {
    this.seen.clear();
  }
}
