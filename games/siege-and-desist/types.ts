import type { Session } from '../../shared/rooms/session';

export const ROUND_MS = 240_000;
export const RELIEF_MS = 30_000;
/** The crew colours follow the Kayi standard: felt red, steppe teal, brass, plum. */
export const COLORS = ['#c2472f', '#2f7d74', '#d8a13d', '#7c5aa0'];
export const FIELD = { x: 26, z: 30 };
export const CASTLE = { x: 0, z: -13.6 };
export const TREBUCHET = { x: 0, z: 15 };
export const CRANK = { x: 0, z: 19.2 };
export const LEVER = { x: 3.1, z: 16.6 };
export const SLING = { x: 0, z: 11.4 };
export const PILE = { x: -7.4, z: 19 };
export const MAX_TURN = 0.42;
export const BANNER_DOWN = 3.2;

/** Siege stones are heavy on purpose: a light one bounces off good masonry. */
export const AMMO = {
  boulder: {
    name: 'Boulder',
    mass: 90,
    radius: 0.62,
    damage: 1,
    color: '#8e8778',
  },
  firepot: {
    name: 'Fire pot',
    mass: 34,
    radius: 0.46,
    damage: 0.35,
    color: '#d2622f',
  },
  beehive: {
    name: 'Beehive',
    mass: 26,
    radius: 0.48,
    damage: 0.2,
    color: '#c8973c',
  },
  cow: {
    name: 'The cow',
    mass: 170,
    radius: 0.95,
    damage: 1.8,
    color: '#e8e0d0',
  },
  crew: {
    name: 'A volunteer',
    mass: 78,
    radius: 0.5,
    damage: 0.5,
    color: '#f0d3a8',
  },
} as const;
export type AmmoKind = keyof typeof AMMO;
export const AMMO_ORDER: AmmoKind[] = ['boulder', 'firepot', 'beehive', 'cow'];

export type SiegeInput = { x: number; z: number; seq: number };
export const idleInput = (): SiegeInput => ({ x: 0, z: 0, seq: 0 });

export type Crew = {
  id: string;
  name: string;
  color: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: number;
  carrying: AmmoKind | null;
  /** Set while this crew member is riding the sling or flying through the air. */
  flying: boolean;
  winding: boolean;
  pushing: number;
  stunnedUntil: number;
  seen: number;
  input: SiegeInput;
  lastJump: number;
  lastAction: number;
  hits: number;
  loaded: number;
  launches: number;
};

/** One rigid block of the keep. Quaternions arrive from the solver once it moves. */
export type Block = {
  id: number;
  part: 'wall' | 'gate' | 'tower' | 'keep' | 'banner';
  w: number;
  h: number;
  d: number;
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  color: string;
  /** Where the block started, so the scorer can tell rubble from masonry. */
  homeY: number;
  homeX: number;
  homeZ: number;
  burning: number;
  sleeping: boolean;
  fallen: boolean;
};

export type Shot = {
  id: number;
  kind: AmmoKind;
  rider: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  landed: number;
  /** When this shot first bit into the masonry, so it only lands one blow. */
  struck: number;
};

export type Pot = {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

export type SiegeEvent = {
  id: number;
  at: number;
  kind:
    | 'start'
    | 'wind'
    | 'load'
    | 'loose'
    | 'impact'
    | 'rubble'
    | 'squash'
    | 'pot'
    | 'bees'
    | 'banner'
    | 'finish';
  text: string;
};

export type SiegeWorld = {
  clock: number;
  started: number;
  remainder: number;
  phase: 'lobby' | 'playing' | 'relief' | 'won' | 'lost';
  players: Crew[];
  blocks: Block[];
  totalBlocks: number;
  /** Blocks burnt away. Guests need these to prune their rebuilt baseline. */
  gone: number[];
  shots: Shot[];
  pots: Pot[];
  events: SiegeEvent[];
  eventId: number;
  shotId: number;
  potId: number;
  /** Counterweight travel, 0 resting to 1 fully wound. */
  wind: number;
  turn: number;
  loaded: AmmoKind | null;
  rider: string;
  /** Timestamp of the release, so the arm animation and the shot stay in step. */
  loosedAt: number;
  supply: AmmoKind[];
  rubble: number;
  bannerDown: boolean;
  beesUntil: number;
  reliefAt: number;
  nextPot: number;
  crewSize: number;
  volleys: number;
};

export type SiegeAction = {
  type:
    | 'start'
    | 'restart'
    | 'grab'
    | 'load'
    | 'wind'
    | 'stopWind'
    | 'push'
    | 'stopPush'
    | 'loose'
    | 'ride'
    | 'jump'
    | 'help';
  side?: number;
};

export type SiegeSnapshot = {
  code: string;
  host: string;
  version: number;
  world: SiegeWorld;
};
export type SiegeSession = Session;

export const windTime = (crew: number) => 5200 + 4200 / Math.max(1, crew);
/**
 * Ballistics. The arm throws at a deliberately flat 38 degrees so shots strike
 * the face of a wall rather than dropping vertically past it, and the muzzle
 * speed is tuned so a light wind reaches the gate and a heavy one clears the
 * wall to reach the keep behind it.
 */
export const ELEVATION = 0.663;
export const LAUNCH_Y = 5.4;
export const GRAVITY = 12;
export const power = (wind: number) => 10 + wind * 9;
/** True ground range for a wind, so the aiming ring never lies to the crew. */
export function rangeFor(wind: number) {
  const v = power(wind);
  const across = v * Math.cos(ELEVATION);
  const up = v * Math.sin(ELEVATION);
  return (
    (across / GRAVITY) * (up + Math.sqrt(up * up + 2 * GRAVITY * LAUNCH_Y))
  );
}
export const tally = (n: number) =>
  `${Math.max(0, Math.round(n))} stone${Math.round(n) === 1 ? '' : 's'}`;
