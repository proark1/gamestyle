import { clamp } from '../../shared/math/clamp';
import { SEAT_KITS } from '../../shared/rendering/palette';

export const TABLE = { x: 4.6, z: 3, y: 1.4 };
export const MATCH_MS = 120_000;
export const DAILY_MS = 60_000;
export const CHARGE_MS = 1_500;
export const COLORS = SEAT_KITS;
export const OBJECTS = [
  {
    id: 'bottle',
    en: 'Bottle',
    de: 'Flasche',
    mass: 1,
    points: 10,
    radius: 0.22,
    height: 0.85,
    ideal: 0.58,
    tolerance: 0.55,
    item: null,
  },
  {
    id: 'hat',
    en: 'Top hat',
    de: 'Zylinder',
    mass: 1.6,
    points: 15,
    radius: 0.36,
    height: 0.6,
    ideal: 0.61,
    tolerance: 0.5,
    item: 'top-hat',
  },
  {
    id: 'cone',
    en: 'Traffic cone',
    de: 'Hütchen',
    mass: 2.3,
    points: 20,
    radius: 0.4,
    height: 0.85,
    ideal: 0.64,
    tolerance: 0.47,
    item: 'party-cone',
  },
  {
    id: 'boots',
    en: 'Rain boots',
    de: 'Gummistiefel',
    mass: 3.4,
    points: 30,
    radius: 0.43,
    height: 0.55,
    ideal: 0.67,
    tolerance: 0.43,
    item: 'rain-boots',
  },
  {
    id: 'pan',
    en: 'Frying pan',
    de: 'Pfanne',
    mass: 4.8,
    points: 45,
    radius: 0.52,
    height: 0.24,
    ideal: 0.7,
    tolerance: 0.39,
    item: null,
  },
  {
    id: 'washer',
    en: 'Washing machine',
    de: 'Waschmaschine',
    mass: 9,
    points: 80,
    radius: 0.65,
    height: 1.3,
    ideal: 0.73,
    tolerance: 0.35,
    item: null,
  },
] as const;
export type ObjectId = (typeof OBJECTS)[number]['id'];
export type Mode = 'versus' | 'daily';
export type Input = {
  x: number;
  z: number;
  aimX: number | null;
  aimZ: number | null;
};
export const idleInput = (): Input => ({ x: 0, z: 0, aimX: null, aimZ: null });
export function cleanInput(raw: Record<string, unknown>): Input {
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  return {
    x: finite(raw.x) ? clamp(raw.x as number, -1, 1) : 0,
    z: finite(raw.z) ? clamp(raw.z as number, -1, 1) : 0,
    aimX: finite(raw.aimX)
      ? clamp(raw.aimX as number, -TABLE.x + 0.8, TABLE.x - 0.8)
      : null,
    aimZ: finite(raw.aimZ)
      ? clamp(raw.aimZ as number, -TABLE.z + 0.8, TABLE.z - 0.8)
      : null,
  };
}
export type Player = {
  id: string;
  name: string;
  color: number;
  seat: number;
  bot: boolean;
  seen: number;
  input: Input;
  x: number;
  z: number;
  aimX: number;
  aimZ: number;
  selected: number;
  score: number;
  pending: number;
  combo: number;
  chain: number;
  bestCombo: number;
  chargingAt: number | null;
  readyAt: number;
  botAt: number;
  botCharge: number;
  throws: number;
  lands: number;
  banks: number;
  busts: number;
  last: 'land' | 'bust' | 'bank' | 'throw' | '';
  lastAt: number;
};
export type Prop = {
  id: number;
  owner: string;
  chain: number;
  object: number;
  born: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  angle: number;
  spin: number;
  state: 'air' | 'landed' | 'falling';
  scored: boolean;
  banked: boolean;
};
export type EventKind =
  | 'throw'
  | 'land'
  | 'bust'
  | 'bank'
  | 'impact'
  | 'win'
  | 'select';
export type FlipEvent = {
  id: number;
  kind: EventKind;
  x: number;
  z: number;
  strength: number;
  born: number;
};
export type World = {
  clock: number;
  started: number;
  remainder: number;
  tick: number;
  phase: 'lobby' | 'playing' | 'ended';
  mode: Mode;
  day: string;
  seed: number;
  initialSeed: number;
  duration: number;
  nextNudge: number;
  players: Player[];
  props: Prop[];
  events: FlipEvent[];
  nextProp: number;
  nextEvent: number;
  table: { x: number; z: number; vx: number; vz: number };
  winner: string | null;
  partyRoundStarted?: boolean;
  partyRound?: number;
};
export type Snapshot = {
  code: string;
  host: string;
  selfId: string;
  version: number;
  world: World;
};
export const charge = (w: World, p: Player) =>
  p.chargingAt === null
    ? 0
    : Math.min(1, Math.max(0, (w.clock - p.chargingAt) / CHARGE_MS));
export const objectOf = (p: Player) => OBJECTS[p.selected];
