import type { GameDatabase, SqlValue } from '../../../db/contract';
import {
  stepOrder,
  type Batch,
  type EventType,
  type GameAnalytics,
  type WireEvent,
} from '../../../shared/analytics/protocol';
import type {
  CrewKey,
  DayCount,
  GameReport,
  OverviewReport,
  SessionDetail,
  SessionPage,
  SessionRow,
  StepCount,
  Totals,
} from '../types';

export const RETENTION_MS = 180 * 86_400_000;
const LIVE_MS = 90_000;
const DAY_MS = 86_400_000;
/** Reports aggregate in memory; beyond this many sessions they say so. */
const MAX_ROWS = 100_000;

export type Range = { from: number; to: number; tz: number; now: number };

type Row = {
  id: string;
  game: string;
  started: number;
  updated: number;
  device: string;
  entry: string;
  mode: string;
  room: string;
  reached: string;
  furthest: string;
  last_step: string;
  rounds: number;
  wins: number;
  losses: number;
  humans: number;
  npcs: number;
  elapsed: number;
  active: number;
  menu_ms: number;
  lobby_ms: number;
  playing_ms: number;
  finished_ms: number;
  actions: string;
  results: string;
  exit: string;
};
const COLUMNS =
  'id, game, started, updated, device, entry, mode, room, reached, furthest, last_step, rounds, wins, losses, humans, npcs, elapsed, active, menu_ms, lobby_ms, playing_ms, finished_ms, actions, results, exit';

const UPSERT = `INSERT INTO analytics_sessions (
  id, delivery, game, started, updated, device, entry, mode, room, reached,
  furthest, furthest_rank, last_step, rounds, wins, losses, humans, npcs,
  elapsed, active, menu_ms, lobby_ms, playing_ms, finished_ms, actions,
  results, exit
) VALUES (${Array.from({ length: 27 }, () => '?').join(', ')})
ON CONFLICT(id) DO UPDATE SET
  updated = excluded.updated, delivery = excluded.delivery,
  device = excluded.device, entry = excluded.entry, mode = excluded.mode,
  room = excluded.room, reached = excluded.reached,
  furthest = excluded.furthest, furthest_rank = excluded.furthest_rank,
  last_step = excluded.last_step, rounds = excluded.rounds,
  wins = excluded.wins, losses = excluded.losses, humans = excluded.humans,
  npcs = excluded.npcs, elapsed = excluded.elapsed, active = excluded.active,
  menu_ms = excluded.menu_ms, lobby_ms = excluded.lobby_ms,
  playing_ms = excluded.playing_ms, finished_ms = excluded.finished_ms,
  actions = excluded.actions, results = excluded.results, exit = excluded.exit
WHERE excluded.delivery > analytics_sessions.delivery
  AND excluded.game = analytics_sessions.game`;
const EVENT = `INSERT OR IGNORE INTO analytics_events (session, seq, at, type, data)
SELECT ?, ?, ?, ?, ?
WHERE EXISTS (SELECT 1 FROM analytics_sessions WHERE id = ? AND game = ?)`;

/**
 * Stores a validated report. Summaries replace older ones by delivery number
 * and events are keyed by sequence, so retries and duplicates are harmless.
 */
export async function recordBatch(
  db: GameDatabase,
  batch: Batch,
  definition: GameAnalytics,
  now = Date.now(),
) {
  const order = stepOrder(definition);
  const { summary } = batch;
  const rank = Math.max(
    0,
    ...summary.reached.map((step) => order.indexOf(step)),
  );
  const values: SqlValue[] = [
    batch.id,
    batch.b,
    batch.game,
    Math.max(0, now - summary.elapsed),
    now,
    summary.device,
    summary.entry,
    summary.mode,
    summary.room,
    JSON.stringify(summary.reached),
    order[rank],
    rank,
    summary.current,
    summary.rounds,
    summary.wins,
    summary.losses,
    summary.humans,
    summary.npcs,
    summary.elapsed,
    summary.active,
    summary.time.menu,
    summary.time.lobby,
    summary.time.playing,
    summary.time.finished,
    JSON.stringify(summary.actions),
    JSON.stringify(summary.results),
    summary.exit,
  ];
  await db.batch([
    db.prepare(UPSERT).bind(...values),
    ...batch.events.map((event) =>
      db
        .prepare(EVENT)
        .bind(
          batch.id,
          event.seq,
          event.at,
          event.type,
          JSON.stringify(event.data ?? {}),
          batch.id,
          batch.game,
        ),
    ),
  ]);
}

