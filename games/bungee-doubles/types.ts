export type TeamId = 'orange' | 'teal';

export const TEAMS: readonly TeamId[] = ['orange', 'teal'];

export const COURT = {
  width: 13, // -6.5 to +6.5
  length: 22, // -11 to +11
  baselineOrangeZ: -10,
  baselineTealZ: 10,
  netZ: 0,
  netHeight: 1.05,
  netCenterHeight: 0.92,
  netWidth: 14.5,
  serviceLineZ: 5.5,
  serviceLineOrangeZ: -5.5,
  minX: -6.5,
  maxX: 6.5,
  minZ: -11,
  maxZ: 11,
  wallHeight: 3.8,
};

export const BALL_RADIUS = 0.22;
export const TARGET_SCORE = 7;

export const BUNGEE = {
  restLength: 3.4,
  maxStretch: 7.8,
  stiffness: 42,
  damping: 5.5,
  snapThreshold: 7.6,
};

export type PlayerInput = {
  x: number;
  z: number;
  swing: boolean;
  smash: boolean;
  dive: boolean;
  jump: boolean;
  seq: number;
};

export function idleInput(): PlayerInput {
  return {
    x: 0,
    z: 0,
    swing: false,
    smash: false,
    dive: false,
    jump: false,
    seq: 0,
  };
}

export type SpecialState =
  | 'none'
  | 'swinging'
  | 'smashing'
  | 'diving'
  | 'slingshot'
  | 'stunned'
  | 'celebrating';

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
  specialState: SpecialState;
  stateTimer: number;
  swingCooldown: number;
  stunnedUntil: number;
  slingshotUntil: number;
  score: number;
  hits: number;
  smashes: number;
  slingshots: number;
  bonks: number;
  input: PlayerInput;
  seen: number;
};

export type BallState = 'serving' | 'in_play' | 'dead';

export type Ball = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  state: BallState;
  currentSide: TeamId | null;
  bouncesOnCurrentSide: number;
  lastHitBy: string | null;
  lastHitTeam: TeamId | null;
  hitCountOnSide: number;
  isSmash: boolean;
  speedTrail: boolean;
  spinX: number;
  spinZ: number;
  wallHitsOnCurrentSide: number;
};

export type GameEvent = {
  id: number;
  type:
    | 'racket_hit'
    | 'smash_hit'
    | 'ball_bounce'
    | 'net_hit'
    | 'wall_rebound'
    | 'bungee_stretch'
    | 'bungee_snap'
    | 'partner_bonk'
    | 'point_scored'
    | 'game_won'
    | 'whistle'
    | 'cheer'
    | 'slingshot'
    | 'dive';
  text: string;
  team?: TeamId;
  pos?: [number, number, number];
};

export type TeamTether = {
  team: TeamId;
  playerA: string;
  playerB: string;
  distance: number;
  tension: number; // 0..1
  isCritical: boolean;
};

export type BungeeWorld = {
  clock: number;
  phase: 'lobby' | 'serving' | 'rally' | 'scored' | 'ended';
  started: number;
  endedAt: number;
  scores: Record<TeamId, number>;
  serverTeam: TeamId;
  servingPlayerId: string | null;
  rallyCount: number;
  maxRally: number;
  targetScore: number;
  players: Player[];
  ball: Ball;
  tethers: Record<TeamId, TeamTether | null>;
  events: GameEvent[];
  eventId: number;
  winner: TeamId | null;
  scoreBanner?: {
    team: TeamId;
    text: string;
    subtext: string;
  } | null;
};

export type BungeeAction =
  | { type: 'start' }
  | { type: 'restart' }
  | { type: 'switchTeam' }
  | { type: 'swing' }
  | { type: 'smash' }
  | { type: 'dive' }
  | { type: 'jump' };

export type BungeeSnapshot = {
  code: string;
  host: string;
  isHost?: boolean;
  world: BungeeWorld;
  localId: string;
  version: number;
};

export type BungeeSession = {
  id: string;
  token: string;
  code: string;
  name: string;
  team: TeamId;
};

export const TEAM_COLORS: Record<TeamId, string> = {
  orange: '#e58e38',
  teal: '#349387',
};

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
