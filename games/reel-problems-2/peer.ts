import {
  PeerEngine,
  type EngineCheckpoint,
  type GameAdapter,
} from '../../shared/peer/engine';
import {
  freshReel,
  newAngler,
  removeAngler,
  reconcileReelNpcs,
  advanceReel,
  reelAction,
  reelSnapshot,
} from './simulation';
import {
  LEAK_FIRST_MS,
  idleInput,
  type ReelAction,
  type ReelSnapshot,
  type ReelWorld,
} from './types';
import { freshDebris, freshWeather, freshWildlife } from './chaos';

const adapter: GameAdapter<ReelWorld, ReelSnapshot> = {
  game: 'reel-problems-2',
  autonomous: (player) => !!player.bot,
  roster: (world, roster) => reconcileReelNpcs(world, roster.slots),
  actions: [
    'start',
    'restart',
    'cast',
    'cut',
    'untangle',
    'rescue',
    'jump',
    'paddle',
    'sail',
    'drop',
  ],
  create: freshReel,
  add: (w, m) => {
    w.players.push(newAngler(m.id, m.name, m.color, w.clock));
  },
  remove: removeAngler,
  input(w, id, value) {
    const p = w.players.find((p) => p.id === id)!;
    p.input = {
      x: Number(value.x),
      z: Number(value.z),
      seq: Number(value.seq),
      reel: value.reel === true,
      work: value.work === true,
      brace: value.brace === true,
    };
  },
  idle(p) {
    p.input = idleInput();
  },
  advance: advanceReel,
  act: (w, id, a, host) => reelAction(w, id, a as ReelAction, host),
  snapshot: reelSnapshot,
};
export function createEngine(now: number, checkpoint?: EngineCheckpoint) {
  const engine = new PeerEngine(adapter, now, checkpoint);
  // Held reeling and bracing are transient, just like movement, after a handover.
  if (checkpoint) {
    const w = engine.world;
    w.mode ??= 'classic';
    w.schemaVersion = 2;
    if (w.mission) {
      w.mission.holds = {};
      w.mission.latched = [];
    }
    // Upgrade pre-weather checkpoints using existing player lines as hook links.
    w.weather ??= freshWeather(w.clock);
    w.wildlife ??= freshWildlife(w.clock);
    // Checkpoints from before leaks, gulls, crabs and driftwood.
    if (!w.mission && !w.wildlife.some((v) => v.kind === 'gull'))
      w.wildlife.push(
        ...freshWildlife(w.clock).filter((v) => v.kind === 'gull'),
      );
    w.debris ??= freshDebris();
    w.leak ??= null;
    w.crab ??= null;
    w.pending ??= null;
    w.leaks ??= 0;
    w.sinks ??= 0;
    w.leakReadyAt ??= w.started + LEAK_FIRST_MS;
    w.leakDueAt ??= w.leakReadyAt + 15_000;
    w.boat.flood ??= 0;
    w.boat.sunk ??= false;
    w.boat.sunkAt ??= 0;
    w.boat.hull ??= 0;
    for (const f of w.fish) f.stunnedUntil ??= 0;
    for (const p of w.players) {
      p.input = idleInput();
      p.support ??= p.swimming ? 'water' : 'boat';
      p.slipX ??= 0;
      p.slipZ ??= 0;
      p.clinging ??= false;
      p.climb ??= 0;
      p.health ??= 1;
      p.stunUntil ??= 0;
      p.downedUntil ??= 0;
      p.y ??= 0;
      p.vy ??= 0;
      p.landedAt ??= 0;
      p.pinched ??= false;
      p.paddle ??= 0;
    }
  }
  return engine;
}
