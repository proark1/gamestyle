import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceSite,
  freshSite,
  newWrecker,
  removeWrecker,
  siteAction,
  siteSnapshot,
} from './simulation';
import {
  idleInput,
  type LoadAction,
  type LoadSnapshot,
  type LoadWorld,
} from './types';

const adapter: GameAdapter<LoadWorld, LoadSnapshot> = {
  game: 'load-bearing',
  actions: [
    'start',
    'restart',
    'practice',
    'swing',
    'mark',
    'help',
    'crane',
    'crane-move',
    'crane-drop',
    'wave',
  ],
  create: (now) => freshSite(now),
  add: (w, m) => {
    w.players.push(newWrecker(m.id, m.name, m.color, w.clock));
  },
  remove: removeWrecker,
  input(w, id, value) {
    const player = w.players.find((p) => p.id === id);
    if (!player) return;
    player.input = {
      x: Number(value.x),
      z: Number(value.z),
      jump: value.jump === true,
      seq: Number(value.seq),
    };
  },
  idle(p) {
    p.input = idleInput();
  },
  advance: advanceSite,
  act: (w, id, a, host) => siteAction(w, id, a as LoadAction, host),
  snapshot: siteSnapshot,
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
