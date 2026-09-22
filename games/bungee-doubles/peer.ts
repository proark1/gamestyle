import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  bungeeAction,
  bungeeSnapshot,
  freshBungeeWorld,
  newPlayer,
  prepareServe,
} from './simulation';
import { reconcileBungeeBots } from './bots';
import { createBungeeRunner } from './runner';
import {
  idleInput,
  type BungeeAction,
  type BungeeSnapshot,
  type BungeeWorld,
  type TeamId,
} from './types';

const adapter: Omit<GameAdapter<BungeeWorld, BungeeSnapshot>, 'advance'> = {
  game: 'bungee-doubles',
  autonomous: (p) => !!p.bot,
  actions: ['start', 'restart', 'switchTeam', 'swing', 'smash', 'dive', 'jump'],
  create: (now) => {
    const w = freshBungeeWorld(now);
    reconcileBungeeBots(w);
    prepareServe(w, 'red');
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

    // Remove a bot from the chosen team if present
    const botIdx = w.players.findIndex((p) => p.bot && p.team === team);
    if (botIdx >= 0) {
      w.players.splice(botIdx, 1);
    }

    w.players.push(
      newPlayer(
        m.id,
        m.name,
        m.color,
        team,
        false,
        team === 'red' ? redHumans : blueHumans,
      ),
    );
    reconcileBungeeBots(w);
    if (w.phase === 'serving') prepareServe(w, w.serverTeam);
  },
  remove: (w, id) => {
    w.players = w.players.filter((p) => p.id !== id);
    reconcileBungeeBots(w);
    if (w.phase !== 'ended') prepareServe(w, w.serverTeam);
  },
  input(w, id, raw) {
    const player = w.players.find((p) => p.id === id);
    if (!player) return;
    player.input = {
      x: Number.isFinite(Number(raw.x))
        ? Math.max(-1, Math.min(1, Number(raw.x)))
        : 0,
      z: Number.isFinite(Number(raw.z))
        ? Math.max(-1, Math.min(1, Number(raw.z)))
        : 0,
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
  act: (w, id, a, _host) => {
    bungeeAction(w, id, a as BungeeAction, w.clock);
  },
  snapshot: (w, code, host, id, version) =>
    bungeeSnapshot(w, code, host, id, version),
};

export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  const run = createBungeeRunner();
  const partyRun = createBungeeRunner(5000);
  return new PeerEngine(
    {
      ...adapter,
      advance: (w, clock) => {
        ((w as BungeeWorld & { partyRoundStarted?: boolean }).partyRoundStarted
          ? partyRun
          : run)(w, (clock - w.clock) / 1000);
      },
    },
    now,
    checkpoint,
  );
}
