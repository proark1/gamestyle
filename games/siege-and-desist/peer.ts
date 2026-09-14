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
  autonomous: (p) => !!p.bot,
  actions: [
    'start',
    'restart',
    'wind',
    'stopWind',
    'push',
    'stopPush',
    'loose',
    'ride',
    'jump',
    'help',
    'switchTeam',
    'setMode',
  ],
  create: freshSiege,
  add: (w, m) => {
    const team =
      w.mode === 'clash2v2' ? (m.color % 2 === 1 ? 'blue' : 'red') : 'red';
    w.players.push(newCrew(m.id, m.name, m.color, w.clock, team));
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
