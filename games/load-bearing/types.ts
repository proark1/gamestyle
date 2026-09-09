import type { Session } from '../../shared/rooms/session';

export const ROUND_MS = 180_000;
export const FLOOR = 0;
/** A part counts as down once its underside is within reach of the ground. */
export const RUBBLE_HEIGHT = 1.1;
export const PIANO_INTEGRITY = 100;
export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.68;
export const SWING_REACH = 2.6;
export const SWING_MS = 620;
export const HELP_REACH = 3.4;
export const COLORS = ['#eaa43c', '#679e99', '#d97863', '#8b81af'];

export const PART_NAMES = {
  column: 'Column',
  beam: 'Beam',
  wall: 'Wall panel',
  slab: 'Floor slab',
  roof: 'Roof panel',
};
export type PartKind = keyof typeof PART_NAMES;
/** Hammer blows to destroy each kind. The ball ignores this entirely. */
export const PART_HITS: Record<PartKind, number> = {
  column: 5,
  beam: 4,
  wall: 3,
  slab: 4,
  roof: 2,
};
export const PART_MASS: Record<PartKind, number> = {
  column: 60,
  beam: 45,
  wall: 30,
  slab: 80,
  roof: 22,
};

export type Vec3 = { x: number; y: number; z: number };
export type Quaternion = { x: number; y: number; z: number; w: number };
export type Part = {
  id: string;
  kind: PartKind;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  hits: number;
  /** Set when the support graph can no longer reach the ground from here. */
  falling: boolean;
  vx: number;
  vy: number;
  vz: number;
  angular?: Vec3;
  quaternion?: Quaternion;
  sleeping?: boolean;
  idle?: number;
  markedBy?: string;
  /** Raised while the part carries load it was not built to carry. */
  strain: number;
};
export type Piano = {
  x: number;
  y: number;
  z: number;
  vy: number;
  integrity: number;
  resting: boolean;
};
export type LoadInput = { x: number; z: number; jump: boolean; seq: number };
export const idleInput = (): LoadInput => ({
  x: 0,
  z: 0,
  jump: false,
  seq: 0,
});
export type Wrecker = {
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
  grounded: boolean;
  down: boolean;
  downUntil: number;
  swingUntil: number;
  seen: number;
  input: LoadInput;
  lastJump: number;
  lastAction: number;
  hits: number;
};
export type LoadEvent = {
  id: number;
  at: number;
  kind:
    | 'start'
    | 'hit'
    | 'break'
    | 'collapse'
    | 'piano'
    | 'down'
    | 'help'
    | 'crane'
    | 'mark'
    | 'finish';
  text: string;
};
export type Crane = {
  owner: string | null;
  x: number;
  y: number;
  z: number;
  /** Ball position trails the hoist, so the cable can swing. */
  ballX: number;
  ballY: number;
  ballZ: number;
  vx: number;
  vy: number;
  vz: number;
};
export type LoadWorld = {
  clock: number;
  started: number;
  remainder: number;
  phase: 'lobby' | 'playing' | 'won' | 'lost';
  mode: 'normal' | 'practice';
  players: Wrecker[];
  parts: Part[];
  piano: Piano;
  crane: Crane;
  standing: number;
  events: LoadEvent[];
  eventId: number;
  seed: number;
};
export type LoadAction = {
  type:
    | 'start'
    | 'restart'
    | 'practice'
    | 'swing'
    | 'mark'
    | 'help'
    | 'crane'
    | 'crane-move'
    | 'crane-drop'
    | 'wave';
  target?: string;
  x?: number;
  y?: number;
  z?: number;
};
export type LoadSnapshot = {
  code: string;
  host: string;
  version: number;
  world: LoadWorld;
};
export type LoadSession = Session;

export const partTop = (p: Part) => p.y + p.h / 2;
export const partBottom = (p: Part) => p.y - p.h / 2;
export const alive = (p: Part) => p.hits > 0;
export const timeLeft = (w: LoadWorld) =>
  w.mode === 'practice' || !w.started
    ? ROUND_MS
    : Math.max(0, ROUND_MS - (w.clock - w.started));
export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
