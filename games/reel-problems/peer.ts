import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  freshReel,
  newAngler,
  removeAngler,
  advanceReel,
  reelAction,
  reelSnapshot,
} from './simulation';
import {
  idleInput,
  type ReelAction,
  type ReelSnapshot,
  type ReelWorld,
} from './types';
import { freshWeather, freshWildlife } from './chaos';

const adapter: GameAdapter<ReelWorld, ReelSnapshot> = {
  game: 'reel-problems',
  actions: ['start', 'restart', 'cast', 'cut', 'untangle', 'rescue'],
  create: freshReel,
  add: (w, m) => {
    w.players.push(newAngler(m.id, m.name, m.color, w.clock));
  },
  remove: removeAngler,
  input(w, id, value) {
    const p = w.players.find((p) => p.id === id)!;
    p.input = {
      x: Number(value.x),
      z: Number(value.z),
      seq: Number(value.seq),
      reel: value.reel === true,
      brace: value.brace === true,
    };
  },
  idle(p) {
    p.input = idleInput();
  },
  advance: advanceReel,
  act: (w, id, a, host) => reelAction(w, id, a as ReelAction, host),
  snapshot: reelSnapshot,
};
export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  const engine = new PeerEngine(adapter, now, checkpoint);
  // Held reeling and bracing are transient, just like movement, after a handover.
  if (checkpoint) {
    // Upgrade pre-weather checkpoints using existing player lines as hook links.
    engine.world.weather ??= freshWeather(engine.world.clock);
    engine.world.wildlife ??= freshWildlife(engine.world.clock);
    for (const p of engine.world.players) {
      p.input = idleInput();
      p.slipX ??= 0;
      p.slipZ ??= 0;
    }
  }
  return engine;
}
