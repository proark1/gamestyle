import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceButton,
  buttonAction,
  buttonSnapshot,
  freshButton,
  newContestant,
  removeContestant,
} from './simulation';
import {
  idleInput,
  type ButtonAction,
  type ButtonSnapshot,
  type ButtonWorld,
} from './types';
const adapter: GameAdapter<ButtonWorld, ButtonSnapshot> = {
  game: 'one-more-button',
  actions: ['start', 'restart', 'press', 'exit', 'jump', 'stop', 'help'],
  create: freshButton,
  add: (w, m) => {
    w.players.push(newContestant(m.id, m.name, m.color, w.clock));
  },
  remove: removeContestant,
  input(w, id, value) {
    w.players.find((p) => p.id === id)!.input = {
      x: Number(value.x),
      z: Number(value.z),
      seq: Number(value.seq),
    };
  },
  idle(p) {
    p.input = idleInput();
  },
  advance: advanceButton,
  act: (w, id, a, host) => buttonAction(w, id, a as ButtonAction, host),
  snapshot: buttonSnapshot,
};
export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
