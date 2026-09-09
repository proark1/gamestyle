import type { Session } from '../../shared/rooms/session';

export const ROUND_MS = 300_000;
export const LAKE_RADIUS = 42;
export const BOAT_HALF = { x: 2.25, z: 3.4 };
/** Outer hull, wider than the walkable deck. Solid to catches and to hooks. */
export const HULL_HALF = { x: 2.65, z: 3.9 };
/** How far off the hull a beaten catch can be lifted aboard. */
export const NET_REACH = 1.8;
/** Live-well water line in boat-local metres: where a landed catch drops in. */
export const WELL_SURFACE = 1.12;
/** How long a catch spends arcing out of the lake and into the well. */
export const LANDING_MS = 780;
/** Hump on that arc, enough to clear the gunwale and the well rim. */
export const LANDING_ARC = 5.6;
/**
 * Where a catch sits at progress `t` of being lifted from the lake into the
 * well: a straight run to the well plus a hump, finishing on the water line
 * rather than under it.
 */
export function landingPose(
  t: number,
  from: { x: number; y: number; z: number },
  well: { x: number; y: number; z: number },
) {
  return {
    x: from.x + (well.x - from.x) * t,
    y: from.y + (well.y - 0.1 - from.y) * t + LANDING_ARC * (t - t * t),
    z: from.z + (well.z - from.z) * t,
  };
}
/** Catches shrink on the way in, so even the Lake Manager fits through the hatch. */
export const landingScale = (t: number, size: number) =>
  size * (1 - 0.55 * Math.max(0, t - 0.6) * 2.5);
/** How hard the wind shoves the boat across the lake. */
export const WIND_FORCE = 10;
/**
 * How far a gust heels the boat. Low enough that weather rocks the deck and
 * makes casting awkward instead of sweeping the crew straight over the rail.
 */
export const WIND_ROLL = 0.3;
export const WIND_PITCH = 0.22;
/** How close to the hull a swimmer has to be to catch hold of it. */
export const GRAB_REACH = 1.6;
/** Held-E milliseconds to haul yourself up the side and over the gunwale. */
export const CLIMB_MS = 5000;
/** Damage to a swimmer, out of one whole angler. Two shark bites is fatal. */
export const SHARK_BITE = 0.55;
export const JELLY_STING = 0.2;
/** How close the wildlife has to get to land a hit. */
export const SHARK_REACH = 1.7;
export const JELLY_REACH = 1.9;
/**
 * Long enough that an angler who swims straight back after a bite can just
 * finish the climb before the shark comes round again. Slower than that and
 * the water wins.
 */
