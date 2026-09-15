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
} from './simulation';
import { reconcileBasketballBots } from './bots';
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
    // Balance teams (Orange vs Teal)
    const orangeHumans = w.players.filter(
      (p) => !p.bot && p.team === 'orange',
    ).length;
    const tealHumans = w.players.filter(
      (p) => !p.bot && p.team === 'teal',
    ).length;
    const team: TeamId = orangeHumans <= tealHumans ? 'orange' : 'teal';

    // Remove a bot from the chosen team if present
    const botIdx = w.players.findIndex((p) => p.bot && p.team === team);
    if (botIdx >= 0) {
      w.players.splice(botIdx, 1);
    }

    w.players.push(newPlayer(m.id, m.name, m.color, team, false, orangeHumans));
    reconcileBasketballBots(w);
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
      seq: Number(raw.seq) || 0,
    };
    player.seen = w.clock;
  },
  idle(p) {
    p.input = idleInput();
  },
  advance: advanceBasketball,
  act: (w, id, a, host) => {
    basketballAction(w, id, a as BasketballAction, host === id);
  },
  snapshot: (w, code, host, id, version) =>
    basketballSnapshot(w, code, host, id, version),
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
