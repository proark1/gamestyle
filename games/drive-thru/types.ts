export type RoleId = 'driver' | 'passenger' | 'grill' | 'barista';

export const ROLES: readonly RoleId[] = [
  'driver',
  'passenger',
  'grill',
  'barista',
] as const;

export type GamePhase =
  | 'lobby'
  | 'ordering'
  | 'assembling'
  | 'reaching'
  | 'completed'
  | 'meltdown';

export type FailStateKind =
  | 'none'
  | 'pole_crash'
  | 'windshield_splat'
  | 'grease_fire'
  | 'curb_plop';

export type BurgerLayer =
  | 'bottom_bun'
  | 'patty'
  | 'cheese'
  | 'lettuce'
  | 'top_bun';

export type PattyState = 'raw' | 'sizzling' | 'cooked' | 'burnt' | 'fire';

export type Patty = {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  flipAngle: number;
  state: PattyState;
  sizzleProgress: number; // 0 to 1
  burnProgress: number; // 0 to 1
  onSpatula: boolean;
};

export type OrderTicket = {
  id: string;
  orderNumber: number;
  scrambledText: string;
  clearText: string;
  requestedBurger: BurgerLayer[];
  requestedDrinks: number; // 1-4
  wantsMilkshake: boolean;
  wantsFries: boolean;
};

export type SedanState = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  steer: number;
  honking: boolean;
  bumperDamage: number;
  reversedIntoPole: boolean;
  windshieldSplat: number; // 0 to 1
  wipersActive: boolean;
  passengerReach: number; // 0 to 1
  beltHeld: boolean;
  balanceMeter: number; // -1 to 1 (0 is centered)
};

export type KitchenState = {
  patties: Patty[];
  spatulaX: number;
  spatulaZ: number;
  fryerBasketDown: boolean;
  fryerTimer: number; // 0 to 1
  fryerGreaseFire: boolean;
  shakePressure: number; // 0 to 100
  shakeVenting: boolean;
  shakeExploded: boolean;
  sodasPoured: number; // 0 to 4
  trayStack: BurgerLayer[];
  trayAtWindow: boolean;
  trayGrabbed: boolean;
  trayDroppedInCurb: boolean;
};

export type CabinDistractions = {
  toddlerSqueaking: boolean;
  screechingBelt: boolean;
  radioStaticIntensity: number; // 0 to 1
};

export type DriveThruPlayer = {
  id: string;
  name: string;
  color: number;
  role: RoleId;
  bot: boolean;
  score: number;
  seen: number;
  input: PlayerInput;
};

export type PlayerInput = {
  // Movement / Steering / Spatula
  x: number;
  z: number;
  // Primary actions
  action1: boolean; // Driver: Throttle / Grill: Flip / Barista: Vent / Passenger: Reach
  action2: boolean; // Driver: Reverse / Grill: Lift Fryer / Barista: Pour / Passenger: Swat Toy
  action3: boolean; // Driver: Honk / Grill: Stack Bun / Barista: Push Tray / Passenger: Hold Belt / Wipers
  jump?: boolean;
  seq: number;
};

export function idleInput(): PlayerInput {
  return {
    x: 0,
    z: 0,
    action1: false,
    action2: false,
    action3: false,
    seq: 0,
  };
}

export type DriveThruEvent = {
  id: number;
  kind:
    | 'order_placed'
    | 'patty_flipped'
    | 'patty_burnt'
    | 'grease_fire'
    | 'fryer_lifted'
    | 'shake_vented'
    | 'shake_exploded'
    | 'pole_crashed'
    | 'horn_honked'
    | 'windshield_splatted'
    | 'short_stop_reach'
    | 'order_delivered'
    | 'curb_plop'
    | 'meltdown'
    | 'round_win';
  text: string;
};

export type DriveThruWorld = {
  clock: number;
  started: number;
  phase: GamePhase;
  phaseTimer: number; // countdown in seconds
  ticket: OrderTicket | null;
  car: SedanState;
  kitchen: KitchenState;
  distractions: CabinDistractions;
  failState: FailStateKind;
  failReason: string;
  score: number;
  ordersServed: number;
  players: DriveThruPlayer[];
  events: DriveThruEvent[];
};

export type DriveThruSnapshot = {
  code: string;
  host: string;
  version: number;
  world: DriveThruWorld;
  clock: number;
  phase: GamePhase;
  phaseTimer: number;
  ticket: OrderTicket | null;
  car: SedanState;
  kitchen: KitchenState;
  distractions: CabinDistractions;
  failState: FailStateKind;
  failReason: string;
  score: number;
  ordersServed: number;
  players: {
    id: string;
    name: string;
    color: number;
    role: RoleId;
    bot: boolean;
    score: number;
  }[];
  events: DriveThruEvent[];
  myRole: RoleId;
  isHost: boolean;
};

export type DriveThruAction =
  | { type: 'start' }
  | { type: 'restart' }
  | { type: 'switchRole'; role: RoleId }
  | { type: 'honk' }
  | { type: 'flipPatty' }
  | { type: 'stackIngredient'; layer: BurgerLayer }
  | { type: 'ventMilkshake' }
  | { type: 'liftFryer' }
  | { type: 'pushTray' }
  | { type: 'pourDrink' }
  | { type: 'reachTray' }
  | { type: 'toggleWipers' }
  | { type: 'swatDistraction' };