export const BITE_COOLDOWN = 6000;
export const STING_COOLDOWN = 1800;
/** A sting shocks the hands open: no grip and no climbing until it passes. */
export const STING_STUN_MS = 1600;
/** Pulled under. The crew hauls you out, and the boat pays for the delay. */
export const DOWNED_MS = 6000;
export const DOWNED_PENALTY = 15;
export const ANGLER_COLORS = ['#edac39', '#56a6a0', '#e9745b', '#807dcc'];
export const CATCHES = {
  perch: {
    name: 'Pocket perch',
    value: 12,
    power: 3,
    stamina: 4,
    color: '#e7b652',
    size: 0.55,
  },
  salmon: {
    name: 'Disco salmon',
    value: 24,
    power: 5,
    stamina: 7,
    color: '#ee8e8e',
    size: 0.8,
  },
  eel: {
    name: 'Drama eel',
    value: 32,
    power: 7,
    stamina: 8,
    color: '#b9ad69',
    size: 0.85,
  },
  pike: {
    name: 'Business pike',
    value: 45,
    power: 9,
    stamina: 10,
    color: '#88a987',
    size: 1.15,
  },
  monster: {
    name: 'The Lake Manager',
    value: 100,
    power: 21,
    stamina: 19,
    color: '#278b93',
    size: 2.65,
  },
  tire: {
    name: 'Tyre outrigger',
    value: 5,
    power: 2,
    stamina: 2,
    color: '#475052',
    size: 0.65,
  },
  magnet: {
    name: 'Lucky magnet',
    value: 5,
    power: 2,
    stamina: 2,
    color: '#de6a54',
    size: 0.5,
  },
  boot: {
    name: 'Lucky old boot',
    value: 5,
    power: 2,
    stamina: 2,
    color: '#bd8c56',
    size: 0.5,
  },
} as const;
export type CatchKind = keyof typeof CATCHES;
export type Vector = { x: number; z: number };
export type ReelInput = Vector & { reel: boolean; brace: boolean; seq: number };
export type FishingLine = {
  kind: 'waiting' | 'fish' | 'player';
  target: string;
  x: number;
  z: number;
  length: number;
  tension: number;
  strain: number;
  tangled: boolean;
  crossing: number;
  castAt: number;
  clearUntil: number;
};
export type Angler = {
  id: string;
  name: string;
  color: number;
  x: number;
  z: number;
  facing: number;
  slipX: number;
  slipZ: number;
  swimming: boolean;
  /** Hanging off the hull, riding with the boat, ready to climb. */
  clinging: boolean;
  /** Progress up the side, 0 to 1, while E is held. */
  climb: number;
  /** A swimmer's remaining fight, 1 down to 0. Only the water takes it. */
  health: number;
  stunUntil: number;
  downedUntil: number;
  overboardAt: number;
  recoveredAt: number;
  seen: number;
  input: ReelInput;
  line: FishingLine | null;
  lastAction: number;
  catches: number;
  splashes: number;
};
export type Fish = Vector & {
  id: string;
  kind: CatchKind;
  vx: number;
  vz: number;
  angle: number;
  stamina: number;
  respawnAt: number;
  surge: boolean;
};
export type Boat = Vector & {
  vx: number;
  vz: number;
  yaw: number;
  spin: number;
  roll: number;
  pitch: number;
  rollVelocity: number;
  pitchVelocity: number;
};
export type ReelEvent = {
  id: number;
  text: string;
  kind:
    | 'cast'
    | 'bite'
    | 'catch'
    | 'splash'
    | 'tangle'
    | 'snap'
    | 'rescue'
    | 'weather'
    | 'thunder'
    | 'shark'
    | 'chomp'
    | 'jellyfish'
    | 'sting'
    | 'start'
    | 'finish';
};
export type WeatherKind = 'calm' | 'wind' | 'rain' | 'storm';
export type LakeWeather = {
  kind: WeatherKind;
  since: number;
  until: number;
  direction: number;
  windX: number;
  windZ: number;
  rain: number;
  gust: number;
  nextThunderAt: number;
  flashUntil: number;
  lightningX: number;
  lightningZ: number;
};
export type SeaVisitor = Vector & {
  id: string;
  kind: 'shark' | 'jellyfish';
  angle: number;
  activeUntil: number;
  nextAt: number;
  hitAt: number;
};
export type ReelWorld = {
  clock: number;
  started: number;
  phase: 'lobby' | 'playing' | 'won' | 'lost';
  seed: number;
  remainder: number;
  players: Angler[];
  boat: Boat;
  fish: Fish[];
  weather: LakeWeather;
  wildlife: SeaVisitor[];
  score: number;
  goal: number;
  gear: { tire: boolean; magnet: boolean; boot: boolean };
  haul: Partial<Record<CatchKind, number>>;
  events: ReelEvent[];
  eventId: number;
};
export type ReelSnapshot = {
  code: string;
  host: string;
  version: number;
  world: ReelWorld;
};
export type ReelSession = Session;
export type ReelAction = {
  type: 'start' | 'restart' | 'cast' | 'cut' | 'untangle' | 'rescue';
  x?: number;
  z?: number;
};
export const idleInput = (): ReelInput => ({
  x: 0,
  z: 0,
  reel: false,
  brace: false,
  seq: 0,
});
