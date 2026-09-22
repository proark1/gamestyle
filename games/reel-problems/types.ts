import type { Session } from '../../shared/rooms/session';
import type { NpcAction } from '../../shared/rooms/npc-slots';
import { COLORS } from '../../shared/rendering/palette';

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
/** Take-off speed of a jump in metres per second: a little under a metre of air. */
export const JUMP_SPEED = 4.2;
export const GRAVITY = 9.8;
/** Feet this high above the deck clear the gunwale; the rail top sits 0.51 m up. */
export const RAIL_CLEARANCE = 0.5;
/** A jump over the side lands this far off the hull, out of reach of a grab. */
export const DIVE_REACH = GRAB_REACH + 0.4;
/** A leak seeps for ten seconds, then pours: left alone it sinks the boat at twenty. */
export const LEAK_WINDOW_MS = 10_000;
export const FLOOD_SEEP = 0.025;
export const FLOOD_RUSH = 0.075;
/** Held-E milliseconds for one angler to patch; each extra patcher adds PATCH_HELP of one. */
export const PATCH_MS = 5000;
export const PATCH_HELP = 0.65;
/** Patch progress lost per second while nobody holds the leak. */
export const PATCH_DECAY = 0.08;
export const LEAK_REACH = 0.9;
/** The one bucket, in deck metres. Held E beside it bails water over the side. */
export const BUCKET = { x: -1.55, z: 2.75 };
export const BUCKET_REACH = 0.8;
export const BAIL_RATE = 0.04;
/** A patched hull sheds its water slowly on its own. */
export const DRAIN_RATE = 0.015;
/** No leaks in a tournament's first 45 s or last 30 s, nor within 40 s of the last. */
export const LEAK_FIRST_MS = 45_000;
export const LEAK_LAST_MS = 30_000;
export const LEAK_GAP_MS = 40_000;
/** Water end of the dock planks, where a swimmer can get a new boat. */
export const DOCK = { x: 0, z: 38, half: 2.75 };
export const DOCK_REACH = 1.6;
/** Where a new boat waits, stern to the dock and bow to the lake. */
export const MOORING = { x: 0, z: 33.4 };
/** Nobody made it to the dock: the harbour master sends a boat out anyway. */
export const DOCK_RESCUE_MS = 30_000;
/** How long the sharks drawn to a wreck stay hunting. */
export const WRECK_SHARK_MS = 30_000;
/** A stroke's push along the bow, and how much of it turns the boat from the rail. */
export const PADDLE_THRUST = 8;
export const PADDLE_TURN = 0.35;
/** How near the rail an angler must stand to take that side's paddle. */
export const PADDLE_REACH = 0.7;
export const LOG_RADIUS = 0.6;
/** Closing speed at which hitting driftwood cracks a plank instead of nudging it. */
export const RAM_SPEED = 1.1;
/** How long a seagull's dive for a landed catch lasts; a jump in that time scares it. */
export const GULL_DIVE_MS = 1600;
export const CRAB_CHANCE = 0.25;
export const CRAB_MS = 40_000;
export const PINCH_REACH = 0.45;
export const PINCH_COOLDOWN = 2500;
/** A pinch is a small hop with a shove, enough to clear the rail from beside it. */
export const PINCH_HOP = 3.4;
export const PINCH_SHOVE = 2.4;
export const STOMP_REACH = 0.6;
/** A deliberate jump in stuns small fish this close to the splash. */
export const CANNONBALL_REACH = 4.5;
export const STUN_MS = 8000;
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
/** The collection's four player colours, in join order. */
export const ANGLER_COLORS = COLORS;
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
  bot?: true;
  task?: string;
  x: number;
  z: number;
  facing: number;
  slipX: number;
  slipZ: number;
  /** Height above the deck while jumping, in metres; 0 with both feet down. */
  y: number;
  /** Upward speed of that jump, in metres per second. */
  vy: number;
  /** When both feet last came back down on the deck. */
  landedAt: number;
  /** Airborne because a crab pinched them, not because they chose to jump. */
  pinched: boolean;
  /** The paddle in hand: -1 port, 1 starboard, 0 none. */
  paddle: number;
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
  /** Knocked on the deck by line snap or a flying fish slap. */
  tumbleUntil: number;
  /** Holding caught trophy fish high above head. */
  trophyUntil: number;
  trophyKind?: CatchKind;
  /** Hat knocked off into the water on a spill or shark hit. */
  lostHat: boolean;
  /** Shocked by lightning conducting through rod. */
  shockedUntil: number;
  /** Round statistics for hilarious superlative awards */
  stats: {
    slapsTaken: number;
    friendsHooked: number;
    snapsCount: number;
    swimTimeMs: number;
    fishSlipped: number;
    scoreContributed: number;
    leaksRepaired: number;
  };
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
  /** Knocked silly by a cannonball: it drifts, and a hook near it bites at once. */
  stunnedUntil: number;
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
  /** Water aboard, 0 dry to 1 gone under. */
  flood: number;
  /** On the lake bed: no deck, no hull to hold, until a new boat leaves the dock. */
  sunk: boolean;
  sunkAt: number;
  /** Counts boats launched this tournament, so clients know to stop gliding the old one. */
  hull: number;
};
export type LeakCause =
  | 'random'
  | 'shark'
  | 'thunder'
  | 'log'
  | 'monster'
  | 'landing';
