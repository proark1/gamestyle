import { MotionCues } from '../../../shared/audio/motion-cues';
import { CASTLE, TREBUCHET, type SiegeWorld } from '../types';

export type SoundHit = {
  cue: string;
  strength: number;
  source?: string;
  position?: { x: number; z: number };
};
export type SoundPlan = {
  music: string | null;
  musicLevel: number;
  camp: number;
  fire: number;
  winch: number;
  bees: number;
  flight: number;
  hits: SoundHit[];
};

const EVENT_CUES: Record<string, { cue: string; at: 'castle' | 'engine' }> = {
  start: { cue: 'event.start', at: 'engine' },
  load: { cue: 'event.load', at: 'engine' },
  loose: { cue: 'event.loose', at: 'engine' },
  impact: { cue: 'event.impact', at: 'castle' },
  rubble: { cue: 'event.rubble', at: 'castle' },
  squash: { cue: 'event.squash', at: 'engine' },
  pot: { cue: 'event.pot', at: 'engine' },
  bees: { cue: 'event.bees', at: 'castle' },
  banner: { cue: 'event.banner', at: 'castle' },
  finish: { cue: 'event.finish', at: 'engine' },
  topple: { cue: 'event.topple', at: 'castle' },
  midair: { cue: 'event.midair', at: 'engine' },
  honk: { cue: 'event.honk', at: 'engine' },
  counterbattery: { cue: 'event.counterbattery', at: 'engine' },
};

/** Sound follows authoritative simulation time, never local guesses. */
export class SiegeAudioDirector {
  private round = -1;
  private lastEvent = 0;
  private winding = false;
  private previous: SiegeWorld | null = null;
  private motion = new MotionCues();
  private turnAt = 0;

  reset() {
    this.round = -1;
    this.lastEvent = 0;
    this.winding = false;
    this.previous = null;
    this.turnAt = 0;
    this.motion.reset();
  }

  update(w: SiegeWorld | null): SoundPlan {
    const plan: SoundPlan = {
      music: 'music.siege',
      musicLevel: 0.45,
      camp: 0,
      fire: 0,
      winch: 0,
      bees: 0,
      flight: 0,
      hits: [],
    };
    if (!w || w.phase === 'lobby') {
      this.reset();
      return plan;
    }
    if (
      this.round !== w.started ||
      (this.previous && w.clock < this.previous.clock)
    ) {
      this.reset();
      this.round = w.started;
    }
    const playing = w.phase === 'playing' || w.phase === 'relief';
    plan.camp = playing ? 1 : 0.4;
    plan.musicLevel = w.phase === 'relief' ? 0.7 : playing ? 0.5 : 0.35;
    const old = this.previous;
    const burning = w.blocks.filter((b) => b.burning > w.clock).length;
    plan.fire = playing ? Math.min(1, burning / 6) : 0;
    for (const event of w.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      if (w.clock - event.at > 900) continue;
      const mapped =
        event.kind === 'finish' && w.phase === 'lost'
          ? { cue: 'event.lose', at: 'engine' }
          : EVENT_CUES[event.kind];
      if (!mapped) continue;
      plan.hits.push({
        cue: mapped.cue,
        strength: event.kind === 'banner' || event.kind === 'loose' ? 1 : 0.8,
        source: `${event.kind}-${event.id}`,
        position: mapped.at === 'castle' ? CASTLE : TREBUCHET,
      });
    }
    // The winch is a held action, so it announces itself once per pull.
    const winding = playing && w.players.some((p) => p.winding);
    if (winding && !this.winding)
      plan.hits.push({
        cue: 'event.wind',
        strength: 0.7,
        source: 'winch',
        position: TREBUCHET,
      });
    plan.winch = winding ? 0.6 : 0;
    plan.bees = playing && w.beesUntil > w.clock ? 0.5 : 0;
    plan.flight = playing
      ? Math.min(0.6, w.shots.filter((s) => !s.landed).length * 0.18)
      : 0;
    if (playing) {
      const walkers = w.players.filter(
        (p) => !p.flying && p.stunnedUntil <= w.clock,
      );
      plan.hits.push(
        ...this.motion.update(walkers, w.clock, (p) => p.y <= 0.1),
      );
      if (old) {
        if (
          (w.wind >= 0.98 && old.wind < 0.98) ||
          ((w.engineBlue?.wind ?? 0) >= 0.98 &&
            (old.engineBlue?.wind ?? 0) < 0.98)
        )
          plan.hits.push({
            cue: 'event.ready',
            strength: 0.7,
            position: TREBUCHET,
          });
        if (
          (Math.abs(w.turn - old.turn) > 0.002 ||
            Math.abs((w.engineBlue?.turn ?? 0) - (old.engineBlue?.turn ?? 0)) >
              0.002) &&
          w.clock >= this.turnAt
        ) {
          plan.hits.push({
            cue: 'event.turn',
            strength: 0.5,
            position: TREBUCHET,
          });
          this.turnAt = w.clock + 900;
        }
        for (const shot of w.shots)
          if (!shot.landed && !old.shots.some((s) => s.id === shot.id))
            plan.hits.push({
              cue: 'event.flyby',
              strength: 0.6,
              position: shot,
              source: String(shot.id),
            });
        if (w.phase === 'relief' && old.phase !== 'relief')
          plan.hits.push({ cue: 'event.relief', strength: 0.8 });
      }
    } else {
      plan.music = null;
      plan.camp = 0;
    }
    this.previous = {
      ...w,
      engineBlue: w.engineBlue ? { ...w.engineBlue } : undefined,
      shots: w.shots.map((s) => ({ ...s })),
    };
    this.winding = winding;
    return plan;
  }
}
