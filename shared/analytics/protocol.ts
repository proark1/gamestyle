/**
 * Anonymous gameplay analytics, shared by the browser tracker and the server.
 *
 * A session is one visit to one game page. Its identifier is random and lives
 * only in memory: no cookies, nothing stored on the device, no names, no IP
 * addresses, and room codes only as a truncated hash that groups the sessions
 * of one room.
 */

export const ANALYTICS_ENDPOINT = '/api/analytics';
export const ANALYTICS_VERSION = 1;
export const MAX_BATCH_BYTES = 16_000;
export const MAX_BATCH_EVENTS = 40;
/** Timeline rows kept per session; the summary keeps counting after this. */
export const MAX_SESSION_EVENTS = 400;
/** Distinct action or result keys counted per session. */
export const MAX_COUNTED_KINDS = 48;
const MAX_ELAPSED_MS = 7 * 86_400_000;
const MAX_COUNT = 1_000_000;

export const COMMON_STEPS = [
  'opened',
  'chose',
  'lobby',
  'playing',
  'finished',
  'won',
  'again',
] as const;
export type CommonStep = (typeof COMMON_STEPS)[number];
export const COMMON_LABELS: Record<CommonStep, string> = {
  opened: 'Opened the game',
  chose: 'Chose how to play',
  lobby: 'Waited in the lobby',
  playing: 'Started a round',
  finished: 'Finished a round',
  won: 'Won a round',
  again: 'Played another round',
};

export type Milestone = { key: string; label: string };

/** What one game reports, kept beside the game that reports it. */
export type GameAnalytics = {
  game: string;
  /** Moments inside a round, in the order a round normally reaches them. */
  milestones: readonly Milestone[];
  /** Why rounds end, keyed by the reason the game reports. */
  reasons?: Readonly<Record<string, string>>;
  /** The discrete actions worth counting, keyed as `toKey` spells them. */
  actions?: Readonly<Record<string, string>>;
  /** Where "round" reads wrong, such as in the building games. */
  labels?: Partial<Record<CommonStep, string>>;
};

export function stepOrder(definition: GameAnalytics): string[] {
  return [
    'opened',
    'chose',
    'lobby',
    'playing',
    ...definition.milestones.map((milestone) => milestone.key),
    'finished',
    'won',
    'again',
  ];
}

export function stepLabel(definition: GameAnalytics, key: string): string {
  return (
    definition.milestones.find((milestone) => milestone.key === key)?.label ??
    definition.labels?.[key as CommonStep] ??
    COMMON_LABELS[key as CommonStep] ??
    key
  );
}

export type Stage = 'menu' | 'lobby' | 'playing' | 'finished';
export type Mode = 'solo' | 'host' | 'join';
export type Outcome = 'won' | 'lost' | 'ended';
export type Device = 'touch' | 'pointer';
export const ENTRIES = [
  'direct',
  'invite',
  'home',
  'game',
  'external',
  'reload',
] as const;
export type Entry = (typeof ENTRIES)[number];

/** A game's view of where the player is, reported with every snapshot. */
export type PlayState = {
  stage: Stage;
  /** How this visit entered the current room; only the first report counts. */
  mode?: Mode;
  /** The room code, or any constant for local practice. */
  room?: string;
  /** People in the room or round, including this player. */
  humans?: number;
  /** Computer-controlled seats and roles. Scenery creatures are not seats. */
  npcs?: number;
  /** Changes whenever a new round starts, even without leaving `playing`. */
  round?: string | number;
  /** Milestone keys the current round has reached. */
  milestones?: readonly string[];
  /** How the round ended, once `stage` is `finished`. */
  result?: { outcome: Outcome; reason?: string; score?: number };
};

/** The collection's convention: local practice uses the room code `PRACTICE`. */
export function modeOf(
  session: { code: string; id: string },
  host: string,
): Mode {
  if (session.code === 'PRACTICE') return 'solo';
  return host === session.id ? 'host' : 'join';
}

