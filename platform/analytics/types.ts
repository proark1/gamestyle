import type { StageTime, WireEvent } from '../../shared/analytics/protocol';

/** Who a session played its rounds with. */
export type CrewKey = 'alone' | 'npcs' | 'friends' | 'mixed';
export const CREW_KEYS: readonly CrewKey[] = [
  'alone',
  'npcs',
  'friends',
  'mixed',
];

export type Totals = {
  sessions: number;
  /** Picked solo, hosting or joining. */
  chose: number;
  /** Started at least one round. */
  played: number;
  /** Finished at least one round. */
  finished: number;
  /** Won at least one round. */
  won: number;
  rounds: number;
  wins: number;
  losses: number;
  /** Summed milliseconds on the page and with the page visible. */
  elapsed: number;
  active: number;
  /** Summed milliseconds in the menu, the lobby, rounds and results screens. */
  time: StageTime;
  medianElapsed: number;
  /** Among sessions that started a round. */
  medianPlaying: number;
  /** Among sessions that started a round. */
  crew: Record<CrewKey, number>;
  modes: { solo: number; host: number; join: number };
  hosted: number;
  /** Hosted a room that no other person joined. */
  hostedAlone: number;
  touch: number;
  touchPlayed: number;
  /** Reported within the last 90 seconds and not yet closed. */
  live: number;
};

export type StepCount = { step: string; sessions: number };
export type GameTotals = Totals & { game: string; topExit: StepCount | null };
export type DayCount = { day: number; sessions: number; played: number };

export type OverviewReport = {
  generated: number;
  truncated: boolean;
  totals: Totals;
  games: GameTotals[];
  days: DayCount[];
};

export type GameReport = {
  generated: number;
  truncated: boolean;
  game: string;
  totals: Totals;
  days: DayCount[];
  /** Sessions that ever reached each step, in the game's step order. */
  funnel: StepCount[];
  /** The step closed sessions were last at. */
  exits: StepCount[];
  /** `won`, `lost` or `ended`, optionally with `:reason`. */
  results: { key: string; rounds: number }[];
  actions: { action: string; total: number; sessions: number }[];
  durations: { label: string; sessions: number }[];
  entries: Record<string, number>;
};

export type SessionRow = {
  id: string;
  game: string;
  started: number;
  updated: number;
  device: string;
  entry: string;
  mode: string;
  room: string;
  furthest: string;
  lastStep: string;
  rounds: number;
  wins: number;
  losses: number;
  humans: number;
  npcs: number;
  elapsed: number;
  active: number;
  exit: string;
  live: boolean;
};

export type SessionPage = { sessions: SessionRow[]; next: string | null };

export type SessionDetail = {
  session: SessionRow & {
    reached: string[];
    time: StageTime;
    actions: Record<string, number>;
    results: Record<string, number>;
  };
  events: WireEvent[];
  /** Other visits in the same room around the same time. */
  roommates: SessionRow[];
};
