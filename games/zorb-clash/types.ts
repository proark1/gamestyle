export type TeamId = 'red' | 'blue';

export type PlayerInput = {
  x: number; // -1 to 1 (strafe / turn)
  z: number; // -1 to 1 (forward / backward)
  dash: boolean; // space held to charge dash
  brace: boolean; // shift held to brace/anchor
  wiggle?: boolean; // rapid input flag for turtle recovery
};

export type ZorbPlayer = {
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
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  dashCharge: number; // 0 to 1
  dashing: number; // countdown in seconds when active burst
  braced: boolean;
  turtle: boolean; // upside-down stuck state
  turtleTimer: number; // seconds left in turtle state
  wiggleProgress: number; // 0 to 1 towards wiggle escape
  bonks: number; // total explosive player bumps
  goals: number; // individual goals scored
  input: PlayerInput;
  seen: number;
};

export type ZorbBall = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  lastTouchTeam: TeamId | null;
  lastTouchPlayerId: string | null;
};

export type SpringCushion = {
  id: string;
  side: 'north' | 'south' | 'east' | 'west';
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  compression: number; // 0 to 1 for visual recoil animation
};

export type Ramp = {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  length: number;
  height: number;
  rotation: number; // radians around Y
};

export type GoalScoredEvent = {
  team: TeamId;
  scorerId: string | null;
  scorerName: string;
  isTurtleGoal: boolean; // style points if a turtle was punted in!
  clock: number;
};

export type ZorbClashWorld = {
  clock: number;
  started: number;
  phase: string;
  timeRemaining: number;
  status: 'countdown' | 'playing' | 'goal_scored' | 'ended';
  celebrationTimer: number;
  score: { red: number; blue: number };
  players: ZorbPlayer[];
  ball: ZorbBall;
  cushions: SpringCushion[];
  ramps: Ramp[];
  lastGoal: GoalScoredEvent | null;
  bonkCount: number;
};

export type ZorbClashSnapshot = {
  code: string;
  host: string;
  version: number;
  clock: number;
  world: ZorbClashWorld;
  selfId: string;
};

export type ZorbClashAction =
  | { type: 'input'; input: PlayerInput }
  | { type: 'ready' }
  | { type: 'reset' }
  | { type: 'switch_team' };

export type ZorbClashSession = {
  id: string;
  token: string;
  code: string;
  team: TeamId;
  name: string;
};

// Field Constants
export const PITCH_WIDTH = 34; // X bounds: [-17, 17]
export const PITCH_LENGTH = 54; // Z bounds: [-27, 27]
export const GOAL_WIDTH = 8;
export const GOAL_HEIGHT = 3.2;
export const GOAL_DEPTH = 3.5;
export const ZORB_RADIUS = 1.2;
export const BALL_RADIUS = 1.15;
export const MATCH_DURATION = 180; // 3 minutes in seconds
export const WINNING_SCORE = 5;

export const idleInput = (): PlayerInput => ({
  x: 0,
  z: 0,
  dash: false,
  brace: false,
  wiggle: false,
});
