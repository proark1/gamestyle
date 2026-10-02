import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateSqlite, openSqlite } from '../../../db/sqlite.mjs';
import { sqliteAdapter } from '../../../db/node';
import {
  emptyDiagnosticSummary,
  parseDiagnostics,
} from '../../../shared/diagnostics/protocol';
import {
  healthReport,
  purgeDiagnostics,
  recordDiagnostics,
} from './diagnostics-store';

const NOW = Date.UTC(2026, 9, 2);
const range = { from: 0, to: NOW + 1000, tz: 0, now: NOW };
function batch(
  name: string,
  delivery = 1,
  patch: Record<string, unknown> = {},
) {
  return parseDiagnostics({
    v: 1,
    id: `visit-${name}-0123456789abcdef`,
    game: 'course-correction',
    delivery,
    elapsedMs: 1000,
    platform: 'web',
    engine: 'chromium',
    release: 'build-a',
    summary: emptyDiagnosticSummary(),
    ...patch,
  });
}
async function database(
  run: (db: ReturnType<typeof sqliteAdapter>) => Promise<void>,
) {
  const sqlite = openSqlite(':memory:');
  try {
    migrateSqlite(sqlite);
    await run(sqliteAdapter(sqlite));
  } finally {
    sqlite.close();
  }
}
void test('duplicate, stale and conflicting diagnostic deliveries cannot change a visit', () =>
  database(async (db) => {
    await recordDiagnostics(
      db,
      batch('one', 2, {
        summary: {
          ...emptyDiagnosticSummary(),
          readyMs: 2000,
          errors: { resource: 2 },
        },
      }),
      NOW,
    );
    await recordDiagnostics(db, batch('one', 2), NOW);
    await recordDiagnostics(db, batch('one', 1), NOW);
    await recordDiagnostics(db, batch('one', 3, { game: 'slopewreck' }), NOW);
    await recordDiagnostics(
      db,
      batch('one', 3, { release: 'different-build' }),
      NOW,
    );
    const report = await healthReport(db, range);
    assert.equal(report.totals.visits, 1);
    assert.equal(report.totals.medianReadyMs, 2000);
    assert.equal(report.totals.errors.resource, 2);
    assert.equal(report.games[0].game, 'course-correction');
    await recordDiagnostics(
      db,
      batch('one', 4, {
        summary: {
          ...emptyDiagnosticSummary(),
          readyMs: 2000,
          errors: { resource: 3 },
        },
      }),
      NOW,
    );
    assert.equal((await healthReport(db, range)).totals.errors.resource, 3);
  }));
void test('performance averages use real sample counts and exclude unrendered visits', () =>
  database(async (db) => {
    await recordDiagnostics(
      db,
      batch('fast', 1, {
        summary: {
          ...emptyDiagnosticSummary(),
          readyMs: 1000,
          samples: 2,
          fpsTotal: 120,
          frameMsTotal: 34,
          workMsTotal: 10,
          maxGeometries: 50,
        },
      }),
      NOW,
    );
    await recordDiagnostics(
      db,
      batch('slow', 1, {
        platform: 'android',
        engine: 'webkit',
        release: 'build-b',
        summary: {
          ...emptyDiagnosticSummary(),
          readyMs: 3000,
          samples: 1,
          fpsTotal: 30,
          frameMsTotal: 34,
          workMsTotal: 10,
          errors: { offline: 1 },
        },
      }),
      NOW,
    );
    await recordDiagnostics(
      db,
      batch('never', 1, {
        game: 'slopewreck',
        summary: {
          ...emptyDiagnosticSummary(),
          errors: { 'start-timeout': 1 },
        },
      }),
      NOW,
    );
    const report = await healthReport(db, range);
    assert.equal(report.totals.visits, 3);
    assert.equal(report.totals.sampledVisits, 2);
    assert.equal(report.totals.averageFps, 50);
    assert.equal(report.totals.averageP95FrameMs, 23);
    assert.equal(report.totals.medianReadyMs, 2000);
    assert.equal(report.totals.issueVisits, 2);
    assert.equal(report.totals.maxGeometries, 50);
    const selected = await healthReport(db, range, {
      platform: 'android',
      release: 'build-b',
      engine: 'webkit',
    });
    assert.equal(selected.totals.visits, 1);
    assert.equal(selected.totals.averageFps, 30);
    assert.equal(
      (await healthReport(db, range, { game: 'slopewreck' })).totals.averageFps,
      null,
    );
    assert.equal(
      (await healthReport(db, { ...range, from: NOW + 1 })).totals.visits,
      0,
    );
  }));
void test('diagnostic retention deletes only visits older than the cutoff', () =>
  database(async (db) => {
    await recordDiagnostics(db, batch('old'), NOW - 100000);
    await recordDiagnostics(db, batch('new'), NOW);
    await purgeDiagnostics(db, NOW - 50000);
    assert.equal((await healthReport(db, range)).totals.visits, 1);
  }));
