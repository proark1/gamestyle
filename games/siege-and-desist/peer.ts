import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceSiege,
  freshSiege,
  newCrew,
  removeCrew,
  siegeAction,
  siegeSnapshot,
} from './simulation';
import {
  idleInput,
  type SiegeAction,
  type SiegeSnapshot,
  type SiegeWorld,
} from './types';

const adapter: GameAdapter<SiegeWorld, SiegeSnapshot> = {
  game: 'siege-and-desist',
  actions: [
    'start',
    'restart',
    'grab',
    'load',
    'wind',
    'stopWind',
    'push',
    'stopPush',
    'loose',
    'ride',
    'jump',
    'help',
  ],
  create: freshSiege,
  add: (w, m) => {
    w.players.push(newCrew(m.id, m.name, m.color, w.clock));
  },
  remove: removeCrew,
  input(w, id, value) {
    w.players.find((p) => p.id === id)!.input = {
      x: Number(value.x),
      z: Number(value.z),
      seq: Number(value.seq),
    };
  },
  idle(p) {
    p.input = idleInput();
    p.winding = false;
    p.pushing = 0;
  },
  advance: advanceSiege,
  act: (w, id, a, host) => siegeAction(w, id, a as SiegeAction, host),
  snapshot: siegeSnapshot,
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
