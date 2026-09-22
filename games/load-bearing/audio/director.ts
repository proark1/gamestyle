import { timeLeft, type LoadWorld } from '../types';
import { MotionCues, type AudioHit } from '../../../shared/audio/motion-cues';

export class LoadAudioDirector {
  private previous: LoadWorld | null = null;
  private lastEvent = 0;
  private strainAt = 0;
  private motion = new MotionCues();
  reset() {
    this.previous = null;
    this.lastEvent = 0;
    this.strainAt = 0;
    this.motion.reset();
  }
  update(w: LoadWorld | null) {
    const hits: AudioHit[] = [];
    let strain = 0,
      debris = 0;
    if (!w) {
      this.reset();
      return { hits, strain, debris };
    }
    if (
      this.previous &&
      (w.started !== this.previous.started || w.clock < this.previous.clock)
    )
      this.reset();
    const old = this.previous;
    const cues = {
      start: 'start',
      hit: 'hammer',
      break: 'break',
      collapse: 'collapse',
      piano: 'piano',
      down: 'down',
      help: 'help',
      crane: 'crane',
      mark: 'mark',
      finish: null,
    };
    for (const e of w.events) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      if (w.clock - e.at > 900 || !cues[e.kind]) continue;
      hits.push({
        cue: `event.${cues[e.kind]}`,
        strength: 0.85,
        source: String(e.id),
      });
    }
    if (w.phase === 'playing') {
      const walkers = w.players.filter((p) => !p.down);
      hits.push(
        ...this.motion.update(
          walkers,
          w.clock,
          (p) => walkers.find((a) => a.id === p.id)!.grounded,
        ),
      );
      for (const p of w.players) {
        const prior = old?.players.find((a) => a.id === p.id);
        if (
          prior &&
          p.swingUntil > w.clock &&
          p.swingUntil !== prior.swingUntil
        )
          hits.push({
            cue: 'event.swing',
            strength: 0.5,
            position: p,
            source: p.id,
          });
      }
      strain = Math.max(
        0,
        ...w.parts.filter((p) => p.hits > 0 && !p.falling).map((p) => p.strain),
      );
      if (strain > 0.3 && old && w.clock >= this.strainAt) {
        hits.push({ cue: 'event.strain', strength: Math.min(0.85, strain) });
        this.strainAt = w.clock + 2800;
      }
      debris = Math.min(
        0.75,
        w.parts.filter((p) => p.falling && !p.sleeping && Math.abs(p.vy) > 0.5)
          .length / 12,
      );
      if (old && w.piano.integrity <= 35 && old.piano.integrity > 35)
        hits.push({
          cue: 'event.piano-danger',
          strength: 0.8,
          position: w.piano,
        });
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
    if (old && w.phase !== old.phase) {
      if (w.phase === 'won') hits.push({ cue: 'event.win', strength: 1 });
      if (w.phase === 'lost')
        hits.push({
          cue: w.piano.integrity <= 0 ? 'event.piano-lost' : 'event.lose',
          strength: 1,
        });
    }
    this.previous = {
      ...w,
      piano: { ...w.piano },
      players: w.players.map((p) => ({ ...p })),
    };
    return { hits, strain, debris };
  }
}
