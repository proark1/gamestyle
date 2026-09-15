import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceZorbClashWorld,
  freshZorbWorld,
  newZorbPlayer,
  zorbClashAction,
  zorbClashSnapshot,
} from './simulation';
import {
  idleInput,
  type TeamId,
  type ZorbClashAction,
  type ZorbClashSnapshot,
  type ZorbClashWorld,
} from './types';

const adapter: GameAdapter<ZorbClashWorld, ZorbClashSnapshot> = {
  game: 'zorb-clash',
  autonomous: (p) => !!p.bot,
  actions: ['input', 'ready', 'reset', 'switch_team'],
  create: (now) => {
    const w = freshZorbWorld(now);
    // Add default bots to fill the arena if needed
    w.players.push(newZorbPlayer('bot-red-1', 'Bumper Bob', 1, 'red', true));
    w.players.push(newZorbPlayer('bot-blue-1', 'Sumo Sam', 2, 'blue', true));
    w.players.push(newZorbPlayer('bot-blue-2', 'Rollin Ron', 3, 'blue', true));
    return w;
  },
  add: (w, m) => {
    const redCount = w.players.filter((p) => !p.bot && p.team === 'red').length;
    const blueCount = w.players.filter(
      (p) => !p.bot && p.team === 'blue',
    ).length;
    const team: TeamId = redCount <= blueCount ? 'red' : 'blue';

    // Remove a bot if arena is full
    const botIdx = w.players.findIndex((p) => p.bot && p.team === team);
    if (botIdx >= 0) {
      w.players.splice(botIdx, 1);
    }

    w.players.push(newZorbPlayer(m.id, m.name, m.color, team, false));
  },
  remove: (w, id) => {
    w.players = w.players.filter((p) => p.id !== id);
  },
  input: (w, id, raw) => {
    const player = w.players.find((p) => p.id === id);
    if (!player) return;
    player.input = {
      x: Number(raw.x) || 0,
      z: Number(raw.z) || 0,
      dash: raw.dash === true,
      brace: raw.brace === true,
      wiggle: raw.wiggle === true,
    };
    player.seen = w.clock;
  },
  idle: (p) => {
    p.input = idleInput();
  },
  advance: advanceZorbClashWorld,
  act: (w, id, a, host) => {
    zorbClashAction(w, id, a as ZorbClashAction, host === id);
  },
  snapshot: (w, code, host, id, version) =>
    zorbClashSnapshot(w, code, host, id, version),
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
