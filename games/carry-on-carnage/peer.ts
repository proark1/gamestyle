import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import { reconcileCarryOnBots, updateCarryOnBots } from './bots';
import {
  advanceCarryOn,
  carryOnAction,
  carryOnSnapshot,
  freshCarryOnWorld,
  newTraveler,
} from './simulation';
import {
  idleInput,
  type CarryOnAction,
  type CarryOnSnapshot,
  type CarryOnWorld,
} from './types';

const eventIdRef = { current: 100 };

const adapter: GameAdapter<CarryOnWorld, CarryOnSnapshot> = {
  game: 'carry-on-carnage',
  autonomous: (p) => !!p.bot,
  actions: ['start', 'restart', 'interact'],
  create: (now) => {
    const w = freshCarryOnWorld(now);
    reconcileCarryOnBots(w, now);
    return w;
  },
  add: (w, m) => {
    // Replace any bot slot
    const bot = w.players.find((p) => p.bot);
    if (bot) {
      w.players = w.players.filter((p) => p.id !== bot.id);
    }
    w.players.push(newTraveler(m.id, m.name, m.color, w.clock));
    reconcileCarryOnBots(w, w.clock);
  },
  remove: (w, id) => {
    w.players = w.players.filter((p) => p.id !== id);
    reconcileCarryOnBots(w, w.clock);
  },
  input: (w, id, raw) => {
    const player = w.players.find((p) => p.id === id);
    if (!player) return;
    player.input = {
      x: Number(raw.x) || 0,
      z: Number(raw.z) || 0,
      jump: raw.jump === true,
      grab: raw.grab === true,
      compress: raw.compress === true,
      zip: raw.zip === true,
      drop: raw.drop === true,
      seq: Number(raw.seq) || 0,
    };
    player.seen = w.clock;
  },
  idle: (p) => {
    p.input = idleInput();
  },
  advance: (w, dt) => {
    updateCarryOnBots(w, w.clock, eventIdRef);
    advanceCarryOn(w, dt, eventIdRef);
  },
  act: (w, id, a) => {
    carryOnAction(w, id, a as CarryOnAction, eventIdRef);
  },
  snapshot: (w, code, host, id, version) =>
    carryOnSnapshot(w, code, host, id, version),
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
