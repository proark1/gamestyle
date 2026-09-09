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
};

/** Sound follows authoritative simulation time, never local guesses. */
export class SiegeAudioDirector {
  private round = -1;
  private lastEvent = 0;
  private winding = false;

  reset() {
    this.round = -1;
    this.lastEvent = 0;
    this.winding = false;
  }

  update(w: SiegeWorld | null): SoundPlan {
    const plan: SoundPlan = {
      music: 'music.siege',
      musicLevel: 0.45,
      camp: 0,
      fire: 0,
      hits: [],
    };
    if (!w || w.phase === 'lobby') return plan;
    if (this.round !== w.started) {
      this.reset();
      this.round = w.started;
    }
    const playing = w.phase === 'playing' || w.phase === 'relief';
    plan.camp = playing ? 1 : 0.4;
    plan.musicLevel = w.phase === 'relief' ? 0.7 : playing ? 0.5 : 0.35;
    const burning = w.blocks.filter((b) => b.burning > w.clock).length;
    plan.fire = Math.min(1, burning / 6);
    for (const event of w.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      const mapped = EVENT_CUES[event.kind];
      if (!mapped) continue;
      plan.hits.push({
        cue: mapped.cue,
        strength: event.kind === 'banner' || event.kind === 'loose' ? 1 : 0.8,
        source: `${event.kind}-${event.id}`,
        position: mapped.at === 'castle' ? CASTLE : TREBUCHET,
      });
    }
    // The winch is a held action, so it announces itself once per pull.
    const winding = w.players.some((p) => p.winding);
    if (winding && !this.winding)
      plan.hits.push({
        cue: 'event.wind',
        strength: 0.7,
        source: 'winch',
        position: TREBUCHET,
      });
    this.winding = winding;
    return plan;
  }
}
