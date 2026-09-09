import type { Session } from '../../shared/rooms/session';

export const ROUND_MS = 300_000;
export const LAKE_RADIUS = 42;
export const BOAT_HALF = { x: 2.25, z: 3.4 };
/** Outer hull, wider than the walkable deck. Solid to catches and to hooks. */
export const HULL_HALF = { x: 2.65, z: 3.9 };
/** How far off the hull a beaten catch can be lifted aboard. */
export const NET_REACH = 1.8;
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
    | 'jellyfish'
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
