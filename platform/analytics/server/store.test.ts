import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateSqlite, openSqlite } from '../../../db/sqlite.mjs';
import { sqliteAdapter } from '../../../db/node';
import {
  parseBatch,
  type GameAnalytics,
} from '../../../shared/analytics/protocol';
import {
  gameReport,
  listSessions,
  overview,
  purgeSessions,
  recordBatch,
  sessionDetail,
  type Range,
} from './store';

const game: GameAnalytics = {
  game: 'test-game',
  milestones: [{ key: 'bridge', label: 'Crossed the bridge' }],
  actions: { grab: 'Grabbed a corner' },
};
const other: GameAnalytics = { game: 'other-game', milestones: [] };
const resolve = (id: string) => [game, other].find((item) => item.game === id);
const NOW = Date.UTC(2026, 8, 11, 12);
const id = (name: string) => `visit-${name}-0000000000`;
const range = (): Range => ({ from: 0, to: NOW + 1, tz: 0, now: NOW });

function report(
  name: string,
  delivery: number,
  summary: Record<string, unknown> = {},
  events: unknown[] = [],
  gameId = game.game,
) {
  return parseBatch(
    {
      v: 1,
      id: id(name),
      game: gameId,
      b: delivery,
      summary: {
        device: 'pointer',
        entry: 'direct',
        mode: '',
        room: '',
        reached: ['opened'],
        current: 'opened',
        rounds: 0,
        wins: 0,
        losses: 0,
        humans: 0,
        npcs: 0,
        elapsed: 60_000,
        active: 60_000,
        time: { menu: 60_000, lobby: 0, playing: 0, finished: 0 },
        actions: {},
        results: {},
        exit: 'closed',
        ...summary,
      },
      events,
    },
    resolve,
  );
}

