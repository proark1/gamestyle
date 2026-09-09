import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  addBrain,
  advanceBreakfast,
  breakfastAction,
  breakfastSnapshot,
  freshBreakfast,
  removeBrain,
  reconcileBreakfastNpcs,
} from './simulation';
import {
  idleInput,
  type BrainAction,
  type BrainSnapshot,
  type BrainWorld,
} from './types';

const adapter: GameAdapter<BrainWorld, BrainSnapshot> = {
  game: 'four-brain-cells',
  autonomous: (p) => !!p.bot,
  roster: (w, roster) => reconcileBreakfastNpcs(w, roster.slots),
  actions: ['start', 'restart', 'claim', 'grab', 'use', 'kick', 'center'],
  create: freshBreakfast,
  add: (w, m) => addBrain(w, m.id, m.name, m.color),
  remove: removeBrain,
  input(w, id, v) {
    const p = w.players.find((p) => p.id === id)!;
    p.input = {
      x: Number(v.x),
      z: Number(v.z),
      seq: Number(v.seq),
      lift:
        typeof v.lift === 'number' && Number.isFinite(v.lift)
          ? Math.max(-1, Math.min(1, v.lift))
          : 0,
      use: v.use === true,
      steady: v.steady === true,
    };
  },
  idle: (p) => {
    p.input = idleInput();
  },
  advance: advanceBreakfast,
  act: (w, id, a, host) => breakfastAction(w, id, a as BrainAction, host),
  snapshot: breakfastSnapshot,
};
export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  const engine = new PeerEngine(adapter, now, checkpoint);
  if (checkpoint) for (const p of engine.world.players) p.input = idleInput();
  return engine;
}
