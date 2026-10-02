import type { GameDatabase } from '../../../db/contract';
import {
  ERROR_KINDS,
  type DiagnosticBatch,
  type DiagnosticSummary,
} from '../../../shared/diagnostics/protocol';
import type { HealthReport, HealthTotals } from '../health';
import type { Range } from './store';

const MAX_ROWS = 10000;
type DiagnosticRow = Pick<
  DiagnosticBatch,
  'game' | 'platform' | 'engine' | 'release'
> & { summary: string };
export async function recordDiagnostics(
  db: GameDatabase,
  batch: DiagnosticBatch,
  now = Date.now(),
) {
  await db
    .prepare(`INSERT INTO analytics_diagnostics (id, game, delivery, started, updated, platform, engine, release, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET delivery = excluded.delivery, updated = excluded.updated, summary = excluded.summary
    WHERE excluded.delivery > analytics_diagnostics.delivery
      AND excluded.game = analytics_diagnostics.game
      AND excluded.platform = analytics_diagnostics.platform
      AND excluded.engine = analytics_diagnostics.engine
      AND excluded.release = analytics_diagnostics.release`)
    .bind(
      batch.id,
      batch.game,
      batch.delivery,
      Math.max(0, now - batch.elapsedMs),
      now,
      batch.platform,
      batch.engine,
      batch.release,
      JSON.stringify(batch.summary),
    )
    .run();
}
export async function purgeDiagnostics(db: GameDatabase, before: number) {
  await db
    .prepare('DELETE FROM analytics_diagnostics WHERE updated < ?')
    .bind(before)
    .run();
}

function tally(rows: DiagnosticRow[]): HealthTotals {
  const totals: HealthTotals = {
    visits: rows.length,
    readyVisits: 0,
    issueVisits: 0,
    sampledVisits: 0,
    samples: 0,
    medianReadyMs: null,
    averageFps: null,
    averageP95FrameMs: null,
    averageP95WorkMs: null,
    maxGeometries: 0,
    maxTextures: 0,
    errors: {},
  };
  const ready: number[] = [];
  let fps = 0,
    frame = 0,
    work = 0;
  for (const row of rows) {
    const summary = JSON.parse(row.summary) as DiagnosticSummary;
    if (summary.readyMs !== null) ready.push(summary.readyMs);
    if (summary.samples) totals.sampledVisits++;
    totals.samples += summary.samples;
    fps += summary.fpsTotal;
    frame += summary.frameMsTotal;
    work += summary.workMsTotal;
    totals.maxGeometries = Math.max(
      totals.maxGeometries,
      summary.maxGeometries,
    );
    totals.maxTextures = Math.max(totals.maxTextures, summary.maxTextures);
    if (Object.values(summary.errors).some((count) => count && count > 0))
      totals.issueVisits++;
    for (const kind of ERROR_KINDS)
      if (summary.errors[kind])
        totals.errors[kind] =
          (totals.errors[kind] ?? 0) + summary.errors[kind]!;
  }
  totals.readyVisits = ready.length;
  if (ready.length) {
    ready.sort((a, b) => a - b);
    const middle = ready.length >> 1;
    totals.medianReadyMs =
      ready.length % 2
        ? ready[middle]
        : Math.round((ready[middle - 1] + ready[middle]) / 2);
  }
  if (totals.samples) {
    totals.averageFps = Math.round(fps / totals.samples);
    totals.averageP95FrameMs = Math.round(frame / totals.samples);
    totals.averageP95WorkMs = Math.round(work / totals.samples);
  }
  return totals;
}
export type HealthFilters = Partial<
  Pick<DiagnosticBatch, 'game' | 'platform' | 'engine' | 'release'>
>;
export async function healthReport(
  db: GameDatabase,
  range: Range,
  filters: HealthFilters = {},
): Promise<HealthReport> {
  const where = ['started >= ?', 'started < ?'];
  const values: (string | number)[] = [range.from, range.to];
  for (const key of ['game', 'platform', 'engine', 'release'] as const) {
    if (filters[key]) {
      where.push(`${key} = ?`);
      values.push(filters[key]!);
    }
  }
  const { results } = await db
    .prepare(
      `SELECT game, platform, engine, release, summary FROM analytics_diagnostics WHERE ${where.join(' AND ')} ORDER BY started DESC LIMIT ?`,
    )
    .bind(...values, MAX_ROWS + 1)
    .all<DiagnosticRow>();
  const rows = results.slice(0, MAX_ROWS);
  const grouped = <K extends 'platform' | 'engine' | 'release'>(key: K) => {
    const groups = new Map<DiagnosticRow[K], number>();
    for (const row of rows)
      groups.set(row[key], (groups.get(row[key]) ?? 0) + 1);
    return [...groups]
      .map(([value, visits]) => ({ [key]: value, visits }))
      .sort((a, b) => b.visits - a.visits);
  };
  const games = new Map<string, DiagnosticRow[]>();
  for (const row of rows) {
    const group = games.get(row.game) ?? [];
    group.push(row);
    games.set(row.game, group);
  }
  return {
    generated: range.now,
    truncated: results.length > MAX_ROWS,
    totals: tally(rows),
    games: [...games]
      .map(([game, group]) => ({ game, ...tally(group) }))
      .sort((a, b) => b.issueVisits - a.issueVisits || b.visits - a.visits),
    platforms: grouped('platform') as HealthReport['platforms'],
    engines: grouped('engine') as HealthReport['engines'],
    releases: grouped('release') as HealthReport['releases'],
  };
}