async function withDatabase(
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

/** Four visits to the test game and one to another game. */
async function seed(db: ReturnType<typeof sqliteAdapter>) {
  const earlier = NOW - 600_000;
  await recordBatch(
    db,
    report('solo', 1, {
      device: 'touch',
      entry: 'home',
      mode: 'solo',
      reached: ['opened', 'chose', 'playing', 'bridge', 'finished', 'won'],
      current: 'won',
      rounds: 1,
      wins: 1,
      humans: 1,
      elapsed: 200_000,
      time: { menu: 50_000, lobby: 0, playing: 150_000, finished: 0 },
      actions: { grab: 3 },
      results: { 'won:delivered': 1 },
    }),
    game,
    earlier,
  );
  await recordBatch(
    db,
    report(
      'crew',
      1,
      {
        mode: 'host',
        room: 'aaaaaaaaaa',
        reached: ['opened', 'chose', 'lobby', 'playing', 'finished', 'again'],
        current: 'playing',
        rounds: 2,
        losses: 1,
        humans: 3,
        npcs: 1,
        elapsed: 700_000,
        time: { menu: 0, lobby: 100_000, playing: 500_000, finished: 0 },
        actions: { grab: 1 },
        results: { lost: 1, 'ended:left': 1 },
      },
      [
        { seq: 0, at: 0, type: 'opened', data: { entry: 'direct' } },
        { seq: 1, at: 900, type: 'mode', data: { mode: 'host' } },
      ],
    ),
    game,
    earlier,
  );
  await recordBatch(
    db,
    report('bounce', 1, { entry: 'external', elapsed: 10_000 }),
    game,
    earlier,
  );
  await recordBatch(
    db,
    report('waiting', 1, {
      mode: 'host',
      room: 'aaaaaaaaaa',
      reached: ['opened', 'chose', 'lobby'],
      current: 'lobby',
      humans: 1,
      exit: '',
    }),
    game,
    NOW - 10_000,
  );
  await recordBatch(db, report('elsewhere', 1, {}, [], other.game), other, NOW);
}

void test('newer reports replace the summary while stale and foreign ones change nothing', async () => {
  await withDatabase(async (db) => {
    const opened = { seq: 0, at: 0, type: 'opened' };
    await recordBatch(
      db,
      report(
        'a',
        2,
        {
          reached: ['opened', 'chose', 'playing'],
          current: 'playing',
          rounds: 2,
          elapsed: 90_000,
        },
        [opened],
      ),
      game,
      NOW,
    );
    await recordBatch(
      db,
      report('a', 1, { rounds: 1 }, [
        opened,
        { seq: 1, at: 5, type: 'hidden' },
      ]),
      game,
      NOW + 5000,
    );
    await recordBatch(
      db,
      report(
        'a',
        3,
        { rounds: 9 },
        [{ seq: 2, at: 9, type: 'hidden' }],
        other.game,
      ),
      other,
      NOW + 9000,
    );
    const detail = (await sessionDetail(db, id('a'), NOW))!;
    assert.equal(detail.session.game, game.game);
    assert.equal(detail.session.rounds, 2);
    assert.equal(detail.session.started, NOW - 90_000);
    assert.equal(detail.session.updated, NOW);
    assert.equal(detail.session.furthest, 'playing');
    assert.deepEqual(
      detail.events.map((event) => event.type),
      ['opened', 'hidden'],
    );
  });
});

void test('game reports count the funnel, exits, crews, results, actions and time', async () => {
  await withDatabase(async (db) => {
    await seed(db);
    const report = await gameReport(db, game, range());
    const { totals } = report;
    assert.deepEqual(
      [
        totals.sessions,
        totals.chose,
        totals.played,
        totals.finished,
        totals.won,
      ],
      [4, 3, 2, 2, 1],
    );
    assert.deepEqual([totals.rounds, totals.wins, totals.losses], [3, 1, 1]);
    assert.deepEqual(totals.crew, { alone: 1, npcs: 0, friends: 0, mixed: 1 });
    assert.deepEqual(totals.modes, { solo: 1, host: 2, join: 0 });
    assert.deepEqual([totals.hosted, totals.hostedAlone], [2, 1]);
    assert.deepEqual(
      [totals.touch, totals.touchPlayed, totals.live],
      [1, 1, 1],
    );
    assert.deepEqual(totals.time, {
      menu: 170_000,
      lobby: 100_000,
      playing: 650_000,
      finished: 0,
    });
    assert.equal(totals.medianElapsed, 130_000);
    assert.equal(totals.medianPlaying, 325_000);
    assert.deepEqual(
      report.funnel.map((step) => [step.step, step.sessions]),
      [
        ['opened', 4],
        ['chose', 3],
        ['lobby', 2],
        ['playing', 2],
        ['bridge', 1],
        ['finished', 2],
        ['won', 1],
        ['again', 1],
      ],
    );
    assert.deepEqual(report.exits, [
      { step: 'opened', sessions: 1 },
      { step: 'playing', sessions: 1 },
      { step: 'won', sessions: 1 },
    ]);
    assert.deepEqual(
      Object.fromEntries(report.results.map((row) => [row.key, row.rounds])),
      { 'won:delivered': 1, lost: 1, 'ended:left': 1 },
    );
    assert.deepEqual(report.actions, [
      { action: 'grab', total: 4, sessions: 2 },
    ]);
    assert.deepEqual(
      report.durations.map((bucket) => bucket.sessions),
      [1, 1, 1, 1, 0, 0],
    );
    assert.deepEqual(report.entries, { home: 1, direct: 2, external: 1 });
    assert.deepEqual(report.days, [
      { day: Math.floor(NOW / 86_400_000), sessions: 4, played: 2 },
    ]);
  });
});

void test('the overview lists every game, including ones nobody played', async () => {
  await withDatabase(async (db) => {
    await seed(db);
    const empty: GameAnalytics = { game: 'unplayed-game', milestones: [] };
    const result = await overview(db, [game, other, empty], range());
    assert.equal(result.totals.sessions, 5);
    assert.deepEqual(
      result.games.map((row) => [row.game, row.sessions]),
      [
        ['test-game', 4],
        ['other-game', 1],
        ['unplayed-game', 0],
      ],
    );
    assert.equal(result.games[0].topExit?.sessions, 1);
    assert.equal(result.games[2].topExit, null);
    assert.equal(result.truncated, false);
  });
});

void test('session lists filter and page; details include events and roommates', async () => {
  await withDatabase(async (db) => {
    await seed(db);
    const names = async (filters: Parameters<typeof listSessions>[2]) =>
      (
        await listSessions(db, range(), { game: game.game, ...filters })
      ).sessions
        .map((session) => session.id.split('-')[1])
        .sort();
    assert.deepEqual(await names({ crew: 'mixed' }), ['crew']);
    assert.deepEqual(await names({ crew: 'none' }), ['bounce', 'waiting']);
    assert.deepEqual(await names({ mode: 'none' }), ['bounce']);
    assert.deepEqual(await names({ mode: 'host' }), ['crew', 'waiting']);
    assert.deepEqual(await names({ outcome: 'won' }), ['solo']);
    assert.deepEqual(await names({ outcome: 'lost' }), ['crew']);
    assert.deepEqual(await names({ step: 'opened' }), ['bounce']);
    assert.deepEqual(await names({ crew: '__proto__' }), [
      'bounce',
      'crew',
      'solo',
      'waiting',
    ]);

    const first = await listSessions(db, range(), { limit: 3 });
    assert.equal(first.sessions.length, 3);
    assert.ok(first.next);
    const second = await listSessions(db, range(), {
      limit: 3,
      cursor: first.next!,
    });
    assert.equal(second.next, null);
    const all = [...first.sessions, ...second.sessions].map((row) => row.id);
    assert.equal(new Set(all).size, 5);

    const detail = (await sessionDetail(db, id('crew'), NOW))!;
    assert.deepEqual(
      detail.events.map((event) => event.data),
      [{ entry: 'direct' }, { mode: 'host' }],
    );
    assert.deepEqual(
      detail.roommates.map((mate) => mate.id),
      [id('waiting')],
    );
    assert.equal(detail.roommates[0].live, true);
    assert.deepEqual(detail.session.time, {
      menu: 0,
      lobby: 100_000,
      playing: 500_000,
      finished: 0,
    });
    assert.equal(await sessionDetail(db, id('missing'), NOW), null);
  });
});

void test('purging removes old sessions together with their events', async () => {
  await withDatabase(async (db) => {
    await seed(db);
    await purgeSessions(db, NOW - 300_000);
    const remaining = await listSessions(db, range(), {});
    assert.deepEqual(remaining.sessions.map((row) => row.id).sort(), [
      id('elsewhere'),
      id('waiting'),
    ]);
    const orphaned = await db
      .prepare('SELECT COUNT(*) AS count FROM analytics_events')
      .first<{ count: number }>();
    assert.equal(orphaned?.count, 0);
  });
});
