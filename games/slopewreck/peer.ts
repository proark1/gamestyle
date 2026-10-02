import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceWorld,
  freshWorld,
  newRider,
  raceAction,
  setInput,
  snapshot,
} from './simulation';
import { idleInput, type Snapshot, type World } from './types';

const adapter: GameAdapter<World, Snapshot> = {
  game: 'slopewreck',
  snapshotDetached: true,
  canJoin: () => true,
  autonomous: (p) => p.bot,
  actions: ['start', 'ready', 'reset', 'jump', 'trick_ramp', 'trick_rail'],
  create: freshWorld,
  add: (w, m) => {
    const p = w.players.find((q) => q.bot);
    if (!p) throw new Error('The mountain is full.');
    Object.assign(p, {
      id: m.id,
      name: m.name,
      color: m.color,
      bot: false,
      seen: w.clock,
      input: idleInput(),
    });
  },
  remove: (w, id) => {
    const p = w.players.find((q) => q.id === id);
    if (p) {
      const bot = newRider(p.seat);
      Object.assign(p, {
        id: bot.id,
        name: bot.name,
        bot: true,
        input: idleInput(),
      });
    }
  },
  input: setInput,
  idle: (p) => {
    p.input = idleInput();
  },
  advance: advanceWorld,
  act: (w, id, a, host) => raceAction(w, id, a, host === id),
  snapshot,
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
