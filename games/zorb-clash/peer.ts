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
import { movement } from './controls';

const adapter: GameAdapter<ZorbClashWorld, ZorbClashSnapshot> = {
  game: 'zorb-clash',
  canJoin: () => true,
  autonomous: (p) => !!p.bot,
  actions: ['input', 'ready', 'reset', 'switch_team'],
  create: (now) => {
    const w = freshZorbWorld(now);
    // Add default bots to fill the arena if needed
    w.players.push(newZorbPlayer('bot-red-1', 'Bumper Bob', 1, 'red', true));
    w.players.push(newZorbPlayer('bot-red-2', 'Bouncer Bea', 0, 'red', true));
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

    const p = newZorbPlayer(m.id, m.name, m.color, team, false);
    for (let i = 0; i < 30; i++) {
      if (
        !w.players.some(
          (other) => Math.hypot(other.x - p.x, other.z - p.z) < 2.6,
        )
      )
        break;
      p.x = -12 + (i % 9) * 3;
      p.z = (team === 'red' ? -1 : 1) * (12 + Math.floor(i / 9) * 3);
    }
    w.players.push(p);
  },
  remove: (w, id) => {
    const player = w.players.find((p) => p.id === id);
    if (player) {
      player.id = `bot-${id}`;
      player.name = 'Bumper Bot';
      player.bot = true;
      player.input = idleInput();
      player.dashCharge = 0;
    }
  },
  input: (w, id, raw) => {
    const player = w.players.find((p) => p.id === id);
    if (!player) return;
    player.input = {
      ...movement(Number(raw.x), Number(raw.z)),
      dash: raw.dash === true,
      brace: raw.brace === true,
      wiggle: raw.wiggle === true,
    };
    player.seen = w.clock;
  },
  idle: (p) => {
    p.input = idleInput();
    p.dashCharge = 0;
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
