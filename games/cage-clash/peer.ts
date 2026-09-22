import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import { advanceWorld, fightAction, freshWorld, snapshot } from './simulation';
import { resetSelection } from './selection';
import { cleanInput, idleInput, type World, type Snapshot } from './types';
const adapter: GameAdapter<World, Snapshot> = {
  game: 'cage-clash',
  snapshotDetached: true,
  canJoin: (w) => w.phase === 'selection' || w.phase === 'ended',
  autonomous: (p) => p.bot,
  actions: ['commit', 'reveal', 'reset'],
  create: freshWorld,
  add(w, m) {
    const p = w.players.find((p) => p.bot);
    if (!p) throw new Error('This duel already has two fighters.');
    Object.assign(p, {
      id: m.id,
      name: m.name,
      color: m.color,
      bot: false,
      seen: w.clock,
      input: idleInput(),
      previous: idleInput(),
    });
    resetSelection(w);
  },
  remove(w, id) {
    const p = w.players.find((p) => p.id === id);
    if (!p) return;
    p.bot = true;
    p.name = 'Training partner';
    p.input = idleInput();
    p.previous = idleInput();
    if (w.phase === 'selection') resetSelection(w);
  },
  input(w, id, raw) {
    const p = w.players.find((p) => p.id === id);
    if (p) {
      p.input = cleanInput(raw);
      p.seen = w.clock;
    }
  },
  idle(p) {
    p.input = { ...idleInput(), cancel: true };
    p.previous = idleInput();
    p.charge = 0;
  },
  advance: advanceWorld,
  act: (w, id, a, host) => fightAction(w, id, a, host === id),
  snapshot,
};
export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
