import type { Session } from '../../shared/rooms/session';

export const ROUND_MS = 180_000;
export const ESCAPE_MS = 25_000;
export const DOOR_LOCK_MS = 5_000;
export const MAX_PRESSES = 16;
export const ROOM = { x: 12, z: 10 };
export const EXIT = { x: 0, z: -9 };
export const COLORS = ['#eaa43c', '#679e99', '#d97863', '#8b81af'];
export const HAZARD_NAMES = {
  conveyor: 'Conveyor floor',
  glove: 'Boxing glove',
  soap: 'Soap spill',
  spinner: 'Spinning sofa',
};
export type HazardKind = keyof typeof HAZARD_NAMES;
export type ButtonInput = { x: number; z: number; seq: number };
export const idleInput = (): ButtonInput => ({ x: 0, z: 0, seq: 0 });
export type Contestant = {
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
  hearts: number;
  escaped: boolean;
  winnings: number;
  presses: number;
  seen: number;
  input: ButtonInput;
  immuneUntil: number;
  stunnedUntil: number;
  lastAction: number;
  shoutUntil: number;
  lastJump: number;
};
export type Hazard = {
  id: number;
  kind: HazardKind;
  x: number;
  z: number;
  direction: number;
  starts: number;
  cycle: number;
};
export type ButtonEvent = {
  id: number;
  at: number;
  kind:
    | 'start'
    | 'press'
    | 'warning'
    | 'punch'
    | 'hit'
    | 'fall'
    | 'escape'
    | 'stop'
    | 'finish';
  text: string;
};
export type ButtonWorld = {
  clock: number;
  started: number;
  remainder: number;
  phase: 'lobby' | 'playing' | 'escape' | 'won' | 'lost';
  players: Contestant[];
  hazards: Hazard[];
  presses: number;
  pot: number;
  crewSize: number;
  doorUntil: number;
  escapeAt: number;
  lastPress: number;
  lastPresser: string;
  events: ButtonEvent[];
  eventId: number;
  banked: number;
};
export type ButtonAction = {
  type: 'start' | 'restart' | 'press' | 'exit' | 'jump' | 'stop' | 'help';
};
export type ButtonSnapshot = {
  code: string;
  host: string;
  version: number;
  world: ButtonWorld;
};
export type ButtonSession = Session;
export const prizeForPress = (presses: number) => 500 + presses * 250;
export const money = (value: number) =>
  `$${Math.floor(value).toLocaleString('en-US')}`;
