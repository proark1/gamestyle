export const ROUND_MS = 180_000;
export const FIELD = 10;
export const GATE = { x: 0, z: 9.3 };
export const PANEL = { x: -9, z: 2 };
export const LADDER_EXIT = { x: 9.3, z: 5 };
export const INSPECTIONS = 5;
export type Point = { x: number; z: number };
export type CowInput = Point & { graze: boolean };
export type FarmMode = 'computer' | 'human';
export type Cow = Point & {
  id: string;
  angle: number;
  grazing: boolean;
  moving: boolean;
  carrying: string | null;
  captured: boolean;
  escaped: boolean;
  checkedUntil: number;
  // Optional for rooms saved before electric contact was introduced.
  shockedAt?: number;
  interactedAt?: number;
  interacting?: boolean;
  task: number;
};
export type FarmPlayer = {
  inputSequence?: number;
  bot?: true;
  id: string;
  name: string;
  cowId: string | null;
  seen: number;
  input: CowInput;
};
export type FarmItem = Point & {
  id: string;
  kind: 'key' | 'ladder';
  holder: string | null;
  delivered: boolean;
};
export type CowRoutine = {
  activity: 'graze' | 'walk' | 'idle';
  until: number;
  target: Point;
  speed: number;
};
export type FarmWorld = {
  botBrains?: Record<string, FarmBotBrain>;
  mode?: FarmMode;
  phase: 'lobby' | 'playing' | 'cows-win' | 'farmer-win';
  clock: number;
  started: number;
  round: number;
  players: FarmPlayer[];
  farmerId: string;
  farmer: Point & { angle: number };
  cows: Cow[];
  items: FarmItem[];
  herd: 'graze' | 'walk';
  herdTarget: Point;
  cueUntil: number;
  inspections: number;
  lastInspection: number;
  powerOff: boolean;
  keysDelivered: number;
  ladderPlaced: boolean;
  events: { id: number; text: string }[];
  seed: number;
  aiSuspicion: Record<string, number>;
  // Optional so persisted rooms from earlier releases can initialize routines on their next tick.
  cowRoutines?: Record<string, CowRoutine>;
  practice: boolean;
  clues?: FarmClue[];
};
export type FarmClue = Point & { id: number; clock: number; sound: string };
export type FarmAction = {
  type:
    | 'start'
    | 'restart'
    | 'interact'
    | 'inspect'
    | 'drop'
    | 'graze'
    | 'mode'
    | 'add-bot'
    | 'fill-bots'
    | 'remove-bot';
  target?: string;
  mode?: FarmMode;
};
export type FarmSession = {
  peer?: true;
  code: string;
  id: string;
  token: string;
};
export type FarmView = Omit<
  FarmWorld,
  | 'players'
  | 'seed'
  | 'aiSuspicion'
  | 'cowRoutines'
  | 'farmerId'
  | 'lastInspection'
  | 'botBrains'
> & {
  panelAudible?: boolean;
  players: {
    bot?: true;
    id: string;
    name: string;
    role: 'farmer' | 'cow';
    status: 'ready' | 'caught' | 'escaped';
  }[];
};
export type FarmBotBrain = {
  seed: number;
  boldness: number;
  thinkAt: number;
  actionAt: number;
  repathAt: number;
  blendUntil: number;
  nextBlendAt: number;
  watchedSince: number;
  job: string;
  goal: Point | null;
  path: Point[];
  mode: 'blend' | 'travel' | 'hide' | 'flee' | 'work' | 'escape';
  farmerMemory: (Point & { angle: number; at: number }) | null;
  last: Point;
  movedAt: number;
};
export type FarmSnapshot = {
  // Measured locally by the connection, never trusted by the server.
  latencyMs?: number;
  code: string;
  host: string;
  version: number;
  you: {
    id: string;
    role: 'farmer' | 'cow';
    cowId: string | null;
    // Only this player's acknowledged movement; no other player's controls.
    motion?: Point & { sequence: number };
  };
  world: FarmView;
};
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export const idleInput = (): CowInput => ({ x: 0, z: 0, graze: false });
export const farmMode = (
  world: Pick<FarmWorld, 'mode' | 'practice'>,
): FarmMode => world.mode ?? (world.practice ? 'computer' : 'human');
