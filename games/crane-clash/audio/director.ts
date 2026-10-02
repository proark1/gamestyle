import { CRANE_CONFIG, timeLeft, type CraneClashWorld } from '../types';
import type { AudioHit } from '../../../shared/audio/motion-cues';

export class CraneAudioDirector {
  private previous: CraneClashWorld | null = null;
  private lastEvent = 0;
  reset() {
    this.previous = null;
    this.lastEvent = 0;
  }
  update(w: CraneClashWorld | null) {
    const hits: AudioHit[] = [];
    let motor = 0,
      swing = 0;
    if (!w) {
      this.reset();
      return { hits, motor, swing };
    }
    if (
      this.previous &&
      (w.started !== this.previous.started || w.clock < this.previous.clock)
    )
      this.reset();
    const old = this.previous;
    const cues = {
      siren: 'start',
      grab: 'grab',
      place: 'place',
      bonk: 'bonk',
      topple: 'topple',
      height: 'height',
    };
    for (const event of w.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      if (w.clock - event.at > 900) continue;
      const position = event.team ? CRANE_CONFIG[event.team].pad : undefined;
      hits.push({
        cue: `event.${cues[event.type]}`,
        strength: 0.85,
        position,
        source: String(event.id),
      });
      if (event.type === 'grab')
        hits.push({ cue: 'event.cable', strength: 0.55, position });
    }
    if (w.phase === 'playing') {
      for (const team of ['red', 'blue'] as const) {
        const crane = w.cranes[team],
          prior = old?.cranes[team];
        if (prior && w.clock > old!.clock) {
          const dt = Math.max(0.016, (w.clock - old!.clock) / 1000);
          motor = Math.max(
            motor,
            Math.min(
              0.8,
              ((Math.abs(crane.angle - prior.angle) * 3 +
                Math.abs(crane.cableLength - prior.cableLength) +
                Math.abs(crane.trolleyDist - prior.trolleyDist)) /
                dt) *
                0.3,
            ),
          );
        }
        swing = Math.max(
          swing,
          Math.min(
            0.65,
            Math.hypot(crane.hookVx, crane.hookVy, crane.hookVz) / 12,
          ),
        );
      }
      if (old)
        for (const crate of w.crates) {
          const prior = old.crates.find((c) => c.id === crate.id);
          if (
            prior &&
            !crate.heldBy &&
            prior.vy < -1.5 &&
            crate.vy - prior.vy > 1.3
          ) {
            const cue =
              crate.kind === 'block'
                ? 'event.impact-stone'
                : crate.kind === 'beam' || crate.kind === 'barrel'
                  ? 'event.impact-metal'
                  : 'event.impact';
            hits.push({
              cue,
              strength: Math.min(1, -prior.vy / 7),
              position: crate,
              source: crate.id,
            });
          }
        }
      const seconds = Math.ceil(timeLeft(w) / 1000);
      if (
        old &&
        w.mode !== 'practice' &&
        seconds > 0 &&
        seconds <= 10 &&
        seconds !== Math.ceil(timeLeft(old) / 1000)
      )
        hits.push({ cue: 'event.warning', strength: 0.6 });
    }
    if (old && w.phase === 'ended' && old.phase !== 'ended')
      hits.push({
        cue: w.winner === 'draw' ? 'event.draw' : 'event.win',
        strength: 1,
      });
    this.previous = {
      ...w,
      crates: w.crates.map((c) => ({ ...c })),
      cranes: { red: { ...w.cranes.red }, blue: { ...w.cranes.blue } },
    };
    return { hits, motor, swing };
  }
}
