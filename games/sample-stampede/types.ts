export type TeamId = 'red' | 'blue' | 'yellow' | 'green';
export type PlayerRole = 'driver' | 'grabber';

export type BulkItemKind =
  | 'paper_towels'
  | 'kibble_50lb'
  | 'mega_soda'
  | 'cereal_box'
  | 'giant_teddy';

export type SampleItemKind =
  | 'sample_taquito'
  | 'sample_pizza_bagel'
  | 'sample_churro'
  | 'sample_cheese';

export type ItemKind = BulkItemKind | SampleItemKind;

export type ItemDefinition = {
  kind: ItemKind;
  name: string;
  mass: number; // kg
  scoreValue: number;
  width: number;
  height: number;
  depth: number;
  color: string;
  isContraband?: boolean; // e.g. 10-foot giant teddy bear
  isSample?: boolean;
};

export const ITEM_DEFS: Record<ItemKind, ItemDefinition> = {
  paper_towels: {
    kind: 'paper_towels',
    name: '100-Pack Paper Towels',
    mass: 12,
    scoreValue: 150,
    width: 0.9,
    height: 0.7,
    depth: 0.6,
    color: '#ffffff',
  },
  kibble_50lb: {
    kind: 'kibble_50lb',
    name: '50lb Big Dog Kibble',
    mass: 45,
    scoreValue: 220,
    width: 0.7,
    height: 0.45,
    depth: 0.8,
    color: '#b87333',
  },
  mega_soda: {
    kind: 'mega_soda',
    name: '80-Pack Mega Soda',
    mass: 38,
    scoreValue: 200,
    width: 0.75,
    height: 0.5,
    depth: 0.65,
    color: '#c0392b',
  },
  cereal_box: {
    kind: 'cereal_box',
    name: 'Jumbo Sugar Loops',
    mass: 6,
    scoreValue: 80,
    width: 0.45,
    height: 0.6,
    depth: 0.3,
    color: '#f39c12',
  },
  giant_teddy: {
    kind: 'giant_teddy',
    name: '10-Foot Giant Teddy',
    mass: 25,
    scoreValue: 0,
    width: 1.1,
    height: 1.4,
    depth: 0.9,
    color: '#8b5a2b',
    isContraband: true, // Causes rejection at receipt check!
  },
  sample_taquito: {
    kind: 'sample_taquito',
    name: 'Crispy Taquito',
    mass: 1,
    scoreValue: 100,
    width: 0.35,
    height: 0.15,
    depth: 0.25,
    color: '#d35400',
    isSample: true,
  },
  sample_pizza_bagel: {
    kind: 'sample_pizza_bagel',
    name: 'Pizza Bagel Bite',
    mass: 1,
    scoreValue: 100,
    width: 0.3,
    height: 0.15,
    depth: 0.3,
    color: '#e74c3c',
    isSample: true,
  },
  sample_churro: {
    kind: 'sample_churro',
    name: 'Cinnamon Churro Loop',
    mass: 1,
    scoreValue: 100,
    width: 0.35,
    height: 0.15,
    depth: 0.2,
    color: '#e67e22',
    isSample: true,
  },
  sample_cheese: {
    kind: 'sample_cheese',
    name: 'Gouda Cube Sample',
    mass: 1,
    scoreValue: 100,
    width: 0.25,
    height: 0.2,
    depth: 0.25,
    color: '#f1c40f',
    isSample: true,
  },
};

export type CarriedItem = {
  id: string;
  kind: ItemKind;
  relX: number;
  relY: number;
  relZ: number;
  rotY: number;
};

export type GroundItem = {
  id: string;
  kind: ItemKind;
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  vx: number;
  vy: number;
  vz: number;
  onShelf: boolean;
  shelfAisle?: number;
};

