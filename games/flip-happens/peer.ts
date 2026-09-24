import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceWorld,
  flipAction,
  freshWorld,
  newPlayer,
  replaceOwner,
  setInput,
  snapshot,
} from './simulation';
import { idleInput, type Snapshot, type World } from './types';

const adapter: GameAdapter<World, Snapshot> = {
  game: 'flip-happens',
  snapshotDetached: true,
  canJoin: (w) => w.mode !== 'daily',
  autonomous: (p) => p.bot,
  party: (w) => {
    w.mode = 'versus';
  },
  actions: [
    'start',
    'ready',
    'reset',
    'mode',
    'charge',
    'throw',
    'cancel',
    'bank',
    'select',
  ],
  create: freshWorld,
  add: (w, m) => {
    const p = w.players.find((q) => q.bot);
    if (!p) throw new Error('The table is full.');
    replaceOwner(w, p.id, m.id);
    Object.assign(p, {
      id: m.id,
      name: m.name,
      color: m.color,
      bot: false,
      seen: w.clock,
      input: idleInput(),
      chargingAt: null,
    });
  },
  remove: (w, id) => {
    const p = w.players.find((q) => q.id === id);
    if (!p) return;
    const bot = newPlayer(p.seat);
    replaceOwner(w, p.id, bot.id);
    Object.assign(p, {
      id: bot.id,
      name: bot.name,
      bot: true,
      input: idleInput(),
      chargingAt: null,
      botAt: w.clock + 800,
    });
  },
  input: setInput,
  idle: (p) => {
    p.input = idleInput();
    p.chargingAt = null;
  },
  advance: advanceWorld,
  act: (w, id, a, host) => flipAction(w, id, a, host === id),
  snapshot,
};
export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  const engine = new PeerEngine(adapter, now, checkpoint);
  for (const p of engine.world.players) if (!p.bot) p.chargingAt = null;
  return engine;
}