export async function purgeSessions(db: GameDatabase, before: number) {
  await db.batch([
    db
      .prepare(
        'DELETE FROM analytics_events WHERE session IN (SELECT id FROM analytics_sessions WHERE updated < ?)',
      )
      .bind(before),
    db.prepare('DELETE FROM analytics_sessions WHERE updated < ?').bind(before),
  ]);
}

function parse<T>(value: string, fallback: T): T {
  try {
    return (JSON.parse(value) as T) ?? fallback;
  } catch {
    return fallback;
  }
}
const isLive = (row: Row, now: number) =>
  row.exit === '' && now - row.updated < LIVE_MS;

export function crewOf(row: {
  rounds: number;
  humans: number;
  npcs: number;
}): CrewKey | 'none' {
  if (!row.rounds) return 'none';
  if (row.humans >= 2) return row.npcs > 0 ? 'mixed' : 'friends';
  return row.npcs > 0 ? 'npcs' : 'alone';
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function tally(rows: Row[], now: number): Totals {
  const totals: Totals = {
    sessions: rows.length,
    chose: 0,
    played: 0,
    finished: 0,
    won: 0,
    rounds: 0,
    wins: 0,
    losses: 0,
    elapsed: 0,
    active: 0,
    time: { menu: 0, lobby: 0, playing: 0, finished: 0 },
    medianElapsed: 0,
    medianPlaying: 0,
    crew: { alone: 0, npcs: 0, friends: 0, mixed: 0 },
    modes: { solo: 0, host: 0, join: 0 },
    hosted: 0,
    hostedAlone: 0,
    touch: 0,
    touchPlayed: 0,
    live: 0,
  };
  const played: number[] = [];
  for (const row of rows) {
    const reached = parse<string[]>(row.reached, []);
    if (reached.includes('chose')) totals.chose++;
    if (reached.includes('finished')) totals.finished++;
    if (row.wins > 0) totals.won++;
    const crew = crewOf(row);
    if (crew !== 'none') {
      totals.played++;
      totals.crew[crew]++;
      played.push(row.playing_ms);
    }
    totals.rounds += row.rounds;
    totals.wins += row.wins;
    totals.losses += row.losses;
    totals.elapsed += row.elapsed;
    totals.active += row.active;
    totals.time.menu += row.menu_ms;
    totals.time.lobby += row.lobby_ms;
    totals.time.playing += row.playing_ms;
    totals.time.finished += row.finished_ms;
    if (row.mode === 'solo' || row.mode === 'host' || row.mode === 'join')
      totals.modes[row.mode]++;
    if (row.mode === 'host') {
      totals.hosted++;
      if (row.humans <= 1) totals.hostedAlone++;
    }
    if (row.device === 'touch') {
      totals.touch++;
      if (row.rounds > 0) totals.touchPlayed++;
    }
    if (isLive(row, now)) totals.live++;
  }
  totals.medianElapsed = median(rows.map((row) => row.elapsed));
  totals.medianPlaying = median(played);
  return totals;
}

function days(rows: Row[], range: Range): DayCount[] {
  if (!rows.length) return [];
  const dayOf = (time: number) =>
    Math.floor((time - range.tz * 60_000) / DAY_MS);
  const counts = new Map<number, DayCount>();
  let earliest = Infinity;
  for (const row of rows) {
    const day = dayOf(row.started);
    earliest = Math.min(earliest, day);
    const count = counts.get(day) ?? { day, sessions: 0, played: 0 };
    count.sessions++;
    if (row.rounds > 0) count.played++;
    counts.set(day, count);
  }
  const last = dayOf(Math.min(range.to, range.now));
  const first = Math.max(
    range.from > 0 ? dayOf(range.from) : earliest,
    last - 365,
  );
  const series: DayCount[] = [];
  for (let day = first; day <= last; day++)
    series.push(counts.get(day) ?? { day, sessions: 0, played: 0 });
  return series;
}

async function select(db: GameDatabase, range: Range, game?: string) {
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNS} FROM analytics_sessions WHERE started >= ? AND started < ?${
        game ? ' AND game = ?' : ''
      } ORDER BY started DESC LIMIT ?`,
    )
    .bind(range.from, range.to, ...(game ? [game] : []), MAX_ROWS + 1)
    .all<Row>();
  return {
    rows: results.slice(0, MAX_ROWS),
    truncated: results.length > MAX_ROWS,
  };
}

function topExit(rows: Row[], now: number): StepCount | null {
  const exits = new Map<string, number>();
  for (const row of rows)
    if (!isLive(row, now))
      exits.set(row.last_step, (exits.get(row.last_step) ?? 0) + 1);
  let top: StepCount | null = null;
  for (const [step, sessions] of exits)
    if (!top || sessions > top.sessions) top = { step, sessions };
  return top;
}

export async function overview(
  db: GameDatabase,
  games: readonly GameAnalytics[],
  range: Range,
): Promise<OverviewReport> {
  const { rows, truncated } = await select(db, range);
  const byGame = new Map<string, Row[]>();
  for (const row of rows) {
    const list = byGame.get(row.game) ?? [];
    list.push(row);
    byGame.set(row.game, list);
  }
  return {
    generated: range.now,
    truncated,
    totals: tally(rows, range.now),
    games: games.map(({ game }) => {
      const list = byGame.get(game) ?? [];
      return {
        game,
        ...tally(list, range.now),
        topExit: topExit(list, range.now),
      };
    }),
    days: days(rows, range),
  };
}

const DURATIONS = [
  { label: 'Under 30 s', below: 30_000 },
  { label: '30 s – 2 min', below: 120_000 },
  { label: '2 – 5 min', below: 300_000 },
  { label: '5 – 15 min', below: 900_000 },
  { label: '15 – 30 min', below: 1_800_000 },
  { label: '30 min or more', below: Infinity },
];

export async function gameReport(
  db: GameDatabase,
  definition: GameAnalytics,
  range: Range,
): Promise<GameReport> {
  const { rows, truncated } = await select(db, range, definition.game);
  const order = stepOrder(definition);
  const funnel = new Map(order.map((step) => [step, 0]));
  const exits = new Map<string, number>();
  const results = new Map<string, number>();
  const actions = new Map<string, { total: number; sessions: number }>();
  const durations = DURATIONS.map(({ label }) => ({ label, sessions: 0 }));
  const entries: Record<string, number> = {};
  for (const row of rows) {
    for (const step of new Set(parse<string[]>(row.reached, [])))
      if (funnel.has(step)) funnel.set(step, funnel.get(step)! + 1);
    if (!isLive(row, range.now))
      exits.set(row.last_step, (exits.get(row.last_step) ?? 0) + 1);
    for (const [key, rounds] of Object.entries(
      parse<Record<string, number>>(row.results, {}),
    ))
      results.set(key, (results.get(key) ?? 0) + rounds);
    for (const [action, total] of Object.entries(
      parse<Record<string, number>>(row.actions, {}),
    )) {
      const count = actions.get(action) ?? { total: 0, sessions: 0 };
      count.total += total;
      if (total > 0) count.sessions++;
      actions.set(action, count);
    }
    durations[DURATIONS.findIndex(({ below }) => row.elapsed < below)]
      .sessions++;
    entries[row.entry] = (entries[row.entry] ?? 0) + 1;
  }
  return {
    generated: range.now,
    truncated,
    game: definition.game,
    totals: tally(rows, range.now),
    days: days(rows, range),
    funnel: order.map((step) => ({ step, sessions: funnel.get(step)! })),
    exits: [
      ...order.filter((step) => exits.has(step)),
      ...[...exits.keys()].filter((step) => !order.includes(step)),
    ].map((step) => ({ step, sessions: exits.get(step)! })),
    results: [...results]
      .map(([key, rounds]) => ({ key, rounds }))
      .sort((a, b) => b.rounds - a.rounds),
    actions: [...actions]
      .map(([action, count]) => ({ action, ...count }))
      .sort((a, b) => b.total - a.total),
    durations,
    entries,
  };
}

export type SessionFilters = {
  game?: string;
  crew?: string;
  mode?: string;
  outcome?: string;
  device?: string;
  step?: string;
  cursor?: string;
  limit?: number;
};

const CREW_FILTERS = new Map([
  ['none', 'rounds = 0'],
  ['alone', 'rounds > 0 AND humans <= 1 AND npcs = 0'],
  ['npcs', 'rounds > 0 AND humans <= 1 AND npcs > 0'],
  ['friends', 'rounds > 0 AND humans >= 2 AND npcs = 0'],
  ['mixed', 'rounds > 0 AND humans >= 2 AND npcs > 0'],
]);
const OUTCOME_FILTERS = new Map([
  ['won', 'wins > 0'],
  ['lost', 'losses > 0 AND wins = 0'],
  ['unfinished', 'rounds > 0 AND wins = 0 AND losses = 0'],
]);

function sessionRow(row: Row, now: number): SessionRow {
  return {
    id: row.id,
    game: row.game,
    started: row.started,
    updated: row.updated,
    device: row.device,
    entry: row.entry,
    mode: row.mode,
    room: row.room,
    furthest: row.furthest,
    lastStep: row.last_step,
    rounds: row.rounds,
    wins: row.wins,
    losses: row.losses,
    humans: row.humans,
    npcs: row.npcs,
    elapsed: row.elapsed,
    active: row.active,
    exit: row.exit,
    live: isLive(row, now),
  };
}

export async function listSessions(
  db: GameDatabase,
  range: Range,
  filters: SessionFilters,
): Promise<SessionPage> {
  const where = ['started >= ?', 'started < ?'];
  const values: SqlValue[] = [range.from, range.to];
  const equal = (column: string, value: string) => {
    where.push(`${column} = ?`);
    values.push(value);
  };
  if (filters.game) equal('game', filters.game);
  const crew = CREW_FILTERS.get(filters.crew ?? '');
  if (crew) where.push(crew);
  const outcome = OUTCOME_FILTERS.get(filters.outcome ?? '');
  if (outcome) where.push(outcome);
  if (filters.mode === 'none') equal('mode', '');
  else if (['solo', 'host', 'join'].includes(filters.mode ?? ''))
    equal('mode', filters.mode!);
  if (filters.device === 'touch' || filters.device === 'pointer')
    equal('device', filters.device);
  if (filters.step) equal('last_step', filters.step);
  const cursor = /^(\d{1,15}):([a-zA-Z0-9-]{16,64})$/.exec(
    filters.cursor ?? '',
  );
  if (cursor) {
    where.push('(started < ? OR (started = ? AND id < ?))');
    values.push(Number(cursor[1]), Number(cursor[1]), cursor[2]);
  }
  const limit = Math.max(1, Math.min(200, filters.limit ?? 50));
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNS} FROM analytics_sessions WHERE ${where.join(
        ' AND ',
      )} ORDER BY started DESC, id DESC LIMIT ?`,
    )
    .bind(...values, limit + 1)
    .all<Row>();
  const page = results.slice(0, limit);
  const last = page.at(-1);
  return {
    sessions: page.map((row) => sessionRow(row, range.now)),
    next: results.length > limit && last ? `${last.started}:${last.id}` : null,
  };
}

