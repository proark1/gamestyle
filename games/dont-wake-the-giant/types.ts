import type { Session } from '../../shared/rooms/session';
export type Vec = { x: number; y: number; z: number };
export type GiantInput = {
  x: number;
  z: number;
  jump: boolean;
  crouch: boolean;
  seq: number;
};
export type GiantPlayer = Vec & {
  id: string;
  name: string;
  color: number;
  angle: number;
  velocity: Vec;
  grounded: boolean;
  support: string | null;
  input: GiantInput;
  seen: number;
  lastJump: number;
  stepAt: number;
  downUntil: number;
  escaped: boolean;
  caught: boolean;
};
export type ItemKind =
  | 'coin'
  | 'cup'
  | 'necklace'
  | 'gem'
  | 'pouch'
  | 'crown'
  | 'pillow'
  | 'spoon';
export type GiantItem = Vec & {
  id: string;
  kind: ItemKind;
  value: number;
  heldBy: string | null;
  banked: boolean;
  velocity: Vec;
  support: string | null;
  rotation: number;
};
export type Reaction = 'roll' | 'sneeze' | 'wake';
export type GiantEvent = Vec & {
  id: number;
  text: string;
  kind: 'noise' | 'coin' | 'help' | Reaction;
  strength: number;
  at: number;
};
export type GiantWorld = {
  phase: 'lobby' | 'playing' | 'escape' | 'ended';
  clock: number;
  started: number;
  deadline: number;
  escapeAt: number;
  players: GiantPlayer[];
  items: GiantItem[];
  wakefulness: number;
  nextReaction: number;
  pending: { kind: Reaction; at: number } | null;
  armFrom: number;
  armTo: number;
  armAt: number;
  lastReaction: number;
  sneezeAt: number;
  banked: number;
  target: number;
  events: GiantEvent[];
  serial: number;
};
export type GiantAction = {
  type:
    | 'start'
    | 'restart'
    | 'interact'
    | 'pass'
    | 'drop'
    | 'tickle'
    | 'help'
    | 'exit'
    | 'rotate';
};
export type GiantSession = Session;
export type GiantSnapshot = {
  code: string;
  host: string;
  you: string;
  version: number;
  world: GiantWorld;
};
export const idleInput = (): GiantInput => ({
  x: 0,
  z: 0,
  jump: false,
  crouch: false,
  seq: 0,
});
export const NIGHT = 8 * 60 * 1000;
export const ESCAPE = 25 * 1000;
export const HEIGHT = 1.02;
export const RADIUS = 0.23;
export const ITEM_NAMES: Record<ItemKind, string> = {
  coin: 'Gold coins',
  cup: 'Silver cup',
  necklace: 'Golden necklace',
  gem: 'Cut gemstone',
  pouch: 'Coin pouch',
  crown: 'The giant’s crown',
  pillow: 'Soft pillow',
  spoon: 'Teaspoon bridge',
};
