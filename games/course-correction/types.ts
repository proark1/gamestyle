import { clamp } from '../../shared/math/clamp';
import { SEAT_KITS } from '../../shared/rendering/palette';

export const COLORS = SEAT_KITS;
export const BALL_RADIUS = 0.24;
export const MAX_SPEED = 14;
export const OPENING_MS = 6_000;
export const HOLE_MS = 100_000;
export const RESULT_MS = 4_500;

export type Phase =
  | 'lobby'
  | 'opening'
  | 'playing'
  | 'hole_result'
  | 'match_over';
export type Vec2 = { x: number; z: number };
export type PlayerInput = { x: number; z: number; seq?: number };

export const idleInput = (): PlayerInput => ({ x: 0, z: 0 });

export type CoursePlayer = {
  id: string;
  name: string;
  color: number;
  seat: number;
  bot: boolean;
  seen: number;
  input: PlayerInput;
  aim: number;
  power: number;
  openingReady: boolean;
  botAt: number;
  holeStrokes: number;
  totalStrokes: number;
  assists: number;
  finishedAt: number | null;
};

export type GolfBall = Vec2 & {
  id: string;
  owner: string;
  vx: number;
  vz: number;
  radius: number;
  moving: boolean;
  holed: boolean;
  safe: Vec2;
  restFor: number;
  lastTouch: string | null;
  lastTouchAt: number;
};

export type PivotWall = Vec2 & {
  id: string;
  width: number;
  depth: number;
  angle: number;
  velocity: number;
  min: number;
  max: number;
};

export type CourseObstacle = Vec2 & {
  id: string;
  kind: 'cone' | 'pan' | 'washer';
  radius: number;
};

export type CourseState = {
  id: 'pivot-alley' | 'tipping-point' | 'moving-target';
  width: number;
  length: number;
  startZ: number;
  cup: Vec2;
  walls: PivotWall[];
  obstacles: CourseObstacle[];
  bridge:
    | null
    | (Vec2 & {
        width: number;
        depth: number;
        angle: number;
        velocity: number;
      });
  platform: null | {
    baseX: number;
    z: number;
    offset: number;
    velocity: number;
    min: number;
    max: number;
  };
};

export type CourseEventKind =
  | 'shot'
  | 'impact'
  | 'wall'
  | 'bridge'
  | 'platform'
  | 'cup'
  | 'assist'
  | 'recover'
  | 'multi-cup'
  | 'hole'
  | 'match';

export type CourseEvent = {
  id: number;
  kind: CourseEventKind;
  at: number;
  x: number;
  z: number;
  player?: string;
  count?: number;
};

export type CourseWorld = {
  clock: number;
  started: number;
  phaseAt: number;
  remainder: number;
  tick: number;
  seed: number;
  phase: Phase;
  hole: number;
  openingEnds: number;
  holeEnds: number;
  players: CoursePlayer[];
  balls: GolfBall[];
  course: CourseState;
  events: CourseEvent[];
  nextEvent: number;
  partyRoundStarted?: boolean;
  partyRound?: number;
};

export type CourseSnapshot = {
  code: string;
  host: string;
  selfId: string;
  version: number;
  partyRoundStarted?: boolean;
  world: CourseWorld;
};

export function cleanShot(angle: unknown, power: unknown) {
  if (
    typeof angle !== 'number' ||
    !Number.isFinite(angle) ||
    typeof power !== 'number' ||
    !Number.isFinite(power)
  )
    return null;
  return {
    angle: clamp(angle, -Math.PI, Math.PI),
    power: clamp(power, 0.12, 1),
  };
}
