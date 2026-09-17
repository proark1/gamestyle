export type Role = 'left-winch' | 'right-winch' | 'cleaner' | 'all-rounder';

export const CRADLE_WIDTH = 10.0;
export const CRADLE_DEPTH = 2.0;
export const RAILING_HEIGHT = 1.1;
export const ROOF_ALTITUDE = 95.0;
export const GROUND_ALTITUDE = 10.0;
export const DEFAULT_ALTITUDE = 50.0;
export const TILT_WARNING_DEG = 15.0;
export const TILT_SLIP_DEG = 20.0;
export const MAX_TILT_DEG = 45.0;

export const WINCH_CRANK_SPEED = 0.55; // meters per crank input
export const WINCH_AUTO_SPEED = 2.2; // meters per second continuous
export const TARGET_CLEANED_WINDOWS = 30;
export const ROUND_TIME_MS = 150_000; // 2 minutes 30 seconds

export type WindowStatus = 'dirty' | 'foamed' | 'spotless';

export type WindowTarget = {
  id: string;
  col: number; // -2, -1, 0, 1, 2
  row: number; // 0 to 20
  x: number; // world x
  y: number; // world y
  status: WindowStatus;
  foamAmount: number; // 0 to 1
  sparkleTimer: number;
};

export type SoapBucket = {
  id: string;
  x: number; // local coordinate along cradle (-4.3 to 4.3)
  vx: number;
  spilled: boolean;
  spillTimer: number;
  sudsLevel: number; // soap available (0 to 1)
};

export type Pigeon = {
  id: string;
  target: 'cable-left' | 'cable-right' | 'railing-left' | 'railing-right';
  x: number;
  y: number;
  perched: boolean;
  annoyance: number; // slow down factor
  timeToLeave: number;
  flapTimer: number;
};

export type WindGust = {
  active: boolean;
  strength: number; // -1 to 1 (direction and magnitude)
  timer: number;
  duration: number;
};

export type PlayerState =
  | 'standing'
  | 'sliding'
  | 'dangling'
  | 'climbing'
  | 'cranking'
  | 'cleaning'
  | 'shooing';

export type PlayerTool = 'sponge' | 'squeegee' | 'none';

export type PlayerInput = {
  x: number; // -1 to 1 (movement along deck)
  z: number; // depth movement
  crankLeftUp: boolean;
  crankLeftDown: boolean;
  crankRightUp: boolean;
  crankRightDown: boolean;
  action: boolean; // soap / squeegee / shoo / grab
  jump: boolean; // climb up if dangling
  switchTool: boolean;
  seq: number;
};

export function idleInput(): PlayerInput {
  return {
    x: 0,
    z: 0,
    crankLeftUp: false,
    crankLeftDown: false,
    crankRightUp: false,
    crankRightDown: false,
    action: false,
    jump: false,
    switchTool: false,
    seq: 0,
  };
}

export type Player = {
  id: string;
  name: string;
  color: number;
  role: Role;
  bot: boolean;
  deckX: number; // local pos along cradle [-4.5, 4.5]
  deckY: number; // 0 on floor, negative if dangling
  vx: number;
  state: PlayerState;
  stateTimer: number;
  dangleY: number; // tether swing offset
  tetherLength: number;
  tool: PlayerTool;
  facing: number; // -1 left, 1 right
  crankSide: 'left' | 'right' | null;
  cleaningTargetId: string | null;
  score: number;
  windowsCleaned: number;
  slips: number;
  dangles: number;
  input: PlayerInput;
  seen: number;
};

export type CradleState = {
  leftHeight: number; // height of left suspension point
  rightHeight: number; // height of right suspension point
  centerHeight: number;
  tiltRad: number; // positive = right is higher, tilts left
  tiltDeg: number;
  tiltVel: number;
  swayX: number;
  swayZ: number;
  deckSuds: number; // soap spilled on deck (reduces friction)
};

export type GameEvent = {
  id: number;
  type:
    | 'crank'
    | 'tilt_warning'
    | 'slip'
    | 'dangle'
    | 'climb_up'
    | 'bucket_slide'
    | 'bucket_spill'
    | 'soap_apply'
    | 'window_clean'
    | 'pigeon_land'
    | 'pigeon_shoo'
    | 'wind_gust'
    | 'win'
    | 'timeout';
  playerId?: string;
  detail?: string;
};

export type HelicopterState = {
  y: number;
  targetY: number;
  rotorSpeed: number;
  bladeAngle: number;
  landed: boolean;
};

export type ScaffoldScrambleWorld = {
  seed: number;
  clock: number;
  started: number;
  phase: 'lobby' | 'playing' | 'ended';
  startedAt: number;
  endsAt: number;
  winner: 'crew' | 'failed' | null;
  cradle: CradleState;
  windows: WindowTarget[];
  buckets: SoapBucket[];
  pigeons: Pigeon[];
  wind: WindGust;
  helicopter: HelicopterState;
  players: Player[];
  cleanedCount: number;
  totalWindows: number;
  events: GameEvent[];
};

export type ScaffoldAction =
  | { type: 'start' }
  | { type: 'restart' }
  | { type: 'crank'; winch: 'left' | 'right'; dir: 'up' | 'down' }
  | { type: 'useTool' }
  | { type: 'switchTool' }
  | { type: 'shoo' }
  | { type: 'climb' }
  | { type: 'switchRole'; role: Role };

export type ScaffoldSnapshot = {
  code: string;
  host: string;
  me: string;
  version: number;
  world: ScaffoldScrambleWorld;
};

export type ScaffoldSession = {
  id: string;
  token: string;
  code: string;
  name: string;
  role: Role;
  color: number;
};

export const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

export const degToRad = (deg: number) => (deg * Math.PI) / 180;
export const radToDeg = (rad: number) => (rad * 180) / Math.PI;

export function timeLeft(world: ScaffoldScrambleWorld): number {
  if (world.phase !== 'playing') return ROUND_TIME_MS;
  return Math.max(0, world.endsAt - world.clock);
}
