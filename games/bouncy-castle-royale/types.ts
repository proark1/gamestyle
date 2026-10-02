import { clamp } from '../../shared/math/clamp';

export type Team = 'red' | 'blue';
export const TEAMS = ['red', 'blue'] as const;
export const PRESETS = ['floor', 'walls', 'bumpers'] as const;
export type Preset = (typeof PRESETS)[number];
export const COURT = { x: 6, z: 8, floor: 0.5, net: 2.5, radius: 0.43 };
export const TARGET = 7;
export const MATCH_MS = 180_000;
export const opposite = (team: Team): Team => (team === 'red' ? 'blue' : 'red');
export const side = (team: Team) => (team === 'red' ? 1 : -1);
export const teamAt = (z: number): Team => (z >= 0 ? 'red' : 'blue');
export type Input = { x: number; z: number; brace: boolean; pump: boolean };
export const idleInput = (): Input => ({
  x: 0,
  z: 0,
  brace: false,
  pump: false,
});
export function cleanInput(raw: Record<string, unknown>): Input {
  const axis = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? clamp(v, -1, 1) : 0;
  const x = axis(raw.x),
    z = axis(raw.z),
    length = Math.max(1, Math.hypot(x, z));
  return {
    x: x / length,
    z: z / length,
    brace: raw.brace === true,
    pump: raw.pump === true,
  };
}
export type Player = {
  id: string;
  name: string;
  color: number;
  team: Team;
  seat: number;
  bot: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  seen: number;
  input: Input;
  grounded: boolean;
  swingUntil: number;
  hitAfter: number;
  jumpAfter: number;
  waveAfter: number;
  pumpAt: number;
  hits: number;
  jumps: number;
  pumped: number;
};
export type Air = {
  preset: Preset;
  pressure: number;
  floor: number;
  walls: number;
  bumpers: number;
  changed: number;
};
export const ALLOCATION: Record<
  Preset,
  { floor: number; walls: number; bumpers: number }
> = {
  floor: { floor: 0.85, walls: 0.4, bumpers: 0.25 },
  walls: { floor: 0.35, walls: 0.9, bumpers: 0.25 },
  bumpers: { floor: 0.4, walls: 0.3, bumpers: 0.8 },
};
export type Ball = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  last: string | null;
  team: Team | null;
  touches: number;
  hitAt: number;
};
export type Wave = {
  id: number;
  x: number;
  z: number;
  born: number;
  power: number;
  source: string;
  caught: string[];
};
export type EventKind =
  | 'slap'
  | 'smash'
  | 'bounce'
  | 'wave'
  | 'wall'
  | 'net'
  | 'point'
  | 'win'
  | 'air'
  | 'pump';
export type CastleEvent = {
  id: number;
  kind: EventKind;
  x: number;
  z: number;
  strength: number;
};
export type World = {
  clock: number;
  started: number;
  tick: number;
  phase: 'lobby' | 'serve' | 'playing' | 'point' | 'ended';
  partyRoundStarted?: boolean;
  partyRound?: number;
  players: Player[];
  ball: Ball;
  air: Record<Team, Air>;
  scores: Record<Team, number>;
  serving: Team;
  until: number;
  winner: Team | 'draw' | null;
  message: string;
  waves: Wave[];
  events: CastleEvent[];
  nextEvent: number;
  nextWave: number;
  rally: number;
  bestRally: number;
};
export type Snapshot = {
  code: string;
  host: string;
  selfId: string;
  version: number;
  world: World;
};
