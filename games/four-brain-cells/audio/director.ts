import type { SceneAudioPlan } from '../../../shared/audio/scene-plan';
import { STOVE, BREWER, ROUND_MS, type BrainWorld } from '../types';

export class BreakfastAudioDirector {
  private previous: BrainWorld | null = null;
  private lastEvent = 0;
  reset() {
    this.previous = null;
    this.lastEvent = 0;
  }
  update(w: BrainWorld | null): SceneAudioPlan {
    const plan: SceneAudioPlan = { reset: false, hits: [], loops: [] };
    const loop = (channel: string, id: string | null, strength = 1) =>
      plan.loops.push({ channel, id, strength });
    const hit = (
      id: string,
      strength = 1,
      position?: { x: number; z: number },
      variant = false,
    ) => plan.hits.push({ id, strength, position, variant });
    if (!w) {
      this.reset();
      plan.reset = true;
      loop('music', 'music.menu', 0.7);
      loop('kitchen', 'ambience.kitchen', 0.45);
      return plan;
    }
    let old = this.previous;
    if (old && w.started === old.started && w.clock < old.clock) return plan;
    const fresh =
      !old ||
      old.started !== w.started ||
      w.clock - old.clock > 2500 ||
      w.eventId < this.lastEvent;
    if (fresh) {
      plan.reset = true;
      this.lastEvent =
        w.phase === 'playing' && w.clock - w.started < 1500
          ? Math.max(0, w.eventId - 1)
          : w.eventId;
      old = null;
    }
    const playing = w.phase === 'playing';
    const urgent = playing && w.clock - w.started >= ROUND_MS - 60_000;
    plan.listener = w.robot;
    loop(
      'music',
      `music.${w.phase === 'lobby' ? 'menu' : playing ? (urgent ? 'challenge' : 'build') : w.phase === 'won' ? 'win' : 'fail'}`,
      playing ? 0.7 : 0.8,
    );
    loop('kitchen', 'ambience.kitchen', playing ? 0.7 : 0.45);
    const pan = w.utensils.find((u) => u.id === 'pan');
    const cooking =
      playing &&
      pan &&
      pan.fill > 0 &&
      !pan.ready &&
      Math.hypot(pan.x - STOVE.x, pan.y - STOVE.y, pan.z - STOVE.z) < 1.35;
    loop('stove', cooking ? 'ambience.sizzle' : null, 0.7);
    loop(
      'brewer',
      playing ? 'ambience.brewer' : null,
      Math.max(
        0.1,
        0.55 - Math.hypot(w.robot.x - BREWER.x, w.robot.z - BREWER.z) / 18,
      ),
    );
    loop(
      'robot',
      playing && w.robot.wobble > 0.35 && w.robot.fallenUntil < w.clock
        ? 'ambience.servo'
        : null,
      Math.min(0.65, w.robot.wobble * 0.6),
    );
    for (const e of w.events)
      if (e.id > this.lastEvent) {
        this.lastEvent = e.id;
        if (w.clock - e.at > 1200 || e.kind === 'step') continue;
        if (e.kind === 'finish') {
          hit(w.phase === 'won' ? 'event.finish' : 'event.fail');
          hit(w.phase === 'won' ? 'speech.win' : 'speech.fail');
        } else {
          hit(`event.${e.kind}`, 0.8, w.robot);
          if (e.kind === 'start') hit('speech.start');
        }
      }
    if (old) {
      if (w.phase === 'lobby' && old.phase === 'lobby') {
        const before = new Set(
          old.players.filter((p) => !p.bot).map((p) => p.id),
        );
        const now = new Set(w.players.filter((p) => !p.bot).map((p) => p.id));
        if ([...now].some((id) => !before.has(id))) hit('event.join', 0.6);
        if ([...before].some((id) => !now.has(id))) hit('event.leave', 0.6);
      }
      if (playing) {
        if (urgent && old.clock - w.started < ROUND_MS - 60_000)
          hit('event.time-warning');
        for (let n = 2; n < 4; n++)
          if (
            w.limbs[n].stepAt > old.limbs[n].stepAt &&
            w.clock - w.limbs[n].stepAt < 700
          )
            plan.hits.push({
              id: 'event.step',
              variant: true,
              strength: 0.65,
              position: w.robot,
              sourceId: `leg-${n}`,
            });
        for (const u of w.utensils) {
          const before = old.utensils.find((v) => v.id === u.id);
          if (!before) continue;
          if (u.ready && !before.ready) hit('event.pancake-ready', 0.8, u);
          if (
            u.id === 'pan' &&
            before.fill > 0 &&
            !before.flipped &&
            before.cook > 11.5 &&
            !u.fill
          )
            hit('event.burnt', 0.8, u);
          if (u.fill > before.fill + 0.15)
            hit(
              u.id === 'pan' ? 'event.refill' : 'event.coffee-refill',
              0.65,
              u,
            );
          if (u.floorAt > before.floorAt && w.clock - u.floorAt < 700)
            hit('event.utensil-land', 0.65, u);
        }
      }
    }
    this.previous = structuredClone(w);
    return plan;
  }
}
