import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceCraneClash,
  craneClashAction,
  craneClashSnapshot,
  freshClashWorld,
  newPlayer,
} from './simulation';
import { reconcileClashBots } from './bots';
import {
  idleInput,
  type CraneClashAction,
  type CraneClashSnapshot,
  type CraneClashWorld,
  type Role,
  type TeamId,
} from './types';

const adapter: GameAdapter<CraneClashWorld, CraneClashSnapshot> = {
  game: 'crane-clash',
  autonomous: (p) => !!p.bot,
  actions: [
    'start',
    'restart',
    'switchTeam',
    'switchRole',
    'grab',
    'release',
    'setMode',
  ],
  create: (now) => {
    const w = freshClashWorld(now);
    reconcileClashBots(w);
    return w;
  },
  add: (w, m) => {
    // Determine team with fewer humans
    const redHumans = w.players.filter(
      (p) => !p.bot && p.team === 'red',
    ).length;
    const blueHumans = w.players.filter(
      (p) => !p.bot && p.team === 'blue',
    ).length;
    const team: TeamId = redHumans <= blueHumans ? 'red' : 'blue';

    // Determine role (prefer operator if empty, else swinger)
    const operatorTaken = w.players.some(
      (p) => !p.bot && p.team === team && p.role === 'operator',
    );
    const role: Role = operatorTaken ? 'swinger' : 'operator';

    // Remove bot occupying this slot if present
    w.players = w.players.filter(
      (p) => !(p.bot && p.team === team && p.role === role),
    );

    w.players.push(newPlayer(m.id, m.name, m.color, team, role, false));
    reconcileClashBots(w);
  },
  remove: (w, id) => {
    w.players = w.players.filter((p) => p.id !== id);
    reconcileClashBots(w);
  },
  input(w, id, raw) {
    const player = w.players.find((p) => p.id === id);
    if (!player) return;
    player.input = {
      x: Number(raw.x) || 0,
      z: Number(raw.z) || 0,
      y: Number(raw.y) || 0,
      grab: raw.grab === true,
      tuck: raw.tuck === true,
      seq: Number(raw.seq) || 0,
    };
    player.seen = w.clock;
  },
  idle(p) {
    p.input = idleInput();
  },
  advance: advanceCraneClash,
  act: (w, id, a, host) => {
    craneClashAction(w, id, a as CraneClashAction, host === id);
  },
  snapshot: (w, code, host, id, version) =>
    craneClashSnapshot(w, code, host, id, version),
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
