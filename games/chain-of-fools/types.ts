/**
 * Chain of Fools: four workers share one safety line across a demolition site.
 * The line is what saves them and what dooms them — it never breaks, so a
 * teammate over the edge is always still attached to somebody standing.
 */

export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.68;

export const WALK_SPEED = 4.6;
export const AIR_CONTROL = 0.42;
export const JUMP_SPEED = 7.2;
export const GRAVITY = -18.0;
export const TERMINAL_FALL = -22.0;

/** Free movement inside this distance; past it the line starts to pull. */
export const CHAIN_SLACK = 3.2;
/** The line cannot be stretched past this. Positional correction enforces it. */
export const CHAIN_MAX = 4.6;
export const CHAIN_STIFFNESS = 46;
export const CHAIN_DAMPING = 6.0;
/** Solver passes per tick. More passes propagate pull further along the line. */
export const CHAIN_ITERATIONS = 12;

/** Inverse mass by stance: 0 is an immovable anchor, 1 is pure dead weight. */
export const INV_MASS_BRACED = 0.0;
export const INV_MASS_GROUNDED = 0.35;
export const INV_MASS_AIRBORNE = 1.0;
export const INV_MASS_LIMP = 1.0;

export const BRACE_STAMINA_MAX = 3.6;
export const BRACE_STAMINA_DRAIN = 1.0;
export const BRACE_STAMINA_RECOVER = 0.7;
/** Once drained, boots need this long before they will hold again. */
export const BRACE_COOLDOWN = 2.4;

/** Stand-in support height for a worker with nothing at all beneath them. */
export const NO_SUPPORT = -999;
/**
 * A worker is hanging on the line, rather than merely mid-jump, once they have
 * been off the ground this long with nothing within reach below.
 */
export const DANGLE_AIR_TIME = 0.45;
export const DANGLE_DROP = 2.5;
/** Below this the crew is gone and the run resets. */
export const WIPE_Y = -40.0;

export const HAUL_REACH = 3.4;
export const HAUL_RATE = 1.35;
export const REVIVE_REACH = 2.0;
export const REVIVE_SECONDS = 1.6;
export const CLIP_REACH = 2.4;

export const LIMP_SECONDS = 9.0;
export const ROUND_TIME_MS = 270_000;
export const SWITCHYARD_ROUND_TIME_MS = 360_000;
export const RESPAWN_MS = 1600;

export const CREW_SIZE = 4;
import type { MapId } from './course';

export type PlayerInput = {
  /** Camera-relative movement, already normalized by the scene. */
  x: number;
  z: number;
  jump: boolean;
  brace: boolean;
  haul: boolean;
  seq: number;
};

export function idleInput(): PlayerInput {
  return { x: 0, z: 0, jump: false, brace: false, haul: false, seq: 0 };
}

export type PlayerState =
  | 'standing'
  | 'airborne'
  | 'dangling'
  | 'limp'
  | 'finished';

export type Player = {
  id: string;
  name: string;
  color: number;
  bot: boolean;
  /** Position in the line, 0 to 3. Neighbours are link-1 and link+1. */
  link: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: number;
  state: PlayerState;
  grounded: boolean;
  braced: boolean;
  stamina: number;
  braceCooldown: number;
  /** Seconds since this worker last had boots on something. */
  airTime: number;
  jumpGrace: number;
  /** Ring this worker clipped the line to, turning the link into a pivot. */
  anchorId: string | null;
  /** Ground height under the worker, or NO_SUPPORT over open air. */
  supportY: number;
  /** Progress while teammates haul this worker back up, 0 to 1. */
  haulProgress: number;
  /** Seconds left before a limp worker gets up unaided. */
  limpTimer: number;
  reviveProgress: number;
  respawnAt: number;
  /** Furthest checkpoint this worker has personally banked. */
  checkpoint: number;
  falls: number;
  hauls: number;
  braceTime: number;
  input: PlayerInput;
  seen: number;
};

/** One segment of the safety line, for rendering and HUD tension. */
export type ChainLink = {
  a: string;
  b: string;
  distance: number;
  /** 0 while slack, 1 at the hard limit. */
  tension: number;
  taut: boolean;
};

export type GameEvent = {
  id: number;
  type:
    | 'jump'
    | 'land'
    | 'chain_taut'
    | 'chain_yank'
    | 'brace'
    | 'dangle'
    | 'haul_start'
    | 'haul_done'
    | 'limp'
    | 'revive'
    | 'clip'
    | 'unclip'
    | 'checkpoint'
    | 'wipe'
    | 'pendulum_swing'
    | 'plank_tip'
    | 'win'
    | 'timeout';
  playerId?: string;
  detail?: string;
  pos?: [number, number, number];
};

export type ChainWorld = {
  mapId: MapId;
  plateActive: boolean[];
  switchProgress: [number, number, number];
  gatesOpen: [boolean, boolean, boolean];
  /** Next numbered relay plate; each stage needs a different worker. */
  relayStep: number;
  relayWorkers: string[];
  relayArmed: boolean;
  seed: number;
  clock: number;
  started: number;
  phase: 'lobby' | 'playing' | 'ended';
  startedAt: number;
  endsAt: number;
  endedAt: number;
  winner: 'crew' | 'failed' | null;
  players: Player[];
  links: ChainLink[];
  /** Furthest checkpoint the whole crew has banked. */
  checkpoint: number;
  /** Swing angle of the wrecking load, radians. */
  pendulumAngle: number;
  pendulumVel: number;
  /** Worker hanging off the hook to stall the load, if any. */
  pendulumRider: string | null;
  /** Tilt of the balance plank on the scaffold, radians. */
  plankTilt: number;
  plankVel: number;
  /** Seconds the entire crew has been over nothing at once. */
  hangTime: number;
  wipes: number;
  bestX: number;
  events: GameEvent[];
  eventId: number;
};

export type ChainAction =
  | { type: 'start' }
  | { type: 'restart' }
  | { type: 'select_map'; mapId: MapId }
  | { type: 'jump' }
  | { type: 'clip' }
  | { type: 'ping' };

export type ChainSnapshot = {
  code: string;
  host: string;
  me: string;
  version: number;
  world: ChainWorld;
};

export type ChainSession = {
  id: string;
  token: string;
  code: string;
  name: string;
  color: number;
};

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function timeLeft(world: ChainWorld): number {
  if (world.phase === 'lobby')
    return world.mapId === 'switchyard'
      ? SWITCHYARD_ROUND_TIME_MS
      : ROUND_TIME_MS;
  return Math.max(0, world.endsAt - (world.endedAt || world.clock));
}

/** Inverse mass for the chain solver: what this worker's stance can resist. */
export function inverseMass(player: Player): number {
  if (player.state === 'finished') return 0;
  if (player.state === 'limp') return INV_MASS_LIMP;
  if (player.braced && player.grounded) return INV_MASS_BRACED;
  if (player.anchorId) return INV_MASS_BRACED;
  if (player.grounded) return INV_MASS_GROUNDED;
  return INV_MASS_AIRBORNE;
}

/** Players in line order, so link 0 is always the front of the chain. */
export function chainOrder(world: ChainWorld): Player[] {
  return [...world.players].sort((a, b) => a.link - b.link);
}
