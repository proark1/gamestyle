import type { Quaternion } from '../../shared/math/quaternion';
import type { Session } from '../../shared/rooms/session';
import type { NpcAction } from '../../shared/rooms/npc-slots';
import type { DeliveryBrain, DeliveryTeam } from './npc-types';

export type Vec = { x: number; y: number; z: number };
export type DeliveryInput = {
  x: number;
  z: number;
  jump: boolean;
  seq: number;
};
export type DeliveryBody = Vec & {
  velocity: Vec;
  angular: Vec;
  quaternion: Quaternion;
};
export type DeliveryPlayer = Vec & {
  id: string;
  bot?: true;
  task?: string;
  name: string;
  color: number;
  angle: number;
  velocity: Vec;
  grounded: boolean;
  /** Authoritative supporting collider, used for material Foley. */
  support?: string | null;
  input: DeliveryInput;
  seen: number;
  lastJump: number;
  grip: number | null;
  stumble: number;
};
export type DeliveryWorld = {
  phase: 'lobby' | 'playing' | 'delivered';
  clock: number;
  started: number;
  players: DeliveryPlayer[];
  npcBrains?: Record<string, DeliveryBrain>;
  npcTeam?: DeliveryTeam;
  sofa: DeliveryBody;
  carryYaw: number;
  gate: number;
  gateTarget: number;
  door: number;
  doorTarget: number;
  bestHeight: number;
  drops: number;
  settle: number;
  remainder: number;
  events: { id: number; text: string }[];
  sofaSurface?: string | null;
  sofaImpact?: { id: number; at: number; speed: number; position: Vec };
};
export type DeliveryControlAction = {
  type: 'start' | 'restart' | 'grab' | 'release' | 'rotate' | 'interact';
};
export type DeliveryAction = DeliveryControlAction | NpcAction;
export type DeliverySession = Session;
export type DeliverySnapshot = {
  code: string;
  host: string;
  you: string;
  version: number;
  world: DeliveryWorld;
};
export const idleInput = (): DeliveryInput => ({
  x: 0,
  z: 0,
  jump: false,
  seq: 0,
});
export const GRIPS: Vec[] = [
  { x: -1.95, y: 0.05, z: 0.72 },
  { x: 1.95, y: 0.05, z: 0.72 },
  { x: -1.95, y: 0.05, z: -0.72 },
  { x: 1.95, y: 0.05, z: -0.72 },
];
export const SOFA_SCALE = 1.5;
export const SOFA_CENTER = (1.05 * SOFA_SCALE) / 2;
export const SUMMIT = 22;
