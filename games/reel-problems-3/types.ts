export type AdventurePhase =
  | 'lobby'
  | 'harbor'
  | 'search'
  | 'storm'
  | 'sanctuary'
  | 'homecoming'
  | 'finished';

export type AdventureInput = {
  x: number;
  z: number;
  yaw: number;
  sprint?: boolean;
  seq?: number;
};

export const idleInput = (): AdventureInput => ({ x: 0, z: 0, yaw: 0 });

export type AdventureStats = {
  supplies: number;
  beacons: number;
  repairs: number;
  rescues: number;
  helmTurns: number;
  lanterns: number;
};

export type AdventurePlayer = {
  id: string;
  name: string;
  color: number;
  seat: number;
  bot: boolean;
  seen: number;
  input: AdventureInput;
  x: number;
  z: number;
  yaw: number;
  overboard: boolean;
  stats: AdventureStats;
};

export type BeaconState = {
  id: 'cliff' | 'cave' | 'pines';
  aligned: number;
  required: number;
  active: boolean;
};

export type AdventureEventKind =
  | 'departed'
  | 'supply'
  | 'beacon-aligned'
  | 'beacon-lit'
  | 'island-reached'
  | 'fish-seen'
  | 'wave'
  | 'damage'
  | 'repair'
  | 'overboard'
  | 'rescue'
  | 'sanctuary'
  | 'lantern'
  | 'tone'
  | 'fish-home'
  | 'home';

export type AdventureEvent = {
  id: number;
  kind: AdventureEventKind;
  at: number;
  actor?: string;
  detail?: string;
};

export type AdventureWorld = {
  clock: number;
  started: number;
  phaseAt: number;
  tick: number;
  phase: AdventurePhase;
  players: AdventurePlayer[];
  loaded: string[];
  beacons: BeaconState[];
  beaconIndex: number;
  routeProgress: number;
  stormProgress: number;
  hull: number;
  water: number;
  wave: number;
  lanterns: string[];
  toneIndex: number;
  fishTrust: number;
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

export const SUPPLIES = ['rope', 'lanterns', 'timber', 'chart'] as const;
export const LANTERN_SOCKETS = ['port', 'bow', 'starboard'] as const;
