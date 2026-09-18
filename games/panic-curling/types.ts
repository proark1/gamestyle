import { TEAM } from '../../shared/rendering/palette';
import type { Session } from '../../shared/rooms/session';

export type TeamId = 'red' | 'blue';
export type Role = 'deliverer' | 'sweeper' | 'defender';
export type StoneKind = 'granite' | 'anvil' | 'basket';
export type GadgetId = 'broom' | 'hairdryer' | 'blowtorch';

export const TEAMS: readonly TeamId[] = ['red', 'blue'];
export const TEAM_NAMES: Record<TeamId, string> = {
  red: 'Red Rovers',
  blue: 'Blue Blazers',
};
/** The collection's team colours: red against blue. */
export const TEAM_COLORS: Record<TeamId, string> = TEAM;

export const RINK_WIDTH = 6.4; // width of the ice track (-3.2 to 3.2)
export const RINK_LENGTH = 40.0; // from hack (-4) to back line (36)
export const HACK_Z = -2.0; // starting delivery position
export const RELEASE_HOG_Z = 6.0; // deliverer must release stone before here
export const FAR_HOG_Z = 22.0; // stone must cross here to remain in play
export const TEE_Z = 31.0; // center of the curling house ("button")
export const BACK_LINE_Z = 35.5; // back of the house

export const HOUSE_RINGS = {
  button: { radius: 0.45, points: 5, color: '#f3c742' },
  fourFoot: { radius: 1.25, points: 3, color: TEAM.red },
  eightFoot: { radius: 2.35, points: 2, color: '#ffffff' },
  twelveFoot: { radius: 3.55, points: 1, color: TEAM.blue },
} as const;

export type StoneConfig = {
  name: string;
  kind: StoneKind;
  mass: number;
  radius: number;
  height: number;
  baseFriction: number;
  curlMultiplier: number;
  iceStressMultiplier: number;
  wobble: number;
};

export const STONE_CONFIGS: Record<StoneKind, StoneConfig> = {
  granite: {
    name: 'Granite Stone',
    kind: 'granite',
    mass: 20,
    radius: 0.38,
    height: 0.28,
    baseFriction: 0.016,
    curlMultiplier: 1.0,
    iceStressMultiplier: 1.0,
    wobble: 0.0,
  },
  anvil: {
    name: 'Heavy Anvil',
    kind: 'anvil',
    mass: 55,
    radius: 0.45,
    height: 0.42,
    baseFriction: 0.022,
    curlMultiplier: 0.45,
    iceStressMultiplier: 2.8,
    wobble: 0.02,
  },
  basket: {
    name: 'Laundry Teammate',
    kind: 'basket',
    mass: 14,
    radius: 0.42,
    height: 0.72,
    baseFriction: 0.014,
    curlMultiplier: 1.8,
    iceStressMultiplier: 0.75,
    wobble: 0.15,
  },
};

export type GadgetConfig = {
  id: GadgetId;
  name: string;
  frictionCut: number; // reduction to base friction (e.g. 0.4 = 40% reduction)
  steerPower: number; // ability to push lateral curl
  stressRate: number; // rate of heating/stress added to thin ice
  radius: number;
};

export const GADGET_CONFIGS: Record<GadgetId, GadgetConfig> = {
  broom: {
    id: 'broom',
    name: 'Brisk Broom',
    frictionCut: 0.45,
    steerPower: 0.55,
    stressRate: 0.08,
    radius: 0.9,
  },
  hairdryer: {
    id: 'hairdryer',
    name: 'Warm Dryer',
    frictionCut: 0.62,
    steerPower: 0.8,
    stressRate: 0.25,
    radius: 1.1,
  },
  blowtorch: {
    id: 'blowtorch',
    name: 'Mega Blowtorch',
    frictionCut: 0.82,
    steerPower: 1.25,
    stressRate: 0.75,
    radius: 1.3,
  },
};

export type IceTile = {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  health: number; // 0 to 1 (1 = pristine, 0 = broken into water hole)
  stress: number; // current weight/heat pressure
  cracked: boolean;
  broken: boolean;
};

