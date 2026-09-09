import type { SceneAudioPlan } from '../../../shared/audio/scene-plan';
import { ROUND_MS, type ReelWorld } from '../types';
import { anglerPosition } from '../simulation';

export class ReelAudioDirector {
  private previous: ReelWorld | null = null;
  private lastEvent = 0;
  private steps = new Map<string, number>();
  private hullAt = 0;
  reset() {
    this.previous = null;
    this.lastEvent = 0;
    this.steps.clear();
    this.hullAt = 0;
  }
  update(w: ReelWorld | null, localId?: string): SceneAudioPlan {
    const plan: SceneAudioPlan = { reset: false, hits: [], loops: [] };
    const loop = (channel: string, id: string | null, strength = 1) =>
      plan.loops.push({ channel, id, strength });
    const hit = (
      id: string,
      strength = 1,
      position?: { x: number; z: number },
    ) => plan.hits.push({ id, strength, position });
    if (!w) {
      this.reset();
      plan.reset = true;
      loop('music', 'music.menu', 0.7);
      loop('lake', 'ambience.lake', 0.5);
      return plan;
    }
    let old = this.previous;
    if (old && old.started === w.started && w.clock < old.clock) return plan;
    const fresh =
      !old ||
      old.started !== w.started ||
      w.clock - old.clock > 2500 ||
      w.eventId < this.lastEvent;
    if (fresh) {
      plan.reset = true;
      this.steps.clear();
      this.hullAt = w.clock;
      this.lastEvent =
        w.phase === 'playing' && w.clock - w.started < 1500
          ? Math.max(0, w.eventId - 1)
          : w.eventId;
      old = null;
    }
    const playing = w.phase === 'playing';
    const me = w.players.find((p) => p.id === localId);
    plan.listener = me ? anglerPosition(w, me) : w.boat;
    const lines = w.players.filter((p) => p.line && !p.swimming);
    const maxTension = Math.max(0, ...lines.map((p) => p.line!.tension));
    const urgent = playing && w.clock - w.started >= ROUND_MS - 60_000;
    const challenged = urgent || w.weather.kind === 'storm' || maxTension > 0.7;
    loop(
      'music',
      `music.${w.phase === 'lobby' ? 'menu' : playing ? (challenged ? 'challenge' : 'build') : w.phase === 'won' ? 'win' : 'fail'}`,
      0.7,
    );
    loop('lake', 'ambience.lake', playing ? 0.75 : 0.5);
    loop(
      'wind',
      playing && w.weather.kind !== 'calm' ? 'ambience.wind' : null,
      w.weather.kind === 'storm' ? 0.8 : 0.45,
    );
    loop(
      'rain',
      playing && w.weather.rain > 0.05 ? 'ambience.rain' : null,
      Math.min(0.8, w.weather.rain),
    );
    loop(
      'reel',
      playing && lines.some((p) => p.input.reel) ? 'ambience.reel' : null,
      0.55,
    );
    loop(
      'strain',
      playing && maxTension > 0.45 ? 'ambience.strain' : null,
      Math.min(0.8, maxTension),
    );
    const speed = Math.hypot(w.boat.vx, w.boat.vz);
    loop(
      'wake',
      playing && speed > 0.25 ? 'ambience.wake' : null,
      Math.min(0.7, speed / 5),
    );
    loop(
      'swim',
      playing && me?.swimming && Math.hypot(me.input.x, me.input.z) > 0.1
        ? 'ambience.swim'
        : null,
      0.65,
    );
    const untangled =
      !!old &&
      w.players.some(
        (p) =>
          old!.players.find((b) => b.id === p.id)?.line?.tangled &&
          p.line &&
          !p.line.tangled,
      );
    for (const e of w.events)
      if (e.id > this.lastEvent) {
        this.lastEvent = e.id;
        if (e.kind === 'finish') {
          hit(w.phase === 'won' ? 'event.finish' : 'event.fail');
          hit(w.phase === 'won' ? 'speech.win' : 'speech.fail');
        } else if (e.kind === 'rescue' && untangled)
          hit('event.untangle', 0.75, w.boat);
        else {
          hit(`event.${e.kind}`, 0.85, w.boat);
          if (e.kind === 'start') hit('speech.start');
        }
      }
    if (old) {
      if (w.phase === 'lobby' && old.phase === 'lobby') {
        const before = new Set(old.players.map((p) => p.id)),
          now = new Set(w.players.map((p) => p.id));
        if ([...now].some((id) => !before.has(id))) hit('event.join', 0.6);
        if ([...before].some((id) => !now.has(id))) hit('event.leave', 0.6);
      }
      if (playing) {
        if (urgent && old.clock - w.started < ROUND_MS - 60_000)
          hit('event.time-warning');
        if (
          Object.keys(w.gear).some(
            (key) =>
              w.gear[key as keyof typeof w.gear] &&
              !old!.gear[key as keyof typeof w.gear],
          )
        )
          hit('event.gear', 0.7, w.boat);
        if (
          Math.abs(w.boat.roll - old.boat.roll) > 0.025 &&
          Math.abs(w.boat.roll) > 0.2 &&
          w.clock - this.hullAt > 3500
        ) {
          hit('event.hull', 0.6, w.boat);
          this.hullAt = w.clock;
        }
        for (const p of w.players) {
          const before = old.players.find((b) => b.id === p.id);
          const distance = before
            ? Math.hypot(p.x - before.x, p.z - before.z)
            : 0;
          if (!before || p.swimming || before.swimming || distance > 1.5) {
            this.steps.delete(p.id);
            continue;
          }
          const stride = (this.steps.get(p.id) ?? 0) + distance;
          if (stride >= 0.9)
            plan.hits.push({
              id: 'step.deck',
              variant: true,
              strength: p.input.brace ? 0.35 : 0.6,
              position: anglerPosition(w, p),
              sourceId: p.id,
            });
          this.steps.set(p.id, stride % 0.9);
        }
        for (const id of this.steps.keys())
          if (!w.players.some((p) => p.id === id)) this.steps.delete(id);
      }
    }
    this.previous = structuredClone(w);
    return plan;
  }
}
