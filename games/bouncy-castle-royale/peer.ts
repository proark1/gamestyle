import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceWorld,
  castleAction,
  freshWorld,
  newPlayer,
  setInput,
  snapshot,
} from './simulation';
import { idleInput, type Snapshot, type World } from './types';

const adapter: GameAdapter<World, Snapshot> = {
  game: 'bouncy-castle-royale',
  snapshotDetached: true,
  canJoin: () => true,
  autonomous: (p) => p.bot,
  actions: ['start', 'ready', 'reset', 'jump', 'slap', 'air', 'switch_team'],
  create: freshWorld,
  add: (w, m) => {
    const red = w.players.filter((p) => !p.bot && p.team === 'red').length;
    const blue = w.players.filter((p) => !p.bot && p.team === 'blue').length;
    const p =
      w.players.find(
        (q) => q.bot && q.team === (red <= blue ? 'red' : 'blue'),
      ) ?? w.players.find((q) => q.bot);
    if (!p) throw new Error('The castle is full.');
    Object.assign(p, {
      id: m.id,
      name: m.name,
      color: m.color,
      bot: false,
      seen: w.clock,
      input: idleInput(),
      swingUntil: 0,
    });
  },
  remove: (w, id) => {
    const p = w.players.find((q) => q.id === id);
    if (p) {
      const bot = newPlayer(p.seat);
      Object.assign(p, {
        id: bot.id,
        name: bot.name,
        bot: true,
        input: idleInput(),
        swingUntil: 0,
      });
    }
  },
  input: setInput,
  idle: (p) => {
    p.input = idleInput();
    p.swingUntil = 0;
  },
  advance: advanceWorld,
  act: (w, id, a, host) => castleAction(w, id, a, host === id),
  snapshot,
};
export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
