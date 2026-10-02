import type { PanicCurlingWorld } from '../types';
import { MotionCues, type AudioHit } from '../../../shared/audio/motion-cues';

export class CurlingAudioDirector {
  private previous: PanicCurlingWorld | null = null;
  private motion = new MotionCues();
  private eventFrame = '';
  private gadgetAt = new Map<string, number>();
  reset() {
    this.previous = null;
    this.eventFrame = '';
    this.gadgetAt.clear();
    this.motion.reset();
  }
  update(w: PanicCurlingWorld | null) {
    const hits: AudioHit[] = [];
    let slide = 0,
      sweep = 0;
    if (!w) {
      this.reset();
      return { hits, slide, sweep, playing: false };
    }
    if (
      this.previous &&
      (w.started !== this.previous.started ||
        w.clock < this.previous.clock ||
        w.round !== this.previous.round)
    )
      this.reset();
    const old = this.previous;
    const playing = w.phase !== 'warmup' && w.phase !== 'match_over';
    const frame = `${w.clock}:${JSON.stringify(w.events)}`;
    if (frame !== this.eventFrame)
      for (const e of w.events) {
        if (e.type === 'stone_delivered')
          hits.push({ cue: 'curling.launch', strength: 0.8 });
        if (e.type === 'stone_clack')
          hits.push({
            cue: 'curling.stone_clack',
            strength: Math.min(1, e.volume),
            position: e,
          });
        if (
          e.type === 'sweep_burst' &&
          e.gadget !== 'broom' &&
          w.clock >= (this.gadgetAt.get(e.gadget) ?? 0)
        ) {
          hits.push({
            cue: `curling.${e.gadget}`,
            strength: 0.55,
            position: e,
          });
          this.gadgetAt.set(e.gadget, w.clock + 550);
        }
        if (e.type === 'banana_slip')
          hits.push({
            cue: 'curling.banana_slip',
            strength: 0.7,
            position: w.players.find((p) => p.id === e.playerId),
            source: e.playerId,
          });
        if (e.type === 'end_scored')
          hits.push({ cue: 'curling.crowd_cheer', strength: 0.8 });
      }
    this.eventFrame = frame;
    if (playing) {
      if (
        old &&
        w.stones.some((s) => !old.stones.some((p) => p.id === s.id)) &&
        !hits.some((h) => h.cue === 'curling.launch')
      )
        hits.push({ cue: 'curling.launch', strength: 0.8 });
      slide = Math.min(
        0.85,
        w.stones
          .filter((s) => s.active && s.inPlay)
          .reduce((sum, s) => sum + Math.hypot(s.vx, s.vz) / 20, 0),
      );
      sweep = Math.min(
        0.75,
        w.players
          .filter((p) => p.status === 'sweeping' && p.gadget === 'broom')
          .reduce((sum, p) => sum + p.sweepIntensity * 0.4, 0),
      );
      hits.push(
        ...this.motion.update(
          w.players.filter((p) => p.status === 'normal'),
          w.clock,
          () => true,
        ),
      );
      if (old) {
        for (const tile of w.iceTiles) {
          const prior = old.iceTiles.find((t) => t.id === tile.id);
          if (prior && tile.broken && !prior.broken)
            hits.push({
              cue: 'curling.ice_break',
              strength: 0.7,
              position: tile,
            });
          else if (prior && tile.cracked && !prior.cracked)
            hits.push({
              cue: 'curling.ice_creak',
              strength: 0.6,
              position: tile,
            });
        }
        for (const stone of w.stones) {
          const prior = old.stones.find((s) => s.id === stone.id);
          if (prior && stone.outOfBounds && !prior.outOfBounds)
            hits.push({
              cue: 'curling.out',
              strength: 0.65,
              position: stone,
              source: stone.id,
            });
          if (prior && stone.y < -0.2 && prior.y >= -0.2)
            hits.push({
              cue: 'curling.water_splash',
              strength: 0.7,
              position: stone,
              source: stone.id,
            });
        }
        if (w.hazards.some((h) => !old.hazards.some((p) => p.id === h.id)))
          hits.push({ cue: 'curling.banana_toss', strength: 0.5 });
      }
    }
    if (old && w.phase !== old.phase) {
      if (w.phase === 'aiming')
        hits.push({ cue: 'curling.turn', strength: 0.6 });
      if (w.phase === 'match_over')
        hits.push({ cue: 'curling.match', strength: 0.85 });
    }
    this.previous = {
      ...w,
      iceTiles: w.iceTiles.map((t) => ({ ...t })),
      stones: w.stones.map((s) => ({ ...s })),
      hazards: w.hazards.map((h) => ({ ...h })),
    };
    return { hits, slide, sweep, playing };
  }
}
