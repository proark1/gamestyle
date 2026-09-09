import type { Session } from '../../shared/rooms/session';
import type { NpcAction } from '../../shared/rooms/npc-slots';

export const ROUND_MS = 360_000;
export const LIMBS = [
  { name: 'Left hand', color: '#679e99', short: 'LH' },
  { name: 'Right hand', color: '#d97863', short: 'RH' },
  { name: 'Left foot', color: '#eaa43c', short: 'LF' },
  { name: 'Right foot', color: '#8b81af', short: 'RF' },
] as const;
export const STOVE = { x: -5.4, y: 1.8, z: -2.6 };
export const BREWER = { x: -5.4, y: 1.8, z: 1.2 };
export const FAN = { x: 0.3, y: 4.8, z: -1.5 };
export type Vec = { x: number; y: number; z: number };
export type BrainInput = {
  x: number;
  z: number;
  lift: number;
  use: boolean;
  steady: boolean;
  seq: number;
};
export type BrainPlayer = {
  id: string;
  name: string;
  color: number;
  limb: number;
  seen: number;
  input: BrainInput;
  mishaps: number;
  steps: number;
  served: number;
  bot?: true;
  npcActionAt?: number;
};
export type Limb = Vec & {
  owner: string | null;
  held: string | null;
  stepAt: number;
  useAt: number;
  kickAt: number;
};
export type Utensil = Vec & {
  id: 'pan' | 'jug';
  held: number | null;
  vx: number;
  vy: number;
  vz: number;
  floorAt: number;
  fill: number;
  cook: number;
  flipped: boolean;
  ready: boolean;
};
export type BrainEvent = {
  id: number;
  at: number;
  kind:
    | 'start'
    | 'step'
    | 'grab'
    | 'flip'
    | 'pour'
    | 'serve'
    | 'spill'
    | 'kick'
    | 'fan'
    | 'fall'
    | 'finish';
  text: string;
  limb: number | null;
};
export type BrainWorld = {
  clock: number;
  started: number;
  remainder: number;
  phase: 'lobby' | 'playing' | 'won' | 'lost';
  players: BrainPlayer[];
  limbs: Limb[];
  robot: {
    x: number;
    z: number;
    vx: number;
    vz: number;
    lean: number;
    wobble: number;
    fallenUntil: number;
    lastLeg: number;
    stepAt: number;
  };
  table: { x: number; z: number; vx: number; vz: number; jolt: number };
  utensils: Utensil[];
  spills: { x: number; z: number; at: number; color: string }[];
  pancakes: number;
  coffee: number;
  falls: number;
  events: BrainEvent[];
  eventId: number;
};
export type BrainSnapshot = {
  code: string;
  host: string;
  version: number;
  world: BrainWorld;
};
export type BrainSession = Session;
export type BrainControlAction = {
  type: 'start' | 'restart' | 'claim' | 'grab' | 'use' | 'kick' | 'center';
  limb?: number;
};
export type BrainAction = BrainControlAction | NpcAction;
export const idleInput = (): BrainInput => ({
  x: 0,
  z: 0,
  lift: 0,
  use: false,
  steady: false,
  seq: 0,
});
