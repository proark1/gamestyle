import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import { advanceWorld, boxingAction, freshWorld, snapshot } from './simulation';
import { cleanInput, idleInput, type World, type Snapshot } from './types';

const adapter: GameAdapter<World, Snapshot> = {
  game: 'on-the-ropes',
  snapshotDetached: true,
  canJoin: () => true,
  autonomous: (p) => p.bot,
  actions: ['start', 'ready', 'reset', 'switch_team', 'switch_role'],
  create: freshWorld,
  add: (w, m) => {
    const red = w.players.filter((p) => p.team === 'red' && !p.bot).length;
    const blue = w.players.filter((p) => p.team === 'blue' && !p.bot).length;
    const target =
      w.players.find(
        (p) => p.bot && p.team === (red <= blue ? 'red' : 'blue'),
      ) ?? w.players.find((p) => p.bot);
    if (!target) throw new Error('The ring is full.');
    Object.assign(target, {
      id: m.id,
      name: m.name,
      color: m.color,
      bot: false,
      seen: w.clock,
      input: idleInput(),
      charge: 0,
      assistCharge: 0,
      tagRequested: false,
      wasTag: false,
      botReturning: false,
    });
  },
  remove: (w, id) => {
    const p = w.players.find((q) => q.id === id);
    if (!p) return;
    p.id = `bot-${p.team}-${p.active ? 'ring' : 'corner'}`;
    p.name = 'Corner Crew';
    p.bot = true;
    p.input = idleInput();
    p.charge = 0;
    p.tagRequested = p.wasTag = p.botReturning = false;
  },
  input: (w, id, raw) => {
    const p = w.players.find((q) => q.id === id);
    if (p) {
      p.input = cleanInput(raw);
      p.seen = w.clock;
    }
  },
  idle: (p) => {
    p.input = { ...idleInput(), cancel: true };
    p.charge = p.assistCharge = 0;
  },
  advance: advanceWorld,
  act: (w, id, a, host) => boxingAction(w, id, a, host === id),
  snapshot,
};
export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
