import { TEAM } from '../../shared/rendering/palette';

/** Court Clash plays red against blue, like every team game. */
export type TeamId = 'red' | 'blue';

export const TEAMS: readonly TeamId[] = ['red', 'blue'];

export const COURT = {
  width: 15,
  length: 15,
  baselineZ: -11.5,
  halfCourtZ: 4.5,
  minX: -7.5,
  maxX: 7.5,
  threePointRadius: 6.75, // Distance from hoop center (0, 0, -9.8)
};

export const HOOP = {
  x: 0,
  y: 3.05,
  z: -9.8,
  rimRadius: 0.45,
  backboardZ: -10.6,
  backboardWidth: 1.8,
  backboardHeight: 1.05,
  backboardY: 3.35,
};

export const BALL_RADIUS = 0.24;
export const TARGET_SCORE = 15;
export const SHOT_CLOCK_SEC = 18;

export type PlayerInput = {
  x: number;
  z: number;
  shoot: boolean;
  pass: boolean;
  steal: boolean;
  sprint: boolean;
  crossover: boolean;
  spin: boolean;
  seq: number;
};

export function idleInput(): PlayerInput {
  return {
    x: 0,
    z: 0,
    shoot: false,
    pass: false,
    steal: false,
    sprint: false,
    crossover: false,
    spin: false,
    seq: 0,
  };
}

export type SpecialMove =
  | 'none'
  | 'crossover'
  | 'spin'
  | 'stepback'
  | 'dunk'
  | 'hang'
  | 'celebrate'
  | 'stumbled';

export type DunkType = 'tomahawk' | 'powerhang' | 'windmill360';

export type Player = {
  id: string;
  name: string;
  color: number;
  team: TeamId;
  bot: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: number;
  grounded: boolean;
  jumping: boolean;
  hasBall: boolean;
  dribblePhase: number;
  chargingShot: boolean;
  shotCharge: number; // 0..1
  shotReleased: boolean;
  superJump: boolean;
  combo: number; // 0..100 (Heat / On Fire meter)
  score: number;
  dunks: number;
  steals: number;
  stunnedUntil: number;
  lastJump: number;
  specialMove: SpecialMove;
  moveTimer: number;
  celebrateUntil: number;
  hangUntil: number;
  spinAngle: number;
  dunkType?: DunkType;
  input: PlayerInput;
  seen: number;
};

export type Ball = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heldBy: string | null;
  lastHeldBy: string | null;
  shotBy: string | null;
  shotTeam: TeamId | null;
  isSuperShot: boolean;
  isDunk: boolean;
  isThreePointer: boolean;
  isAlleyOop?: boolean;
  spin: number;
};

export type GameEvent = {
  id: number;
  type:
    | 'bounce'
    | 'swish'
    | 'rim'
    | 'backboard'
    | 'dunk'
    | 'superdunk'
    | 'steal'
    | 'pass'
    | 'squeak'
    | 'buzzer'
    | 'whistle'
    | 'crossover'
    | 'anklebreaker'
    | 'spin'
    | 'stepback'
    | 'alleyoop'
    | 'cheer'
    | 'gasp'
    | 'fire'
    | 'rimhang'
    | 'celebrate';
  text: string;
  team?: TeamId;
  pos?: [number, number, number];
};

export type BasketballWorld = {
  clock: number;
  phase: 'lobby' | 'playing' | 'ended';
  started: number;
  endedAt: number;
  scores: Record<TeamId, number>;
  possession: TeamId;
  needsClearance: boolean; // after rebound or turnover, must clear beyond 3pt arc
  shotClockRemaining: number;
  targetScore: number;
  players: Player[];
  ball: Ball;
  events: GameEvent[];
  eventId: number;
  winner: TeamId | null;
};

export type BasketballAction =
  | { type: 'start' }
  | { type: 'restart' }
  | { type: 'switchTeam'; team: TeamId }
  | { type: 'shoot'; charge: number; superJump?: boolean }
  | { type: 'pass' }
  | { type: 'steal' }
  | { type: 'superJump' }
  | { type: 'crossover' }
  | { type: 'spin' }
  | { type: 'stepback' }
  | { type: 'alleyoop' };

export type BasketballSnapshot = {
  code: string;
  host: string;
  isHost?: boolean;
  world: BasketballWorld;
  localId: string;
  version: number;
};

export type BasketballSession = {
  id: string;
  token: string;
  code: string;
  name: string;
  team: TeamId;
};

/** The shared team colours: jersey, shorts, badge and HUD all use these. */
export const TEAM_COLORS: Record<TeamId, string> = TEAM;

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