export const EVENT_TYPES = [
  'opened',
  'mode',
  'step',
  'round',
  'crew',
  'end',
  'leave',
  'hidden',
  'visible',
  'exit',
  'return',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export type EventData = Record<string, string | number>;
export type WireEvent = {
  seq: number;
  /** Milliseconds since the page opened. */
  at: number;
  type: EventType;
  data?: EventData;
};

export type StageTime = Record<Stage, number>;
export type Exit = '' | 'left' | 'closed';

/** Cumulative, so a repeated or reordered delivery can never double-count. */
export type SessionSummary = {
  device: Device;
  entry: Entry;
  mode: '' | Mode;
  room: string;
  reached: string[];
  current: string;
  rounds: number;
  wins: number;
  losses: number;
  humans: number;
  npcs: number;
  elapsed: number;
  active: number;
  time: StageTime;
  actions: Record<string, number>;
  results: Record<string, number>;
  exit: Exit;
};

export type Batch = {
  v: typeof ANALYTICS_VERSION;
  id: string;
  game: string;
  /** Increases with every delivery attempt; older summaries are ignored. */
  b: number;
  summary: SessionSummary;
  events: WireEvent[];
};

const KEY = /^[a-z][a-z0-9-]{0,39}$/;
const ROOM = /^([a-f0-9]{10})?$/;
const SESSION = /^[a-zA-Z0-9-]{16,64}$/;

/** Turns arbitrary action or reason names into stored keys: `stopWind` → `stop-wind`. */
export function toKey(value: string): string {
  const key = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[^a-z]+/, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return KEY.test(key) ? key : '';
}

/** `won`, `lost` or `ended`, optionally followed by `:reason`. */
export function isResultKey(key: string): boolean {
  const [outcome, reason, extra] = key.split(':');
  return (
    (outcome === 'won' || outcome === 'lost' || outcome === 'ended') &&
    extra === undefined &&
    (reason === undefined || KEY.test(reason))
  );
}

export class AnalyticsError extends Error {}

function fail(message: string): never {
  throw new AnalyticsError(message);
}
function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(`Invalid ${name}.`);
  return value as Record<string, unknown>;
}
function count(value: unknown, name: string, max = MAX_COUNT): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    fail(`Invalid ${name}.`);
  return Math.min(max, Math.round(value));
}
function oneOf<T extends string>(
  value: unknown,
  options: readonly T[],
  name: string,
): T {
  if (!options.includes(value as T)) fail(`Invalid ${name}.`);
  return value as T;
}
function counts(
  value: unknown,
  name: string,
  valid: (key: string) => boolean,
): Record<string, number> {
  const entries = Object.entries(object(value, name));
  if (entries.length > MAX_COUNTED_KINDS) fail(`Too many ${name}.`);
  const result: Record<string, number> = {};
  for (const [key, amount] of entries) {
    if (!valid(key)) fail(`Invalid ${name}.`);
    result[key] = count(amount, name);
  }
  return result;
}
function eventData(value: unknown): EventData | undefined {
  if (value === undefined) return undefined;
  const entries = Object.entries(object(value, 'event data'));
  if (entries.length > 8) fail('Invalid event data.');
  const data: EventData = {};
  for (const [key, item] of entries) {
    if (!KEY.test(key)) fail('Invalid event data.');
    if (typeof item === 'number' && Number.isFinite(item))
      data[key] = Math.round(item * 1000) / 1000;
    else if (typeof item === 'string' && KEY.test(item)) data[key] = item;
    else fail('Invalid event data.');
  }
  return data;
}

/** Validates an untrusted delivery against the game it claims to come from. */
export function parseBatch(
  raw: unknown,
  resolve: (game: string) => GameAnalytics | undefined,
): Batch {
  const body = object(raw, 'report');
  if (body.v !== ANALYTICS_VERSION) fail('Unsupported report version.');
  if (typeof body.id !== 'string' || !SESSION.test(body.id))
    fail('Invalid session.');
  const definition =
    typeof body.game === 'string' ? resolve(body.game) : undefined;
  if (!definition) fail('Unknown game.');
  const steps = new Set(stepOrder(definition));
  const delivery = count(body.b, 'delivery');
  if (delivery < 1) fail('Invalid delivery.');

  const summary = object(body.summary, 'summary');
  if (!Array.isArray(summary.reached) || summary.reached.length > steps.size)
    fail('Invalid steps.');
  for (const step of summary.reached)
    if (typeof step !== 'string' || !steps.has(step)) fail('Invalid steps.');
  if (typeof summary.current !== 'string' || !steps.has(summary.current))
    fail('Invalid step.');
  if (typeof summary.room !== 'string' || !ROOM.test(summary.room))
    fail('Invalid room.');
  const time = object(summary.time, 'time');

  if (!Array.isArray(body.events) || body.events.length > MAX_BATCH_EVENTS)
    fail('Invalid events.');
  const events = body.events.map((raw): WireEvent => {
    const event = object(raw, 'event');
    const seq = count(event.seq, 'event');
    if (seq >= MAX_SESSION_EVENTS) fail('Too many events.');
    const type = oneOf(event.type, EVENT_TYPES, 'event');
    const data = eventData(event.data);
    if (type === 'step' && !steps.has(String(data?.step)))
      fail('Invalid step.');
    return {
      seq,
      at: count(event.at, 'event time', MAX_ELAPSED_MS),
      type,
      ...(data ? { data } : {}),
    };
  });

  return {
    v: ANALYTICS_VERSION,
    id: body.id,
    game: definition.game,
    b: delivery,
    summary: {
      device: oneOf(summary.device, ['touch', 'pointer'], 'device'),
      entry: oneOf(summary.entry, ENTRIES, 'entry'),
      mode: oneOf(summary.mode, ['', 'solo', 'host', 'join'], 'mode'),
      room: summary.room,
      reached: [...new Set(summary.reached as string[])],
      current: summary.current,
      rounds: count(summary.rounds, 'rounds'),
      wins: count(summary.wins, 'wins'),
      losses: count(summary.losses, 'losses'),
      humans: count(summary.humans, 'players', 16),
      npcs: count(summary.npcs, 'NPCs', 32),
      elapsed: count(summary.elapsed, 'duration', MAX_ELAPSED_MS),
      active: count(summary.active, 'duration', MAX_ELAPSED_MS),
      time: {
        menu: count(time.menu, 'time', MAX_ELAPSED_MS),
        lobby: count(time.lobby, 'time', MAX_ELAPSED_MS),
        playing: count(time.playing, 'time', MAX_ELAPSED_MS),
        finished: count(time.finished, 'time', MAX_ELAPSED_MS),
      },
      actions: counts(summary.actions, 'actions', (key) => KEY.test(key)),
      results: counts(summary.results, 'results', isResultKey),
      exit: oneOf(summary.exit, ['', 'left', 'closed'], 'exit'),
    },
    events,
  };
}
