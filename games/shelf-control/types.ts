export type Point = { x: number; z: number };
export type Body = Point & { angle: number };
export type Phase =
  | 'lobby'
  | 'hiding'
  | 'playing'
  | 'guard-win'
  | 'mannequins-win';
export type Input = Point & { seq: number };
export type Action = {
  type:
    | 'start'
    | 'restart'
    | 'pose'
    | 'interact'
    | 'drop'
    | 'inspect'
    | 'add-bot'
    | 'remove-bot'
    | 'fill-start';
  target?: string;
};
export type Session = { code: string; id: string; token: string };
export type Figure = Body & {
  id: string;
  pose: number;
  moving: boolean;
  carrying: string | null;
  status: 'active' | 'caught' | 'escaped';
  task: number;
};
export type Item = Point & {
  id: string;
  kind: 'key' | 'ladder' | 'prop';
  holder: string | null;
  delivered: boolean;
};
export type Player = {
  id: string;
  name: string;
  seen: number;
  figureId: string | null;
  input: Input;
  bot?: true;
};
export type BotBrain = {
  seed: number;
  thinkAt: number;
  thoughtAt: number;
  repathAt: number;
  actionAt: number;
  goal: Point | null;
  routeGoal: Point | null;
  path: Point[];
  mode: 'hide' | 'pose' | 'job' | 'flee' | 'patrol' | 'chase' | 'search';
  job: string;
  holdUntil: number;
  watchSince: number;
  last: Point;
  movedAt: number;
  roam: number;
  guardMemory: (Body & { at: number }) | null;
  items: Record<string, Point & { kind: Item['kind']; free: boolean }>;
  suspects: Record<
    string,
    Point & {
      seenAt: number;
      score: number;
      movingFor: number;
      reactAt: number;
    }
  >;
  cleared: string[];
};
export type SoundEvent = Point & {
  id: number;
  at: number;
  kind: 'lift' | 'drop' | 'lock' | 'switch' | 'inspect' | 'catch' | 'escape';
  material: 'key' | 'ladder' | 'prop';
};
export type World = {
  phase: Phase;
  clock: number;
  started: number;
  huntAt: number;
  round: number;
  seed: number;
  players: Player[];
  guardId: string;
  guard: Body;
  figures: Figure[];
  items: Item[];
  mistakes: number;
  inspectAt: number;
  stunnedUntil: number;
  powerOff: boolean;
  keys: number;
  ladder: boolean;
  events: SoundEvent[];
  eventSeq: number;
  message: string;
  routines: Record<string, { until: number; target: Point; walking: boolean }>;
  botBrains?: Record<string, BotBrain>;
  botCounter?: number;
};
export type Snapshot = {
  code: string;
  host: string;
  version: number;
  phase: Phase;
  round: number;
  clock: number;
  remaining: number;
  players: { id: string; name: string; bot?: true }[];
  you: {
    id: string;
    role: 'guard' | 'mannequin' | 'waiting';
    figureId: string | null;
    status: 'active' | 'caught' | 'escaped';
    body: Body | null;
    pose: number;
    carrying: Item['kind'] | null;
    task: number;
    input?: Input;
    stunnedFor?: number;
  };
  guard: Body | null;
  figures: Figure[];
  items: Item[];
  events: SoundEvent[];
  mistakes: number;
  escaped: number;
  caught: number;
  message: string;
  objectives: { powerOff: boolean; keys: number; ladder: boolean } | null;
  inspectCooldown: number;
};
export const HIDE_MS = 15_000,
  HUNT_MS = 180_000;
export const WALK_SPEED = 3.1,
  LADDER_SPEED = 2.15,
  GUARD_SPEED = 3.65;
export type SnapshotTiming = {
  sentAt: number;
  receivedAt: number;
  input: Input;
};
export const idleInput = (seq = 0): Input => ({ x: 0, z: 0, seq });
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.z - b.z);
