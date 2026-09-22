import type { AudioHit } from '../../../shared/audio/motion-cues';
import { cageDistance } from '../physics';
import type { World } from '../types';

type Previous = {
  clock: number;
  selection: number;
  phase: World['phase'];
  countdown: number;
  time: number;
  event: number;
};
type Motion = {
  x: number;
  z: number;
  dodge: number;
  fence: boolean;
  nextStep: number;
  take: number;
};
export type CageAudioPlan = {
  hits: AudioHit[];
  crowd: number;
  music: number;
  grapple: number;
  tension: number;
};

/** Copy small values: solo simulation mutates its World between updates. */
export class CageAudioDirector {
  private previous: Previous | null = null;
  private motion = new Map<string, Motion>();
  private nextReaction = 0;
  private nextBreath = 0;
  reset() {
    this.previous = null;
    this.motion.clear();
    this.nextReaction = this.nextBreath = 0;
  }
  update(w: World, localId?: string): CageAudioPlan {
    const playing = w.phase === 'playing';
    const plan: CageAudioPlan = {
      hits: [],
      crowd: w.phase === 'selection' ? 0.35 : playing ? 0.8 : 0.6,
      music: playing ? 0.35 : 0.65,
      grapple: playing && w.grapple ? 0.6 : 0,
      tension:
        playing && w.grapple?.submissionBy
          ? Math.min(1, 0.3 + w.grapple.submission)
          : 0,
    };
    if (
      this.previous &&
      (w.clock < this.previous.clock ||
        w.selection !== this.previous.selection ||
        w.nextEvent < this.previous.event)
    )
      this.reset();
    const old = this.previous;
    const hit = (cue: string, strength = 1) =>
      plan.hits.push({ cue: `cage.${cue}`, strength });
    if (old) {
      if (w.phase !== old.phase) {
        if (playing) hit('bell');
        if (w.phase === 'break' || w.phase === 'ended') hit('round-end');
        if (w.phase === 'ended') {
          const me = w.players.find((p) => p.id === localId);
          hit(
            w.winner === 'draw' || !me
              ? 'draw'
              : w.winner === me.team
                ? 'win'
                : 'loss',
          );
          hit('cheer', 0.8);
          this.nextReaction = w.clock + 3000;
        }
      }
      if (
        w.phase === 'countdown' &&
        (old.phase !== 'countdown' || Math.ceil(w.phaseTime) !== old.countdown)
      )
        hit('countdown', 0.75);
      if (
        playing &&
        old.phase === 'playing' &&
        old.time > 10 &&
        w.time <= 10 &&
        w.time > 0
      )
        hit('warning');
      // A long snapshot gap is a resync, not a backlog of audible impacts.
      if (w.clock - old.clock < 1500) {
        for (const e of w.events) {
          if (e.id <= old.event || e.kind === 'bell') continue;
          let cue: string = e.kind;
          if (e.kind === 'hit')
            cue =
              e.move === 'kick'
                ? 'kick-hit'
                : e.move === 'hook' || e.move === 'cross'
                  ? 'heavy'
                  : ['hit', 'hit.1', 'hit.2'][e.id % 3];
          plan.hits.push({
            cue: `cage.${cue}`,
            strength: e.strength,
            position: { x: e.x, z: e.z },
            source: e.team,
          });
          if (
            w.clock >= this.nextReaction &&
            ['counter', 'guard-break', 'takedown', 'down'].includes(e.kind)
          ) {
            hit(
              e.kind === 'counter' || e.kind === 'guard-break'
                ? 'gasp'
                : 'cheer',
              0.75,
            );
            this.nextReaction = w.clock + 2800;
          }
        }
      }
    }
    for (const p of w.players) {
      const before = this.motion.get(p.id);
      const atFence = cageDistance(p) < 0.52;
      const next = before ?? {
        x: p.x,
        z: p.z,
        dodge: p.dodge,
        fence: atFence,
        nextStep: w.clock + 300,
        take: 0,
      };
      const nearby = (cue: string, strength: number) =>
        plan.hits.push({
          cue: `cage.${cue}`,
          strength,
          position: { x: p.x, z: p.z },
          source: p.id,
        });
      if (
        old &&
        before &&
        playing &&
        old.phase === 'playing' &&
        w.clock - old.clock < 1500
      ) {
        const moved = Math.hypot(p.x - before.x, p.z - before.z);
        const speed = (moved * 1000) / Math.max(1, w.clock - old.clock);
        if (!w.grapple && !p.down && speed > 0.65 && w.clock >= next.nextStep) {
          next.take = (next.take % 3) + 1;
          nearby(`step.${next.take}`, Math.min(0.8, 0.35 + speed * 0.07));
          next.nextStep = w.clock + (speed > 4 ? 270 : 400);
        }
        if (p.dodge > 0 && before.dodge <= 0) nearby('dodge', 0.7);
        if (atFence && !before.fence && speed > 1.2)
          nearby('fence', Math.min(1, speed / 5));
        if (
          p.id === localId &&
          p.stamina < 28 &&
          !p.down &&
          w.clock >= this.nextBreath
        ) {
          hit('breath', 0.5 + (28 - p.stamina) / 56);
          this.nextBreath = w.clock + 1900;
        }
      }
      this.motion.set(p.id, {
        ...next,
        x: p.x,
        z: p.z,
        dodge: p.dodge,
        fence: atFence,
      });
    }
    for (const id of this.motion.keys())
      if (!w.players.some((p) => p.id === id)) this.motion.delete(id);
    this.previous = {
      clock: w.clock,
      selection: w.selection,
      phase: w.phase,
      countdown: Math.ceil(w.phaseTime),
      time: w.time,
      event: w.nextEvent,
    };
    return plan;
  }
}