export type ShoppingCart = {
  id: string;
  team: TeamId;
  driverId: string | null;
  grabberId: string | null;
  x: number;
  y: number;
  z: number;
  rotY: number;
  vx: number;
  vy: number;
  vz: number;
  angularVelocity: number;
  wobblePhase: number;
  wobbleIntensity: number;
  driftSlip: number;
  baseMass: number;
  totalMass: number;
  items: CarriedItem[];
  grabberAngle: number;
  grabberReach: number; // 0 (retracted) to 1 (full extension)
  grabberSwatting: boolean;
  grabberCooldown: number;
  sugarRushTimer: number;
  slipSpinTimer: number;
  score: number;
  manifest: ShoppingManifest;
  rejectedUntil: number; // cooldown when rejected at checkout
};

export type ShoppingManifest = {
  targetItems: { kind: ItemKind; required: number; collected: number }[];
  completed: boolean;
  rewardPoints: number;
};

export type SampleKiosk = {
  id: string;
  aisle: number;
  aisleName: string;
  x: number;
  y: number;
  z: number;
  sampleKind: SampleItemKind;
  samplesAvailable: number;
  active: boolean;
  bellDingTime: number;
  frenzyTimeRemaining: number;
};

export type HazardSlipPlate = {
  id: string;
  x: number;
  z: number;
  kind: 'plate' | 'spill';
  rotation: number;
  duration: number;
};

export type NPCShopper = {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  vx: number;
  vz: number;
  state: 'wandering' | 'stampeding';
  targetKioskId: string | null;
  speed: number;
};

export type StampedePlayer = {
  id: string;
  name: string;
  color: number;
  team: TeamId;
  cartId: string;
  role: PlayerRole;
  bot: boolean;
  input: PlayerInput;
  seen: number;
};

export type PlayerInput = {
  x: number; // steer
  z: number; // throttle
  steer: number; // -1 (left) to 1 (right)
  throttle: number; // -1 (reverse/brake) to 1 (forward drive)
  drift: boolean; // handbrake / sharp drift turn
  grabberAction: boolean; // reach / swat / snag item
  grabberAngle?: number; // target angle of grabber relative to cart
};

export type StampedeEvent = {
  id: number;
  type:
    | 'sample_announcement'
    | 'sugar_rush'
    | 'cart_crash'
    | 'item_snagged'
    | 'item_lost'
    | 'plate_slip'
    | 'shelf_tumble'
    | 'receipt_approved'
    | 'receipt_rejected'
    | 'grabber_whack';
  x: number;
  y: number;
  z: number;
  text?: string;
  team?: TeamId;
  intensity?: number;
};

export type ShelfRack = {
  id: string;
  aisle: number;
  x: number;
  z: number;
  width: number;
  length: number;
  height: number;
  destroyed: boolean;
};

export type ExitGauntlet = {
  x: number;
  z: number;
  width: number;
  depth: number;
};

export type SampleStampedeWorld = {
  clock: number;
  started: number;
  phase: string;
  status: 'warmup' | 'active' | 'finished';

  timeRemaining: number;
  matchDuration: number;
  nextSampleFrenzyTime: number;
  activeAnnouncement: string | null;
  announcementExpiry: number;
  players: StampedePlayer[];
  carts: ShoppingCart[];
  groundItems: GroundItem[];
  kiosks: SampleKiosk[];
  hazards: HazardSlipPlate[];
  npcShoppers: NPCShopper[];
  shelves: ShelfRack[];
  exitGauntlet: ExitGauntlet;
  events: StampedeEvent[];
  teamScores: Record<TeamId, number>;
  winnerTeam: TeamId | null;
};

export type SampleStampedeAction =
  | { type: 'input'; input: PlayerInput }
  | { type: 'ready' }
  | { type: 'reset' }
  | { type: 'switch_role' }
  | { type: 'switch_team' };

export type SampleStampedeSnapshot = {
  world: SampleStampedeWorld;
  mode: 'SOLO' | 'COOP' | 'DERBY';
  code: string;
  host: string;
  version: number;
  localPlayerId: string;
  localCartId: string;
  myRole: PlayerRole;
  myTeam: TeamId;
};

export const idleInput = (): PlayerInput => ({
  x: 0,
  z: 0,
  steer: 0,
  throttle: 0,
  drift: false,
  grabberAction: false,
});
