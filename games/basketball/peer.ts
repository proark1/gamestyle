import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceBasketball,
  basketballAction,
  basketballSnapshot,
  freshBasketballWorld,
  newPlayer,
  seatHuman,
} from './simulation';
import { reconcileBasketballBots, stepBasketballBot } from './bots';
import {
  idleInput,
  type BasketballAction,
  type BasketballSnapshot,
  type BasketballWorld,
  type TeamId,
} from './types';

const adapter: GameAdapter<BasketballWorld, BasketballSnapshot> = {
  game: 'basketball',
  autonomous: (p) => !!p.bot,
  actions: [
    'start',
    'restart',
    'switchTeam',
    'shoot',
    'pass',
    'steal',
    'superJump',
  ],
  create: (now) => {
    const w = freshBasketballWorld(now);
    reconcileBasketballBots(w);
    return w;
  },
  add: (w, m) => {
    // Balance teams (Red vs Blue)
    const redHumans = w.players.filter(
      (p) => !p.bot && p.team === 'red',
    ).length;
    const blueHumans = w.players.filter(
      (p) => !p.bot && p.team === 'blue',
    ).length;
    const team: TeamId = redHumans <= blueHumans ? 'red' : 'blue';
    seatHuman(w, newPlayer(m.id, m.name, m.color, team), team);
  },
  remove: (w, id) => {
    w.players = w.players.filter((p) => p.id !== id);
    reconcileBasketballBots(w);
  },
  input(w, id, raw) {
    const player = w.players.find((p) => p.id === id);
    if (!player) return;
    player.input = {
      x: Number(raw.x) || 0,
      z: Number(raw.z) || 0,
      shoot: raw.shoot === true,
      pass: raw.pass === true,
      steal: raw.steal === true,
      sprint: raw.sprint === true,
      crossover: raw.crossover === true,
      spin: raw.spin === true,
      seq: Number(raw.seq) || 0,
    };
    player.seen = w.clock;
  },
  idle(p) {
    p.input = idleInput();
  },
  // The engine passes an absolute time; this simulation steps by elapsed
  // seconds. Handing it `now` directly treated a timestamp as a step, so the
  // clock grew exponentially to Infinity and handover rejected the checkpoint.
  // The bots run here as the solo loop runs them; the simulation does not.
  advance: (w, now) => {
    const dt = Math.min(0.05, Math.max(0, (now - w.clock) / 1000));
    for (const p of w.players) if (p.bot) stepBasketballBot(p, w, dt);
    advanceBasketball(w, dt);
  },
  act: (w, id, a, host) => {
    basketballAction(w, id, a as BasketballAction, host === id);
  },
  snapshot: (w, code, host, id, version) =>
    basketballSnapshot(w, code, host, id, version),
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
