import type { Session } from '../../shared/rooms/session';

export const ROUND_MS = 180_000;
export const WIN_HEIGHT = 15; // Instant win if a stack reaches 15 meters
export const FLOOR_Y = 0;
export const PAD_Y = 0.4;
export const PAD_SIZE = 4.4; // 4.4m x 4.4m foundation platform

export type TeamId = 'orange' | 'teal';
export type Role = 'operator' | 'swinger';

export const TEAMS: readonly TeamId[] = ['orange', 'teal'];
export const ROLES: readonly Role[] = ['operator', 'swinger'];

export const TEAM_NAMES: Record<TeamId, string> = {
  orange: 'Team Orange',
  teal: 'Team Teal',
};

export const TEAM_COLORS: Record<TeamId, string> = {
  orange: '#d97438',
  teal: '#2f877c',
};

export const ROLE_NAMES: Record<Role, string> = {
  operator: 'Kranführer',
  swinger: 'Seil-Akrobat',
};

export const CRANE_CONFIG: Record<
  TeamId,
  {
    mast: { x: number; z: number };
    pad: { x: number; z: number };
    cabinY: number;
    boomY: number;
    reachMin: number;
    reachMax: number;
    color: string;
    trimColor: string;
  }
> = {
  orange: {
    mast: { x: -8.5, z: 0 },
    pad: { x: -8.5, z: 6.2 },
    cabinY: 13.5,
    boomY: 15.0,
    reachMin: 2.2,
    reachMax: 13.5,
    color: '#e58e38',
    trimColor: '#2b2a29',
  },
  teal: {
    mast: { x: 8.5, z: 0 },
    pad: { x: 8.5, z: 6.2 },
    cabinY: 13.5,
    boomY: 15.0,
    reachMin: 2.2,
    reachMax: 13.5,
    color: '#349387',
    trimColor: '#2b2a29',
  },
};

export type CrateKind = 'crate' | 'block' | 'beam' | 'barrel' | 'golden';

export type CrateConfig = {
  name: string;
  w: number;
  h: number;
  d: number;
  mass: number;
  color: string;
  points: number;
};

export const CRATE_CONFIGS: Record<CrateKind, CrateConfig> = {
  crate: {
    name: 'Holzkiste',
    w: 1.4,
    h: 1.2,
    d: 1.4,
    mass: 35,
    color: '#c09156',
    points: 1,
  },
  block: {
    name: 'Betonblock',
    w: 1.8,
    h: 0.9,
    d: 1.2,
    mass: 65,
    color: '#9ba199',
    points: 2,
  },
  beam: {
    name: 'Stahlträger',
    w: 3.2,
    h: 0.6,
    d: 0.8,
    mass: 55,
    color: '#c95f36',
    points: 2,
  },
  barrel: {
    name: 'Metallfass',
    w: 1.1,
    h: 1.4,
    d: 1.1,
    mass: 42,
    color: '#35727e',
    points: 1,
  },
  golden: {
    name: 'Goldkiste',
    w: 1.2,
    h: 1.2,
    d: 1.2,
    mass: 28,
    color: '#ebb734',
    points: 3,
  },
};

export type Vec3 = { x: number; y: number; z: number };
export type Quaternion = { x: number; y: number; z: number; w: number };

export type Crate = {
  id: string;
  kind: CrateKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  quaternion?: Quaternion;
  angular?: Vec3;
  heldBy?: string | null; // Player id of the swinger holding this crate
  teamPad?: TeamId | null; // Set when resting stably on a team's build platform
  sleeping?: boolean;
};

export type CraneState = {
  team: TeamId;
  angle: number; // Jib rotation around Y axis (radians)
  trolleyDist: number; // Distance along jib from mast (meters)
  trolleyX: number; // Computed world position of trolley
  trolleyZ: number;
  cableLength: number; // Length of winch cable from trolley to hook/swinger
  hookX: number; // Position of swinger/hook
  hookY: number;
  hookZ: number;
  hookVx: number;
  hookVy: number;
  hookVz: number;
};

export type PlayerInput = {
  x: number; // Swinger: swing lean X; Operator (when dedicated): slew
  z: number; // Swinger: swing lean Z; Operator (when dedicated): trolley
  y?: number; // Operator: hoist up/down (+1 / -1)
  grab?: boolean; // Swinger: press grab / release
  tuck?: boolean; // Swinger: tuck body
  craneX?: number; // Dual-control crane slew (-1 left, +1 right)
  craneZ?: number; // Dual-control crane trolley (-1 in, +1 out)
  craneY?: number; // Dual-control crane hoist (+1 up, -1 down)
  seq: number;
};

export const idleInput = (): PlayerInput => ({
  x: 0,
  z: 0,
  y: 0,
  craneX: 0,
  craneZ: 0,
  craneY: 0,
  grab: false,
  tuck: false,
  seq: 0,
});

export type Player = {
  id: string;
  name: string;
  color: number;
  team: TeamId;
  role: Role;
  bot?: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: number;
  holdingCrateId?: string | null;
  dazedUntil?: number;
  input: PlayerInput;
  lastAction: number;
  seen: number;
};

export type GameEvent = {
  id: number;
  type: 'grab' | 'place' | 'topple' | 'bonk' | 'siren' | 'height';
  text: string;
  team?: TeamId;
  at: number;
};

export type TeamScore = {
  height: number;
  crates: number;
  recordHeight: number;
};

export type CraneClashWorld = {
  phase: 'lobby' | 'playing' | 'ended';
  mode: 'normal' | 'practice';
  clock: number;
  started: number;
  remainder: number;
  players: Player[];
  cranes: Record<TeamId, CraneState>;
  crates: Crate[];
  scores: Record<TeamId, TeamScore>;
  winner: TeamId | 'draw' | null;
  events: GameEvent[];
  eventId: number;
  seed: number;
};

export type CraneClashSnapshot = {
  code: string;
  host: string;
  world: CraneClashWorld;
  version: number;
};

export type CraneClashAction =
  | { type: 'start' }
  | { type: 'restart' }
  | { type: 'switchTeam'; team: TeamId }
  | { type: 'switchRole'; role: Role }
  | { type: 'grab' }
  | { type: 'release' }
  | { type: 'setMode'; mode: 'normal' | 'practice' };

export type CraneClashSession = Session & {
  team: TeamId;
  role: Role;
  name?: string;
};

export function timeLeft(w: CraneClashWorld) {
  if (w.phase !== 'playing') return ROUND_MS;
  return Math.max(0, ROUND_MS - (w.clock - w.started));
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
