import type { ZorbClashWorld } from '../types';
import { MotionCues, type AudioHit } from '../../../shared/audio/motion-cues';

export class ZorbAudioDirector {
  private previous: ZorbClashWorld | null = null;
  private motion = new MotionCues();
  reset() {
    this.previous = null;
    this.motion.reset();
  }
  update(w: ZorbClashWorld | null) {
    const hits: AudioHit[] = [];
    if (!w) {
      this.reset();
      return { hits, roll: 0, playing: false };
    }
    if (
      this.previous &&
      (w.started !== this.previous.started || w.clock < this.previous.clock)
    )
      this.reset();
    const old = this.previous,
      playing = w.status === 'playing';
    let roll = 0;
    if (playing) {
      const walkers = w.players.filter((p) => !p.turtle);
      hits.push(
        ...this.motion.update(
          walkers,
          w.clock,
          (p) => walkers.find((a) => a.id === p.id)!.grounded,
        ),
      );
      roll = Math.min(
        0.65,
        w.players.reduce((sum, p) => sum + Math.hypot(p.vx, p.vz), 0) / 60,
      );
    }
    if (old) {
      if (w.bonkCount > old.bonkCount)
        hits.push({ cue: 'event.zorb_bonk', strength: 0.8 });
      if (w.lastGoal && w.lastGoal.clock !== old.lastGoal?.clock)
        hits.push({ cue: 'event.goal_cheer', strength: 1 });
      if (w.status !== old.status) {
        if (w.status === 'playing')
          hits.push({ cue: 'event.referee_whistle', strength: 0.7 });
        if (w.status === 'ended')
          hits.push({ cue: 'event.win', strength: 0.85 });
      }
      if (
        w.status === 'countdown' &&
        Math.ceil(w.timeRemaining) !== Math.ceil(old.timeRemaining)
      )
        hits.push({ cue: 'event.countdown', strength: 0.6 });
      if (
        playing &&
        w.timeRemaining <= 10 &&
        w.timeRemaining > 0 &&
        Math.ceil(w.timeRemaining) !== Math.ceil(old.timeRemaining)
      )
        hits.push({ cue: 'event.warning', strength: 0.55 });
      if (
        playing &&
        (w.ball.lastTouchPlayerId !== old.ball.lastTouchPlayerId ||
          Math.hypot(w.ball.vx - old.ball.vx, w.ball.vz - old.ball.vz) > 4)
      )
        hits.push({ cue: 'event.ball_kick', strength: 0.6, position: w.ball });
      for (const c of w.cushions)
        if (
          c.compression > 0.1 &&
          (old.cushions.find((p) => p.id === c.id)?.compression ?? 1) <= 0.1
        )
          hits.push({
            cue: 'event.spring_recoil',
            strength: 0.65,
            position: c,
            source: c.id,
          });
      for (const p of w.players) {
        const prior = old.players.find((a) => a.id === p.id);
        if (!prior) continue;
        const hit = (cue: string) =>
          hits.push({ cue, strength: 0.7, position: p, source: p.id });
        if (p.dashing > 0 && prior.dashing <= 0) hit('event.dash_burst');
        if (p.braced && !prior.braced) hit('event.brace_thud');
        if (p.turtle && !prior.turtle) hit('event.turtle_slide');
        if (!p.turtle && prior.turtle) hit('event.recover');
      }
    }
    this.previous = {
      ...w,
      ball: { ...w.ball },
      lastGoal: w.lastGoal ? { ...w.lastGoal } : null,
      players: w.players.map((p) => ({ ...p })),
      cushions: w.cushions.map((c) => ({ ...c })),
    };
    return { hits, roll, playing };
  }
}
