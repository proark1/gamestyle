import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceScaffoldScramble,
  freshScaffoldWorld,
  newPlayer,
  scaffoldScrambleAction,
  scaffoldScrambleSnapshot,
} from './simulation';
import { reconcileScaffoldBots } from './bots';
import {
  idleInput,
  type Role,
  type ScaffoldAction,
  type ScaffoldSnapshot,
  type ScaffoldScrambleWorld,
} from './types';

const adapter: GameAdapter<ScaffoldScrambleWorld, ScaffoldSnapshot> = {
  game: 'scaffold-scramble',
  autonomous: (p) => !!p.bot,
  actions: [
    'start',
    'restart',
    'crank',
    'useTool',
    'switchTool',
    'shoo',
    'climb',
    'switchRole',
  ],
  create: (now) => {
    const w = freshScaffoldWorld(now);
    reconcileScaffoldBots(w);
    return w;
  },
  add: (w, m) => {
    // Determine player role based on current roster
    const hasLeft = w.players.some((p) => !p.bot && p.role === 'left-winch');
    const hasRight = w.players.some((p) => !p.bot && p.role === 'right-winch');
    let role: Role = 'cleaner';
    if (!hasLeft) role = 'left-winch';
    else if (!hasRight) role = 'right-winch';

    // Remove a bot if present to make room for human
    const botIdx = w.players.findIndex((p) => p.bot);
    if (botIdx >= 0) {
      w.players.splice(botIdx, 1);
    }

    w.players.push(
      newPlayer(m.id, m.name, m.color, role, false, w.players.length),
    );
    reconcileScaffoldBots(w);
  },
  remove: (w, id) => {
    w.players = w.players.filter((p) => p.id !== id);
    reconcileScaffoldBots(w);
  },
  input(w, id, raw) {
    const player = w.players.find((p) => p.id === id);
    if (!player) return;
    player.input = {
      x: Number(raw.x) || 0,
      z: Number(raw.z) || 0,
      crankLeftUp: raw.crankLeftUp === true,
      crankLeftDown: raw.crankLeftDown === true,
      crankRightUp: raw.crankRightUp === true,
      crankRightDown: raw.crankRightDown === true,
      action: raw.action === true,
      jump: raw.jump === true,
      switchTool: raw.switchTool === true,
      seq: Number(raw.seq) || 0,
    };
    player.seen = w.clock;
  },
  idle(p) {
    p.input = idleInput();
  },
  advance: advanceScaffoldScramble,
  act: (w, id, a, _host) => {
    scaffoldScrambleAction(w, id, a as ScaffoldAction);
  },
  snapshot: (w, code, host, id, version) =>
    scaffoldScrambleSnapshot(w, code, host, id, version),
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
