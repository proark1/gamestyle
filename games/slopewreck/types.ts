import { clamp } from '../../shared/math/clamp';

export const RACE_MS = 60_000;
export const FINISH_Z = 560;
export const HALF_WIDTH = 10;
export const KICKERS = [54, 132, 220, 310, 404, 492] as const;

export type Trick = 'ramp' | 'rail';
export type RaceInput = {
  x: number;
  z: number;
  steer: number;
  tuck: boolean;
  brake: boolean;
};
export const idleInput = (): RaceInput => ({
  x: 0,
  z: 0,
  steer: 0,
  tuck: false,
  brake: false,
});
export const cleanInput = (raw: Record<string, unknown>): RaceInput => ({
  x: 0,
  z: 0,
  steer:
    typeof raw.steer === 'number' && Number.isFinite(raw.steer)
      ? clamp(raw.steer, -1, 1)
      : 0,
  tuck: raw.tuck === true,
  brake: raw.brake === true,
});

export type Rider = {
  id: string;
  name: string;
  color: number;
  seat: number;
  bot: boolean;
  x: number;
  z: number;
  speed: number;
  height: number;
  vy: number;
  grounded: boolean;
  airStarted: number;
  spin: number;
  trick: Trick | null;
  trickStarted: number;
  lastJump: number;
  lastKicker: number;
  wipeoutUntil: number;
  finishAt: number;
  style: number;
  cleanLandings: number;
  wipeouts: number;
  featuresMade: number;
  input: RaceInput;
  seen: number;
};

export type Feature = {
  id: number;
  owner: string;
  kind: Trick;
  x: number;
  z: number;
  wild: boolean;
  born: number;
};

export type RaceEvent = {
  id: number;
  kind: 'jump' | 'trick' | 'land' | 'wipeout' | 'feature' | 'boost' | 'finish';
  rider: string;
  x: number;
  z: number;
};

export type World = {
  clock: number;
  started: number;
  tick: number;
  phase: 'lobby' | 'racing' | 'ended';
  partyRoundStarted?: boolean;
  partyRound?: number;
  players: Rider[];
  features: Feature[];
  events: RaceEvent[];
  nextFeature: number;
  nextEvent: number;
  winner: string | null;
};

export type Snapshot = {
  code: string;
  host: string;
  selfId: string;
  version: number;
  world: World;
};

export const slopeY = (z: number) => 22 - z * 0.085;
