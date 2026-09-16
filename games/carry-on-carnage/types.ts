import type { Session } from '../../shared/rooms/session';

export const ROUND_MS = 180_000;
export const SIZER_FEE = 150;
export const PASSED_REWARD = 500;
export const CONTRABAND_BONUS = 1000;

export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.68;
export const REACH_DISTANCE = 2.0;

export const SUITCASE_BASE_W = 0.9;
export const SUITCASE_BASE_H = 0.6;
export const SUITCASE_BASE_D = 0.45;
export const SIZER_MAX_W = 1.1;
export const SIZER_MAX_H = 0.75;
export const SIZER_MAX_D = 0.55;

export const BURST_THRESHOLD = 3.2; // Maximum volume before bulging luggage explodes

export const ITEM_CONFIGS = {
  clothes: {
    name: 'Hawaiian Shirt Stack',
    volume: 0.6,
    squish: 0.85,
    contraband: false,
    color: '#e76f51',
  },
  duck: {
    name: 'Mega Rubber Duck',
    volume: 0.75,
    squish: 0.7,
    contraband: false,
    color: '#f4a261',
  },
  flamingo: {
    name: 'Inflatable Flamingo',
    volume: 1.5,
    squish: 0.6,
    contraband: false,
    color: '#f72585',
  },
  racket: {
    name: 'Tennis Racket',
    volume: 1.1,
    squish: 0.15,
    contraband: false,
    color: '#2a9d8f',
  },
  shoes: {
    name: 'Tin Foil Shoes',
    volume: 0.7,
    squish: 0.5,
    contraband: false,
    color: '#c0c0c0',
  },
  lobster: {
    name: 'Live Maine Lobster',
    volume: 1.3,
    squish: 0.1,
    contraband: true,
    color: '#d90429',
  },
  shampoo: {
    name: '2-Liter Giant Shampoo',
    volume: 1.4,
    squish: 0.15,
    contraband: true,
    color: '#0077b6',
  },
  snowglobe: {
    name: 'Oversized Snow Globe',
    volume: 1.2,
    squish: 0.05,
    contraband: true,
    color: '#48cae4',
  },
} as const;

export type ItemKind = keyof typeof ITEM_CONFIGS;

export type LuggageItem = {
  id: string;
  kind: ItemKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotation: number;
  heldBy: string | null;
  packedIn: string | null;
};

export type Suitcase = {
  id: string;
  color: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  open: boolean;
  items: string[];
  bulge: number;
  compression: number;
  zipped: number; // 0.0 (open/unzipped) to 1.0 (fully zipped)
  strain: number;
  burst: boolean;
  approved: boolean;
  rejected: boolean;
  heldBy: string | null;
  sittingCount: number;
};

export type PlayerInput = {
  x: number;
  z: number;
  jump: boolean;
  grab: boolean;
  compress: boolean;
  zip: boolean;
  drop: boolean;
  seq: number;
};

export const idleInput = (): PlayerInput => ({
  x: 0,
  z: 0,
  jump: false,
  grab: false,
  compress: false,
  zip: false,
  drop: false,
  seq: 0,
});

export type Traveler = {
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
  sittingOn: string | null;
  zippingSuitcase: string | null;
  holdingItem: string | null;
  holdingSuitcase: string | null;
  wearingTinFoil: boolean;
  downUntil: number;
  seen: number;
  input: PlayerInput;
  bot?: boolean;
};

export type TsaCheckpoint = {
  x: number;
  z: number;
  distractedUntil: number;
  alarmUntil: number;
  confiscatedCount: number;
};

export type SizerBox = {
  x: number;
  y: number;
  z: number;
  insertedSuitcase: string | null;
  status: 'idle' | 'testing' | 'approved' | 'rejected';
  timer: number;
  reason?: string;
};

export type CarryOnEvent = {
  id: number;
  type:
    | 'pack'
    | 'compress'
    | 'zip'
    | 'burst'
    | 'tsa_alarm'
    | 'tsa_distracted'
    | 'tsa_caught'
    | 'sizer_passed'
    | 'sizer_rejected'
    | 'flight_departed';
  text: string;
  pos?: [number, number, number];
  color?: string;
};

export type CarryOnWorld = {
  phase: 'lobby' | 'packing' | 'flight_departed';
  clock: number;
  started: number;
  deadline: number;
  players: Traveler[];
  suitcases: Suitcase[];
  items: LuggageItem[];
  tsa: TsaCheckpoint;
  sizer: SizerBox;
  events: CarryOnEvent[];
  approvedCount: number;
  contrabandCount: number;
  feesPaid: number;
  totalScore: number;
  targetBags: number;
};

export type CarryOnAction =
  | { type: 'start' }
  | { type: 'restart' }
  | { type: 'input'; input: PlayerInput }
  | { type: 'interact'; action: 'grab' | 'compress' | 'zip' | 'drop' };

export type CarryOnSnapshot = {
  code: string;
  host: string;
  version: number;
  world: CarryOnWorld;
  session: {
    id: string;
    code: string;
    host: string;
  };
};

export type CarryOnSession = Session & {
  code: string;
  name: string;
  color?: number;
};

export const timeLeft = (world: CarryOnWorld) =>
  Math.max(0, world.deadline - world.clock);
