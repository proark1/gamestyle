import { doorOpen } from '../simulation';
import { glovePose } from '../level';
import type { ButtonWorld } from '../types';
export type SoundHit = {
  cue: string;
  strength: number;
  source?: string;
  position?: { x: number; z: number };
};
export type SoundPlan = {
  music: string | null;
  musicLevel: number;
  conveyor: number;
  spinner: number;
  soap: number;
  hits: SoundHit[];
};
type Motion = { y: number; slip: boolean; step: number };
/** Sound follows authoritative simulation time; no microphone or random game state changes. */
export class ButtonAudioDirector {
  private round = -1;
  private lastEvent = 0;
  private clock = 0;
  private open = false;
  private countdown = -1;
  private hazards = new Map<number, number>();
  private motion = new Map<string, Motion>();
  reset() {
    this.round = -1;
    this.lastEvent = 0;
    this.clock = 0;
    this.open = false;
    this.countdown = -1;
    this.hazards.clear();
    this.motion.clear();
  }
  update(w: ButtonWorld | null, listenerId?: string): SoundPlan {
    const result: SoundPlan = {
      music: 'music.show',
      musicLevel: 0.5,
      conveyor: 0,
      spinner: 0,
      soap: 0,
      hits: [],
    };
    if (!w || w.phase === 'lobby') return result;
    const fresh = this.round !== w.started;
    if (fresh) {
      this.reset();
      this.round = w.started;
    }
    const playing = w.phase === 'playing' || w.phase === 'escape';
    const recent = (at: number) => at > this.clock && w.clock - at < 900;
    const hit = (
      cue: string,
      strength = 1,
      source?: string,
      position?: { x: number; z: number },
    ) => result.hits.push({ cue, strength, source, position });
    for (const e of w.events) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      if (w.clock - e.at > 900) continue;
      const cue =
        e.kind === 'finish' && w.phase === 'lost'
          ? 'event.bust'
          : `event.${e.kind}`;
      hit(
        cue,
        1,
        String(e.id),
        e.kind === 'press' ? { x: 0, z: 0 } : undefined,
      );
      if (e.kind === 'press') hit('event.crowd-gasp', 0.7);
      if (e.kind === 'escape' || (e.kind === 'finish' && w.banked))
        hit('event.crowd-cheer', 0.85);
    }
    if (!playing) {
      result.music = null;
      this.clock = w.clock;
      return result;
    }
    result.music =
      w.phase === 'escape'
        ? 'music.escape'
        : w.presses >= 4
          ? 'music.chaos'
          : 'music.show';
    result.musicLevel = 0.85 + Math.min(0.15, w.presses / 60);
    const listener = w.players.find((p) => p.id === listenerId);
    for (const h of w.hazards) {
      if (h.starts > w.clock) continue;
      if ((!fresh || w.clock - h.starts < 500) && recent(h.starts))
        hit('event.hazard', 0.7, `hazard-${h.id}`, h);
      const proximity = listener
        ? Math.max(
            0.25,
            1 - Math.hypot(h.x - listener.x, h.z - listener.z) / 24,
          )
        : 0.5;
      if (h.kind === 'conveyor')
        result.conveyor = Math.min(0.8, result.conveyor + proximity * 0.42);
      if (h.kind === 'spinner')
        result.spinner = Math.min(0.8, result.spinner + proximity * 0.42);
      if (h.kind === 'soap')
        result.soap = Math.min(0.65, result.soap + proximity * 0.35);
      if (h.kind === 'glove') {
        const pose = glovePose(h, w.clock),
          stage =
            pose.cycle * 2 +
            (w.clock - h.starts - pose.cycle * 5400 >= 1100 ? 1 : 0);
        const previous = this.hazards.get(h.id);
        if (previous !== stage && (!fresh || w.clock - h.starts < 500)) {
          if (stage % 2 === 0 && pose.warning)
            hit('event.glove-windup', 0.85, `glove-${h.id}`, h);
          else if (pose.active)
            hit('event.glove-fire', 0.95, `glove-${h.id}`, {
              x: pose.x,
              z: h.z,
            });
        }
        this.hazards.set(h.id, stage);
      }
    }
    const isOpen = doorOpen(w);
    if (isOpen && !this.open && !fresh)
      hit('event.door-open', 0.8, undefined, { x: 0, z: -9 });
    this.open = isOpen;
    const remaining =
      w.phase === 'escape' ? Math.ceil((w.escapeAt - w.clock) / 1000) : -1;
    if (remaining > 0 && remaining <= 10 && remaining !== this.countdown)
      hit('event.tick', remaining <= 3 ? 1 : 0.7);
    this.countdown = remaining;
    for (const p of w.players) {
      if (!p.hearts || p.escaped) continue;
      const previous = this.motion.get(p.id),
        speed = Math.hypot(p.vx, p.vz);
      const slip =
        p.y < 0.1 &&
        speed > 1.8 &&
        w.hazards.some(
          (h) =>
            h.kind === 'soap' &&
            h.starts <= w.clock &&
            Math.hypot(p.x - h.x, p.z - h.z) < 2.8,
        );
      const step = Math.floor(w.clock / (speed > 4 ? 230 : 340));
      if (previous) {
        if (p.y > 0.15 && previous.y <= 0.15 && p.stunnedUntil <= w.clock)
          hit('event.jump', 0.7, p.id, p);
        if (p.y === 0 && previous.y > 0.05) hit('event.land', 0.7, p.id, p);
        if (slip && !previous.slip) hit('event.slip', 0.85, p.id, p);
        else if (p.y === 0 && speed > 0.8 && step !== previous.step)
          hit('event.step', p.id === listenerId ? 0.65 : 0.35, p.id, p);
      }
      this.motion.set(p.id, { y: p.y, slip, step });
    }
    for (const id of this.motion.keys())
      if (!w.players.some((p) => p.id === id)) this.motion.delete(id);
    this.clock = w.clock;
    return result;
  }
}
