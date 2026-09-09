import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  freshHotel,
  newGuest,
  removeGuest,
  advanceHotel,
  hotelAction,
  hotelSnapshot,
} from './simulation';
import {
  idleInput,
  type HotelWorld,
  type HotelSnapshot,
  type HotelAction,
} from './types';

const adapter: GameAdapter<HotelWorld, HotelSnapshot> = {
  game: 'wrong-floor',
  actions: ['start', 'restart', 'inspect', 'report', 'vote'],
  create: freshHotel,
  autonomous: (p) => p.bot,
  add(w, m) {
    const slot =
      [0, 1, 2, 3].find(
        (n) => !w.players.some((p) => !p.bot && p.slot === n),
      ) ?? 0;
    w.players = w.players.filter((p) => !p.bot || p.slot !== slot);
    w.players.push(newGuest(m.id, m.name, slot, w.clock, slot));
  },
  remove: removeGuest,
  input(w, id, raw) {
    w.players.find((p) => p.id === id)!.input = {
      x: Number(raw.x),
      z: Number(raw.z),
      seq: Number(raw.seq),
      sprint: raw.sprint === true,
    };
  },
  idle(p) {
    p.input = idleInput();
  },
  advance: advanceHotel,
  act: (w, id, a, host) => hotelAction(w, id, a as HotelAction, host),
  snapshot: hotelSnapshot,
};
export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  const engine = new PeerEngine(adapter, now, checkpoint);
  if (checkpoint) for (const p of engine.world.players) p.input = idleInput();
  return engine;
}