export async function sessionDetail(
  db: GameDatabase,
  id: string,
  now: number,
): Promise<SessionDetail | null> {
  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM analytics_sessions WHERE id = ?`)
    .bind(id)
    .first<Row>();
  if (!row) return null;
  const { results: events } = await db
    .prepare(
      'SELECT seq, at, type, data FROM analytics_events WHERE session = ? ORDER BY seq',
    )
    .bind(id)
    .all<{ seq: number; at: number; type: EventType; data: string }>();
  const roommates = row.room
    ? (
        await db
          .prepare(
            `SELECT ${COLUMNS} FROM analytics_sessions WHERE game = ? AND room = ? AND id <> ? AND started BETWEEN ? AND ? ORDER BY started LIMIT 12`,
          )
          .bind(
            row.game,
            row.room,
            row.id,
            row.started - DAY_MS,
            row.started + DAY_MS,
          )
          .all<Row>()
      ).results
    : [];
  return {
    session: {
      ...sessionRow(row, now),
      reached: parse<string[]>(row.reached, []),
      time: {
        menu: row.menu_ms,
        lobby: row.lobby_ms,
        playing: row.playing_ms,
        finished: row.finished_ms,
      },
      actions: parse<Record<string, number>>(row.actions, {}),
      results: parse<Record<string, number>>(row.results, {}),
    },
    events: events.map(
      (event): WireEvent => ({
        seq: event.seq,
        at: event.at,
        type: event.type,
        data: parse<WireEvent['data']>(event.data, {}),
      }),
    ),
    roommates: roommates.map((mate) => sessionRow(mate, now)),
  };
}
