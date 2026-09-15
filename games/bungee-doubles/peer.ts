import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  advanceBungee,
  bungeeAction,
  bungeeSnapshot,
  freshBungeeWorld,
  newPlayer,
} from './simulation';
import { reconcileBungeeBots } from './bots';
import {
  idleInput,
  type BungeeAction,
  type BungeeSnapshot,
  type BungeeWorld,
  type TeamId,
} from './types';

const adapter: GameAdapter<BungeeWorld, BungeeSnapshot> = {
  game: 'bungee-doubles',
  autonomous: (p) => !!p.bot,
  actions: ['start', 'restart', 'switchTeam', 'swing', 'smash', 'dive', 'jump'],
  create: (now) => {
    const w = freshBungeeWorld(now);
    reconcileBungeeBots(w);
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
    reconcileBungeeBots(w);
  },
  remove: (w, id) => {
    w.players = w.players.filter((p) => p.id !== id);
    reconcileBungeeBots(w);
  },
  input(w, id, raw) {
    const player = w.players.find((p) => p.id === id);
    if (!player) return;
    player.input = {
      x: Number(raw.x) || 0,
      z: Number(raw.z) || 0,
      swing: raw.swing === true,
      smash: raw.smash === true,
      dive: raw.dive === true,
      jump: raw.jump === true,
      seq: Number(raw.seq) || 0,
    };
    player.seen = w.clock;
  },
  idle(p) {
    p.input = idleInput();
  },
  advance: advanceBungee,
  act: (w, id, a, _host) => {
    bungeeAction(w, id, a as BungeeAction);
  },
  snapshot: (w, code, host, id, version) =>
    bungeeSnapshot(w, code, host, id, version),
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