/** A cracked plank, in deck metres. */
export type Leak = {
  x: number;
  z: number;
  at: number;
  /** Patch progress, 0 to 1. */
  patch: number;
  /** The "pouring in" warning has gone out. */
  warned: boolean;
};
export type Driftwood = Vector & {
  id: string;
  vx: number;
  vz: number;
  angle: number;
  bumpAt: number;
};
/** A crab that came aboard with a catch, in deck metres. */
export type Crab = {
  x: number;
  z: number;
  angle: number;
  pinchAt: number;
  until: number;
};
/** A landed catch a seagull is diving for; it only scores if someone scares the bird. */
export type PendingCatch = {
  kind: CatchKind;
  crew: string[];
  until: number;
  gull: string;
};
export type ReelEvent = {
  /** World-space impact location, retained in multiplayer snapshots. */
  position?: { x: number; z: number };
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
    | 'leak'
    | 'patched'
    | 'flooding'
    | 'sink'
    | 'launch'
    | 'ram'
    | 'gull'
    | 'steal'
    | 'crab'
    | 'pinch'
    | 'stomp'
    | 'slap'
    | 'trophy'
    | 'bump'
    | 'slip'
    | 'shock'
    | 'boss'
    | 'oof'
    | 'waaah'
    | 'timber'
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
  kind: 'shark' | 'jellyfish' | 'gull';
  angle: number;
  activeUntil: number;
  nextAt: number;
  hitAt: number;
  /** Drawn by a sinking boat; leaves for good when its hunt is over. */
  wreck?: boolean;
  /** A gull making off with a stolen catch. */
  carry?: CatchKind;
};
export type DeckFish = {
  id: string;
  kind: CatchKind;
  x: number;
  z: number;
  angle: number;
  until: number;
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
  leak: Leak | null;
  /** Earliest moment any leak may spring, provoked or not. */
  leakReadyAt: number;
  /** When the next unprovoked leak springs. */
  leakDueAt: number;
  leaks: number;
  sinks: number;
  debris: Driftwood[];
  crab: Crab | null;
  pending: PendingCatch | null;
  flyingFish?: FlyingFish | null;
  nextFlyingFishAt?: number;
  deckFish: DeckFish[];
};
export type FlyingFish = {
  id: string;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  at: number;
  duration: number;
  hit: boolean;
};
export type ReelSnapshot = {
  code: string;
  host: string;
  version: number;
  world: ReelWorld;
};
export type ReelSession = Session;
export type ReelControlAction = {
  type:
    | 'start'
    | 'restart'
    | 'cast'
    | 'cut'
    | 'untangle'
    | 'rescue'
    | 'jump'
    | 'paddle';
  x?: number;
  z?: number;
};
export type ReelAction = ReelControlAction | NpcAction;
export const idleInput = (): ReelInput => ({
  x: 0,
  z: 0,
  reel: false,
  brace: false,
  seq: 0,
});
