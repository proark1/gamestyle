export type RoundPhase =
  | 'lobby'
  | 'preparing'
  | 'outbound'
  | 'fishing'
  | 'returning'
  | 'docking'
  | 'finished'
  | 'failed';

export type AdventureInput = {
  x: number;
  z: number;
  yaw: number;
  sprint: boolean;
  reel: boolean;
  brace: boolean;
  throttle: number;
  steer: number;
  seq?: number;
};

export const idleInput = (): AdventureInput => ({
  x: 0,
  z: 0,
  yaw: 0,
  sprint: false,
  reel: false,
  brace: false,
  throttle: 0,
  steer: 0,
});

export type ItemKind =
  | 'rope'
  | 'rod'
  | 'bait-bucket'
  | 'lantern'
  | 'timber'
  | 'hammer'
  | 'bailer'
  | 'fuel-can'
  | 'ice-box'
  | 'landing-net'
  | 'chart'
  | 'compass'
  | 'fish';
export type ItemState =
  | 'racked'
  | 'loose'
  | 'held'
  | 'thrown'
  | 'floating'
  | 'submerged'
  | 'secured'
  | 'recovering';
export type StationKind =
  | 'helm'
  | 'throttle'
  | 'rod-rack'
  | 'bait-table'
  | 'net-rack'
  | 'ice-hold'
  | 'engine'
  | 'fuel-port'
  | 'repair-bench'
  | 'bilge-pump'
  | 'rescue-line'
  | 'chart-table';
export type FishSpecies =
  | 'silver-sprat'
  | 'coral-mackerel'
  | 'blue-cod'
  | 'glassfin'
  | 'lantern-eel'
  | 'storm-tuna';
export type MissionKind =
  | 'species-quota'
  | 'weight-quota'
  | 'rare-fish'
  | 'team-fish'
  | 'fragile-catch'
  | 'moving-school';
export type IncidentKind =
  | 'deck-wave'
  | 'line-tangle'
  | 'fish-pull'
  | 'seabirds'
  | 'engine-stall'
  | 'hull-leak'
  | 'fog-bank'
  | 'debris-field'
  | 'fish-escape'
  | 'torn-net';

export type ItemStateRecord = {
  id: string;
  kind: ItemKind;
  state: ItemState;
  space: 'boat' | 'world';
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  holder?: string;
  station?: string;
  durability?: number;
  contents?: number;
  fishSpecies?: FishSpecies;
  fishWeight?: number;
  recoverAt?: number;
};

export type FishingLine = {
  state: 'casting' | 'waiting' | 'biting' | 'hooked' | 'tangled';
  x: number;
  z: number;
  length: number;
  tension: number;
  strain: number;
  fishId?: string;
  biteAt?: number;
  biteUntil?: number;
  tangledWith?: string;
};

export type AdventureStats = {
  score: number;
  casts: number;
  catches: number;
  catchWeight: number;
  rareCatches: number;
  netAssists: number;
  repairs: number;
  bails: number;
  rescues: number;
  helmTime: number;
  droppedFish: number;
  lostItems: number;
  collisionDamage: number;
  tangles: number;
  overboardMs: number;
};

export type BotTask = {
  kind:
    | 'load'
    | 'helm'
    | 'fish'
    | 'net'
    | 'repair'
    | 'bail'
    | 'rescue'
    | 'store'
    | 'recover';
  target?: string;
  claimedAt: number;
};

export type AdventurePlayer = {
  id: string;
  name: string;
  color: number;
  seat: number;
  bot: boolean;
  seen: number;
  input: AdventureInput;
  space: 'boat' | 'world';
  x: number;
  z: number;
  yaw: number;
  overboard: boolean;
  station?: StationKind;
  held: string[];
  line: FishingLine | null;
  task?: BotTask;
  nextBotThink: number;
  stats: AdventureStats;
};

export type BoatState = {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  throttle: number;
  steer: number;
  roll: number;
  pitch: number;
  hull: number;
  water: number;
  engine: 'off' | 'running' | 'stalled';
  docked: boolean;
  netTorn: boolean;
};
export type FishState = {
  id: string;
  species: FishSpecies;
  x: number;
  z: number;
  vx: number;
  vz: number;
  weight: number;
  stamina: number;
  state: 'swimming' | 'biting' | 'hooked' | 'landed' | 'secured';
  hookedBy: string[];
  zoneId: string;
  respawnAt: number;
};
export type MissionState = {
  id: string;
  kind: MissionKind;
  label: string;
  species?: FishSpecies;
  goal: number;
  progress: number;
  zoneX: number;
  zoneZ: number;
  radius: number;
  complete: boolean;
};
export type StreamCell = {
  id: string;
  x: number;
  z: number;
  seed: number;
  kind: 'open-water' | 'fishing-ground' | 'rocks' | 'islet' | 'harbor';
};
export type ChaosIncident = {
  id: number;
  kind: IncidentKind;
  severity: 'minor' | 'major';
  startedAt: number;
  endsAt: number;
  target?: string;
  resolved: boolean;
};
export type RoundState = {
  seed: number;
  phase: RoundPhase;
  startedAt: number;
  prepEndsAt: number;
  roundEndsAt: number;
  returnEndsAt: number;
  finishedAt: number;
  result?: 'success' | 'timeout' | 'sunk';
};

export type AdventureEventKind =
  | 'round-started'
  | 'item-picked'
  | 'item-placed'
  | 'departed'
  | 'cast'
  | 'bite'
  | 'hooked'
  | 'line-snapped'
  | 'tangled'
  | 'untangled'
  | 'fish-landed'
  | 'fish-secured'
  | 'mission-complete'
  | 'return-started'
  | 'incident-started'
  | 'incident-resolved'
  | 'damage'
  | 'repair'
  | 'rescue'
  | 'docked'
  | 'round-failed';
export type AdventureEvent = {
  id: number;
  kind: AdventureEventKind;
  at: number;
  actor?: string;
  detail?: string;
  x?: number;
  z?: number;
};

export type AdventureWorld = {
  clock: number;
  started: number;
  tick: number;
  phase: RoundPhase;
  randomState: number;
  round: RoundState;
  players: AdventurePlayer[];
  boat: BoatState;
  items: ItemStateRecord[];
  fish: FishState[];
  missions: MissionState[];
  activeMission: number;
  cells: StreamCell[];
  incidents: ChaosIncident[];
  nextIncidentAt: number;
  incidentId: number;
  fogUntil: number;
  events: AdventureEvent[];
  nextEvent: number;
  partyRoundStarted?: boolean;
  partyRound?: number;
};

export type AdventureSnapshot = {
  code: string;
  host: string;
  selfId: string;
  version: number;
  partyRoundStarted?: boolean;
  world: AdventureWorld;
};
