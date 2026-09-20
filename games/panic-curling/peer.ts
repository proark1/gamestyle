import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import { reconcileCurlingBots, updateCurlingBots } from './bots';
import {
  advancePanicCurling,
  freshCurlingWorld,
  newCurlingPlayer,
  panicCurlingAction,
  panicCurlingSnapshot,
} from './simulation';
import {
  idleInput,
  type PanicCurlingAction,
  type PanicCurlingSnapshot,
  type PanicCurlingWorld,
  type Role,
  type StoneKind,
  type TeamId,
} from './types';

const adapter: GameAdapter<PanicCurlingWorld, PanicCurlingSnapshot> = {
  game: 'panic-curling',
  autonomous: (p) => !!p.bot,
  actions: [
    'start',
    'restart',
    'switchTeam',
    'switchRole',
    'switchGadget',
    'switchStone',
    'deliver',
    'throwBanana',
    'rescue',
  ],
  create: (now) => {
    const w = freshCurlingWorld(now);
    reconcileCurlingBots(w);
    return w;
  },
  add: (w, m) => {
    // Balance teams
    const redCount = w.players.filter((p) => !p.bot && p.team === 'red').length;
    const blueCount = w.players.filter(
      (p) => !p.bot && p.team === 'blue',
    ).length;
    const team: TeamId = redCount <= blueCount ? 'red' : 'blue';

    // Prefer deliverer if open, else sweeper
    const hasDeliverer = w.players.some(
      (p) => !p.bot && p.team === team && p.role === 'deliverer',
    );
    const role: Role = hasDeliverer ? 'sweeper' : 'deliverer';

    // Remove bot occupying this slot
    w.players = w.players.filter(
      (p) => !(p.bot && p.team === team && p.role === role),
    );

    w.players.push(newCurlingPlayer(m.id, m.name, m.color, team, role, false));
    reconcileCurlingBots(w);
  },
  remove: (w, id) => {
    w.players = w.players.filter((p) => p.id !== id);
    reconcileCurlingBots(w);
  },
  input: (w, id, raw) => {
    const player = w.players.find((p) => p.id === id);
    if (!player) return;
    player.input = {
      x: Number(raw.x) || 0,
      z: Number(raw.z) || 0,
      aimAngle: Number(raw.aimAngle) || 0,
      power: Number(raw.power) || 0.5,
      spin: Number(raw.spin) || 1,
      stoneKind: (raw.stoneKind as StoneKind) || 'granite',
      sweep: raw.sweep === true,
      steer: Number(raw.steer) || 0,
      tossBanana: raw.tossBanana === true,
      rescue: raw.rescue === true,
      seq: Number(raw.seq) || 0,
    };
    player.seen = w.clock;
  },
  idle: (p) => {
    p.input = idleInput();
  },
  advance: (w, now) => {
    updateCurlingBots(w, Math.min(0.1, (now - w.clock) / 1000));
    advancePanicCurling(w, now);
  },
  act: (w, id, a, host) => {
    panicCurlingAction(w, id, a as PanicCurlingAction, host === id);
    reconcileCurlingBots(w);
  },
  snapshot: (w, code, host, id, version) =>
    panicCurlingSnapshot(w, code, host, id, version),
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  return new PeerEngine(adapter, now, checkpoint);
}
