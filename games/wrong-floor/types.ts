import type { Session } from '../../shared/rooms/session';

export const STOPS = 5;
export const INSPECT_MS = 90_000;
export const ESCAPE_MS = 12_000;
export const TRAVEL_MS = 2800;
export { COLORS } from '../../shared/rendering/palette';
export const STATIONS = [
  {
    name: 'Carpet',
    x: -2.3,
    z: -5,
    normal: 'The carpet is dry. No footprints.',
    odd: 'Wet footprints appear, one after another. Nobody is making them.',
    short: 'Moving wet footprints',
  },
  {
    name: 'Portrait',
    x: -4.1,
    z: -11,
    normal: 'The portrait has a straight mouth. Its eyes stay still.',
    odd: 'The portrait is smiling. Its eyes follow me.',
    short: 'A smiling, watching portrait',
  },
  {
    name: 'Room 309',
    x: 4.1,
    z: -16,
    normal: 'Room 309 is silent. The door does not move.',
    odd: 'Three knocks from inside room 309. The handle turns by itself.',
    short: 'Knocking behind room 309',
  },
  {
    name: 'Clock',
    x: 0,
    z: -22,
    normal: 'The clock reads 12:00. Both hands are still.',
    odd: 'The clock hands are running backwards.',
    short: 'A backwards clock',
  },
] as const;
export type Input = { x: number; z: number; sprint: boolean; seq: number };
export const idleInput = (): Input => ({ x: 0, z: 0, sprint: false, seq: 0 });
export type Choice = 'advance' | 'retreat';
export type Guest = {
  id: string;
  name: string;
  color: number;
  slot: number;
  bot: boolean;
  x: number;
  z: number;
  facing: number;
  seen: number;
  input: Input;
  inspected: boolean;
  report: string;
  vote: Choice | null;
  safe: boolean;
  caught: boolean;
};
export type HotelEvent = {
  id: number;
  kind: 'start' | 'report' | 'vote' | 'correct' | 'alarm' | 'safe' | 'finish';
  text: string;
};
export type StopPlan = {
  anomalies: number[];
  witness: number;
  wallpaper: number;
};
export type HotelWorld = {
  clock: number;
  started: number;
  phase: 'lobby' | 'playing' | 'escape' | 'won' | 'lost';
  stage: 'inspect' | 'travel';
  stageAt: number;
  stopAt: number;
  escapeAt: number;
  players: Guest[];
  cleared: number;
  mistakes: number;
  run: number;
  seed: number;
  deck: boolean[];
  plan: StopPlan;
  ghostZ: number;
  eventId: number;
  events: HotelEvent[];
  lastDecision: {
    choice: Choice;
    correct: boolean;
    evidence: string;
    escaped: number;
  } | null;
};
export type PublicGuest = Omit<Guest, 'input' | 'seen' | 'inspected' | 'slot'>;
export type HotelSnapshot = {
  code: string;
  host: string;
  version: number;
  world: Omit<HotelWorld, 'players' | 'seed' | 'deck' | 'plan'> & {
    players: PublicGuest[];
    wallpaper: number;
  };
  you: {
    station: number;
    inspected: boolean;
    observation: string;
    anomaly: boolean;
    apparition: boolean;
  };
};
export type HotelAction = {
  type: 'start' | 'restart' | 'inspect' | 'report' | 'vote';
  choice?: Choice;
};
export type HotelSession = Session;
