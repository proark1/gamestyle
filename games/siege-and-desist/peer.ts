import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceSiege,
  freshSiege,
  newCrew,
  reconcileClashBots,
  removeCrew,
  siegeAction,
  siegeSnapshot,
} from './simulation';
import {
  idleInput,
  type GameMode,
  type SiegeAction,
  type SiegeSnapshot,
  type SiegeWorld,
} from './types';

let configuredMode: GameMode = 'clash2v2';

export function setConfiguredMode(mode: GameMode) {
  configuredMode = mode;
}

export function getConfiguredMode(): GameMode {
  if (typeof location !== 'undefined') {
    const urlMode = new URL(location.href).searchParams.get('mode');
    if (urlMode === 'clash2v2' || urlMode === 'classic') return urlMode;
  }
  return configuredMode;
}

const adapter: GameAdapter<SiegeWorld, SiegeSnapshot> = {
  game: 'siege-and-desist',
  snapshotDetached: true,
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
  create: (now) => {
    const mode = getConfiguredMode();
    return freshSiege(now, mode);
  },
  add: (w, m) => {
    if (w.mode === 'clash2v2') {
      const redHumans = w.players.filter(
        (p) => !p.bot && (p.team ?? 'red') === 'red',
      ).length;
      const blueHumans = w.players.filter(
        (p) => !p.bot && p.team === 'blue',
      ).length;
      const team = blueHumans < redHumans ? 'blue' : 'red';
      w.players.push(
        newCrew(m.id, m.name, m.color, w.clock, team, false, 'clash2v2'),
      );
      reconcileClashBots(w);
    } else {
      w.players.push(newCrew(m.id, m.name, m.color, w.clock));
    }
  },
  remove: (w, id) => {
    removeCrew(w, id);
    if (w.mode === 'clash2v2') {
      reconcileClashBots(w);
    }
  },
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
  act: (w, id, a, host) => {
    siegeAction(w, id, a as SiegeAction, host);
    if (w.mode === 'clash2v2') {
      reconcileClashBots(w);
    }
  },
  snapshot: siegeSnapshot,
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