export type BananaHazard = {
  id: string;
  x: number;
  z: number;
  active: boolean;
  team: TeamId;
};

export type Stone = {
  id: string;
  kind: StoneKind;
  team: TeamId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  spin: number; // angular velocity (rad/s), positive = CW, negative = CCW
  rotation: number;
  active: boolean; // currently sliding down ice
  stopped: boolean;
  inPlay: boolean;
  outOfBounds: boolean;
  distanceToTee: number;
};

export type PlayerStatus = 'normal' | 'sliding' | 'sweeping' | 'slipping';

export type CurlingPlayer = {
  id: string;
  name: string;
  color: number;
  team: TeamId;
  role: Role;
  bot: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  rotation: number;
  status: PlayerStatus;
  statusTimer: number; // time left in slip/freeze
  gadget: GadgetId;
  bananasLeft: number;
  sweepIntensity: number; // 0 to 1
  steerDir: number; // -1 (left), 0 (center), 1 (right)
  seen: number;
  input: PlayerInput;
};

export type PlayerInput = {
  x: number; // movement vector X (-1 to 1)
  z: number; // movement vector Z (-1 to 1)
  aimAngle: number; // aim angle in radians for deliverer (-0.35 to 0.35)
  power: number; // delivery launch power (0 to 1)
  spin: number; // spin direction (-1 to 1)
  stoneKind: StoneKind;
  sweep: boolean; // active sweeping / heating
  steer: number; // -1 (sweep left), 1 (sweep right)
  tossBanana: boolean;
  rescue: boolean; // help freezing teammate out of ice hole
  seq: number;
};

export function idleInput(): PlayerInput {
  return {
    x: 0,
    z: 0,
    aimAngle: 0,
    power: 0.5,
    spin: 1,
    stoneKind: 'granite',
    sweep: false,
    steer: 0,
    tossBanana: false,
    rescue: false,
    seq: 0,
  };
}

export type GamePhase =
  | 'warmup'
  | 'aiming'
  | 'delivering'
  | 'sliding'
  | 'end_summary'
  | 'match_over';

export type GameEvent =
  | { type: 'stone_delivered'; stoneId: string; speed: number }
  | { type: 'stone_clack'; x: number; z: number; volume: number }
  | { type: 'banana_slip'; playerId: string }
  | { type: 'sweep_burst'; gadget: GadgetId; x: number; z: number }
  | { type: 'end_scored'; redPoints: number; bluePoints: number };

export type PanicCurlingWorld = {
  clock: number;
  phase: GamePhase;
  phaseTimer: number;
  /**
   * Seconds a deliverer may aim before the stone goes on its own. Bots never
   * throw for a human, so only a party round sets it: an idle player there
   * would stall the end forever.
   */
  aimPatience?: number;
  round: number; // current end (1 to 3)
  maxRounds: number;
  throwIndex: number; // 0 to 7 (8 throws per end)
  totalThrowsPerEnd: number;
  turnTeam: TeamId;
  hammerTeam: TeamId;
  scores: Record<TeamId, number>;
  endScores: Record<TeamId, number>[];
  players: CurlingPlayer[];
  stones: Stone[];
  activeStoneId: string | null;
  iceTiles: IceTile[];
  hazards: BananaHazard[];
  events: GameEvent[];
  started: number;
};

export type PanicCurlingAction =
  | { type: 'start' }
  | { type: 'restart' }
  | { type: 'switchTeam'; team: TeamId }
  | { type: 'switchRole'; role: Role }
  | { type: 'switchGadget'; gadget: GadgetId }
  | { type: 'switchStone'; kind: StoneKind }
  | {
      type: 'deliver';
      power: number;
      angle: number;
      spin: number;
      kind: StoneKind;
    }
  | { type: 'throwBanana' }
  | { type: 'rescue'; targetPlayerId: string };

export type PanicCurlingSnapshot = {
  code: string;
  host: string;
  version: number;
  world: PanicCurlingWorld;
};

export type PanicCurlingSession = Session & {
  team: TeamId;
  role: Role;
  name: string;
};
