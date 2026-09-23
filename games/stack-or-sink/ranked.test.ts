import test from 'node:test';
import assert from 'node:assert/strict';
import { openSqlite, migrateSqlite } from '../../db/sqlite.mjs';
import { sqliteAdapter } from '../../db/node';
import { createAccount } from '../../shared/accounts/server/store';
import {
  readInventory,
  initializeInventory,
} from '../../shared/commerce/server/inventory';
import { readRankedStack } from '../../shared/challenges/server/ranked';
import { reviewRankedRun } from '../../shared/challenges/server/ranked-review';
import { stackWeek } from '../../shared/challenges/catalog';
import {
  changeCrew,
  createCrew,
  joinCrew,
  readCrew,
} from '../../shared/crews/server/store';
import { readCrewRecords } from '../../shared/crews/server/records';
import { verifiedStackRoom } from './challenge-server';
import type { Session } from '../../shared/rooms/session';

const NOW = Date.UTC(2026, 8, 22, 10);

async function fixture(t: { after: (f: () => void) => void }) {
  const native = openSqlite(':memory:');
  t.after(() => native.close());
  migrateSqlite(native);
  const db = sqliteAdapter(native);
  const users = await Promise.all(
    [0, 1].map((i) =>
      createAccount(
        db,
        [{ provider: 'email', subject: `ranked-${i}`, hint: 'private' }],
        NOW,
      ),
    ),
  );
  for (const id of users) await initializeInventory(db, id, NOW);
  const call = (user: number, body: Record<string, unknown>, now = NOW) =>
    verifiedStackRoom(db, users[user], body, now);
  const create = async (now = NOW) =>
    (await call(0, { op: 'create', ranked: true }, now)).session!;
  const start = (session: Session, requestId: string, now = NOW) =>
    call(
      0,
      { op: 'action', ...session, action: { type: 'start' }, requestId },
      now,
    );
  const finish = async (session: Session, height: number, now = NOW + 1000) => {
    const key = `verified-stack:${session.code}`;
    const row = native
      .prepare('SELECT state FROM rooms WHERE code = ?')
      .get(key) as { state: string };
    const room = JSON.parse(row.state);
    room.world.phase = 'lost';
    room.challengeHeight = height;
    native
      .prepare('UPDATE rooms SET state = ? WHERE code = ?')
      .run(JSON.stringify(room), key);
    return call(0, { op: 'sync', ...session }, now);
  };
  return { native, db, users, call, create, start, finish };
}

void test('a ranked start consumes one attempt per present account, retries and lobby exits consume none', async (t) => {
  const f = await fixture(t);
  const room = await f.create();
  const guest = (await f.call(1, { op: 'join', code: room.code })).session!;
  assert.equal(room.ranked, true);
  assert.equal(guest.ranked, true);
  assert.equal(
    (await readRankedStack(f.db, f.users[0], NOW)).attemptsRemaining,
    5,
  );
  await f.start(room, 'start');
  await f.start(room, 'start');
  await Promise.all([
    f.call(0, { op: 'sync', ...room }),
    f.call(1, { op: 'sync', ...guest }),
  ]);
  for (const id of f.users)
    assert.equal((await readRankedStack(f.db, id, NOW)).attemptsRemaining, 4);
  assert.equal(
    (
      f.native.prepare('SELECT COUNT(*) AS n FROM ranked_attempts').get() as {
        n: number;
      }
    ).n,
    2,
  );
  await f.finish(room, 3.5);
  const board = await readRankedStack(f.db, f.users[0], NOW);
  assert.equal(board.boards[1].population, 2);
  assert.deepEqual(
    board.boards[1].entries.map((entry) => entry.place),
    [1, 1],
  );
  assert.equal(board.boards[1].entries[0].heightCm, 350);
  assert.equal(
    (await readInventory(f.db, f.users[0])).items.includes(
      'stack-rank-safety-helmet',
    ),
    false,
  );
});

void test('five starts exhaust the week, and leaving during a run removes ranking eligibility', async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 5; i++) {
    const room = await f.create();
    const guest = (await f.call(1, { op: 'join', code: room.code })).session!;
    await f.start(room, `start-${i}`);
    if (i === 0) {
      await f.call(1, { op: 'leave', ...guest });
      await f.finish(room, 7);
      assert.equal(
        (await readRankedStack(f.db, f.users[0], NOW)).boards[1].population,
        0,
      );
    }
  }
  const sixth = await f.create();
  await assert.rejects(f.start(sixth, 'sixth'), /all five ranked starts/);
  assert.equal(
    (await readRankedStack(f.db, f.users[0], NOW)).attemptsRemaining,
    0,
  );
  assert.equal(
    (
      f.native.prepare('SELECT COUNT(*) AS n FROM ranked_attempts').get() as {
        n: number;
      }
    ).n,
    10,
  );
});

void test('a service failure restores each reserved attempt once and cannot later qualify', async (t) => {
  const f = await fixture(t);
  const room = await f.create();
  await f.call(1, { op: 'join', code: room.code });
  await f.start(room, 'failed-start');
  const run = f.native
    .prepare('SELECT run_id AS id FROM ranked_attempts LIMIT 1')
    .get() as { id: string };
  const review = {
    runId: run.id,
    kind: 'service' as const,
    actor: 'ops-test',
    reason: 'Confirmed room service interruption',
  };
  assert.equal(await reviewRankedRun(f.db, review, NOW + 500), 'recorded');
  assert.equal(
    await reviewRankedRun(f.db, review, NOW + 600),
    'already-recorded',
  );
  for (const id of f.users)
    assert.equal((await readRankedStack(f.db, id, NOW)).attemptsRemaining, 5);
  await f.finish(room, 7);
  assert.equal(
    (await readRankedStack(f.db, f.users[0], NOW)).boards[1].population,
    0,
  );
  const next = await f.create();
  await f.start(next, 'replacement');
  assert.equal(
    (await readRankedStack(f.db, f.users[0], NOW)).attemptsRemaining,
    4,
  );
  assert.equal(
    (
      f.native
        .prepare(
          'SELECT COUNT(*) AS n FROM ranked_run_reviews WHERE run_id = ?',
        )
        .get(run.id) as { n: number }
    ).n,
    1,
  );
});

void test('review voids a completed run without returning attempts and closes at finalization', async (t) => {
  const f = await fixture(t);
  const room = await f.create();
  await f.start(room, 'anomalous');
  await f.finish(room, 7);
  const run = f.native
    .prepare('SELECT run_id AS id FROM ranked_attempts LIMIT 1')
    .get() as { id: string };
  await assert.rejects(
    reviewRankedRun(
      f.db,
      { runId: run.id, kind: 'service', actor: 'ops-test', reason: 'Too late' },
      NOW + 2000,
    ),
    /already completed/,
  );
  assert.equal(
    await reviewRankedRun(
      f.db,
      { runId: run.id, kind: 'review', actor: 'ops-test', reason: 'Anomaly' },
      NOW + 2000,
    ),
    'recorded',
  );
  const view = await readRankedStack(f.db, f.users[0], NOW);
  assert.equal(view.attemptsRemaining, 4);
  assert.equal(view.boards[0].population, 0);
  await assert.rejects(
    reviewRankedRun(
      f.db,
      {
        runId: run.id,
        kind: 'service',
        actor: 'ops-test',
        reason: 'Changed mind',
      },
      NOW + 3000,
    ),
    /different review decision/,
  );
  const late = await f.create();
  await f.start(late, 'late');
  await f.finish(late, 7);
  const laterRun = f.native
    .prepare(
      'SELECT run_id AS id FROM ranked_attempts WHERE run_id != ? LIMIT 1',
    )
    .get(run.id) as { id: string };
  await readRankedStack(f.db, f.users[0], stackWeek(NOW).end + 86400001);
  await assert.rejects(
    reviewRankedRun(
      f.db,
      {
        runId: laterRun.id,
        kind: 'review',
        actor: 'ops-test',
        reason: 'Too late',
      },
      stackWeek(NOW).end + 86400002,
    ),
    /review window\/board is closed/,
  );
});

void test('a voided service run releases its crew lock if no other run represents that crew', async (t) => {
  const f = await fixture(t);
  await createCrew(f.db, f.users[0], 'Interrupted Crew', 'rocket', NOW);
  const oldCrew = (await readCrew(f.db, f.users[0]))!;
  const room = await f.create();
  await f.start(room, 'crew-interrupted');
  const run = f.native
    .prepare('SELECT run_id AS id FROM ranked_attempts LIMIT 1')
    .get() as { id: string };
  assert.equal(
    (
      f.native.prepare('SELECT COUNT(*) AS n FROM ranked_crew_locks').get() as {
        n: number;
      }
    ).n,
    1,
  );
  await reviewRankedRun(
    f.db,
    {
      runId: run.id,
      kind: 'service',
      actor: 'ops-test',
      reason: 'Confirmed interrupted crew room',
    },
    NOW + 500,
  );
  assert.equal(
    (
      f.native.prepare('SELECT COUNT(*) AS n FROM ranked_crew_locks').get() as {
        n: number;
      }
    ).n,
    0,
  );
  await changeCrew(f.db, f.users[0], { op: 'leave', crewId: oldCrew.id }, NOW);
  await createCrew(f.db, f.users[0], 'Replacement Crew', 'sun', NOW);
  const replacement = (await readCrew(f.db, f.users[0]))!;
  const next = await f.create();
  await f.start(next, 'crew-replacement');
  assert.equal(
    (
      f.native
        .prepare('SELECT crew_id AS id FROM ranked_crew_locks LIMIT 1')
        .get() as { id: string }
    ).id,
    replacement.id,
  );
});

void test('100 eligible accounts unlock tied prizes only after review, finalization is idempotent', async (t) => {
  const f = await fixture(t);
  const week = stackWeek(NOW);
  for (let i = 0; i < 100; i++) {
    const id =
      i < 2
        ? f.users[i]
        : await createAccount(
            f.db,
            [
              {
                provider: 'email',
                subject: `ranked-fill-${i}`,
                hint: 'private',
              },
            ],
            NOW,
          );
    await initializeInventory(f.db, id, NOW);
    f.native
      .prepare('INSERT INTO ranked_tags (account_id,tag) VALUES (?,?)')
      .run(id, `Builder TEST${i}`);
    // Trusted database fixture. No browser endpoint accepts inserted scores.
    f.native
      .prepare(`INSERT INTO ranked_attempts (account_id,run_id,week,room_code,player_id,team_size,started,eligible,height_cm,completed)
      VALUES (?,?,?,?,?,?,?,1,?,?)`)
      .run(
        id,
        `run-${i}`,
        week.start,
        `test-${i}`,
        `player-${i}`,
        1,
        NOW,
        i < 11 ? 600 : 500,
        NOW,
      );
  }
  const early = await readRankedStack(f.db, f.users[0], week.end + 1000);
  assert.equal(early.previous.finalized, false);
  assert.equal(
    (await readInventory(f.db, f.users[0])).items.includes(
      'stack-rank-safety-helmet',
    ),
    false,
  );
  const after = week.end + 86400000 + 1000;
  const final = await readRankedStack(f.db, f.users[0], after);
  assert.equal(final.previous.finalized, true);
  assert.equal(final.previous.boards[0].population, 100);
  for (const id of f.users) {
    const items = (await readInventory(f.db, id)).items;
    assert.ok(items.includes('stack-rank-safety-helmet'));
    assert.ok(items.includes('stack-rank-crown'));
  }
  const count = (
    f.native
      .prepare(
        "SELECT COUNT(*) AS n FROM commerce_grants WHERE source = 'reward'",
      )
      .get() as { n: number }
  ).n;
  assert.equal(count, 22); // Eleven tied for first, including the 10% and 1% cutoffs.
  await readRankedStack(f.db, f.users[0], after + 1000);
  assert.equal(
    (
      f.native
        .prepare(
          "SELECT COUNT(*) AS n FROM commerce_grants WHERE source = 'reward'",
        )
        .get() as { n: number }
    ).n,
    count,
  );
});

void test('one persistent crew gets one best run per team size with only its start-time roster', async (t) => {
  const f = await fixture(t);
  await createCrew(f.db, f.users[0], 'Wobbly Legends', 'rocket', NOW);
  const crew = (await readCrew(f.db, f.users[0]))!;
  const invite = (await changeCrew(
    f.db,
    f.users[0],
    { op: 'invite', crewId: crew.id },
    NOW,
  ))!;
  await joinCrew(f.db, f.users[1], invite.code, NOW);
  const play = async (height: number, index: number) => {
    const room = await f.create();
    await f.call(1, { op: 'join', code: room.code });
    await f.start(room, `crew-${index}`);
    await f.finish(room, height);
  };
  await play(3.5, 1);
  await play(6.25, 2);
  const view = await readRankedStack(f.db, f.users[0], NOW);
  assert.equal(view.boards[1].crewMates?.length, 2);
  assert.deepEqual(
    view.boards[1].crewMates?.map((entry) => entry.place),
    [1, 1],
  );
  assert.equal(view.crewBoards[1].population, 1);
  assert.equal(view.crewBoards[1].entries[0].heightCm, 625);
  assert.equal(view.crewBoards[1].entries[0].self, true);
  assert.equal(
    (await readRankedStack(f.db, f.users[1], NOW)).crewBoards[1].myPlace,
    1,
  );
  assert.ok(!JSON.stringify(view.crewBoards).includes(crew.name));
  for (const id of f.users)
    assert.ok(!JSON.stringify(view.crewBoards).includes(id));
  await changeCrew(
    f.db,
    f.users[1],
    { op: 'leave', crewId: crew.id },
    NOW + 2000,
  );
  assert.equal(
    (await readRankedStack(f.db, f.users[1], NOW + 2000)).boards[1].crewMates
      ?.length,
    0,
  );
  assert.equal(
    (await readRankedStack(f.db, f.users[1], NOW + 2000)).crewBoards[1].myPlace,
    1,
  );
  assert.equal(
    (
      f.native.prepare('SELECT COUNT(*) AS n FROM ranked_crew_runs').get() as {
        n: number;
      }
    ).n,
    2,
  );
});

void test('mixed-crew friends keep personal rankings but cannot claim a crew score', async (t) => {
  const f = await fixture(t);
  await createCrew(f.db, f.users[0], 'Red Crew', 'rocket', NOW);
  await createCrew(f.db, f.users[1], 'Blue Crew', 'sun', NOW);
  const room = await f.create();
  await f.call(1, { op: 'join', code: room.code });
  await f.start(room, 'mixed');
  await f.finish(room, 3.5);
  const view = await readRankedStack(f.db, f.users[0], NOW);
  assert.equal(view.boards[1].population, 2);
  assert.equal(view.crewBoards[1].population, 0);
  assert.equal(
    (
      f.native.prepare('SELECT COUNT(*) AS n FROM ranked_crew_locks').get() as {
        n: number;
      }
    ).n,
    0,
  );
});

void test('a failed crew record rolls back the ranked start and can be retried once', async (t) => {
  const f = await fixture(t);
  await createCrew(f.db, f.users[0], 'Rollback Crew', 'rocket', NOW);
  const room = await f.create();
  f.native
    .exec(`CREATE TRIGGER fail_crew_record BEFORE INSERT ON ranked_crew_runs
    BEGIN SELECT RAISE(ABORT, 'crew record unavailable'); END`);
  await assert.rejects(f.start(room, 'start'), /crew record unavailable/);
  assert.equal(
    (
      f.native.prepare('SELECT COUNT(*) AS n FROM ranked_attempts').get() as {
        n: number;
      }
    ).n,
    0,
  );
  assert.equal(
    (
      f.native.prepare('SELECT COUNT(*) AS n FROM ranked_crew_locks').get() as {
        n: number;
      }
    ).n,
    0,
  );
  const stored = f.native
    .prepare('SELECT state FROM rooms WHERE code = ?')
    .get(`verified-stack:${room.code}`) as { state: string };
  assert.equal(JSON.parse(stored.state).world.phase, 'lobby');
  f.native.exec('DROP TRIGGER fail_crew_record');
  await f.start(room, 'start');
  assert.equal(
    (
      f.native.prepare('SELECT COUNT(*) AS n FROM ranked_attempts').get() as {
        n: number;
      }
    ).n,
    1,
  );
  assert.equal(
    (
      f.native.prepare('SELECT COUNT(*) AS n FROM ranked_crew_runs').get() as {
        n: number;
      }
    ).n,
    1,
  );
});

void test('changing crews cannot transfer an old record or represent two crews in one week', async (t) => {
  const f = await fixture(t);
  await createCrew(f.db, f.users[0], 'First Crew', 'rocket', NOW);
  const first = (await readCrew(f.db, f.users[0]))!;
  const oldRoom = await f.create();
  await f.start(oldRoom, 'first');
  await f.finish(oldRoom, 3.5);
  await changeCrew(
    f.db,
    f.users[0],
    { op: 'leave', crewId: first.id },
    NOW + 2000,
  );
  await createCrew(f.db, f.users[0], 'Second Crew', 'sun', NOW + 2000);
  const second = (await readCrew(f.db, f.users[0]))!;
  const newRoom = await f.create(NOW + 2000);
  await f.start(newRoom, 'second', NOW + 2000);
  await f.finish(newRoom, 6.5, NOW + 3000);
  let view = await readRankedStack(f.db, f.users[0], NOW + 3000);
  assert.equal(view.boards[0].entries[0].heightCm, 650);
  assert.equal(view.crewBoards[0].entries[0].heightCm, 350);
  assert.equal(
    (
      f.native.prepare('SELECT COUNT(*) AS n FROM ranked_crew_runs').get() as {
        n: number;
      }
    ).n,
    1,
  );
  assert.equal(
    (
      f.native.prepare('SELECT crew_id FROM ranked_crew_locks').get() as {
        crew_id: string;
      }
    ).crew_id,
    first.id,
  );
  const nextWeek = stackWeek(NOW).end + 2000;
  const resetRoom = await f.create(nextWeek);
  await f.start(resetRoom, 'next-week', nextWeek);
  await f.finish(resetRoom, 6.5, nextWeek + 1000);
  view = await readRankedStack(f.db, f.users[0], nextWeek + 1000);
  assert.equal(view.crewBoards[0].population, 1);
  assert.equal(
    (
      f.native
        .prepare('SELECT crew_id FROM ranked_crew_runs WHERE week = ?')
        .get(stackWeek(nextWeek).start) as { crew_id: string }
    ).crew_id,
    second.id,
  );
});

void test('100 distinct crews earn tied rewards for qualifying-run members only, once after review', async (t) => {
  const f = await fixture(t);
  const week = stackWeek(NOW);
  for (let i = 0; i < 100; i++) {
    const id =
      i < 2
        ? f.users[i]
        : await createAccount(
            f.db,
            [
              {
                provider: 'email',
                subject: `crew-rank-fill-${i}`,
                hint: 'private',
              },
            ],
            NOW,
          );
    const crew = `crew-fixture-${i}`;
    f.native
      .prepare('INSERT INTO crews (id,name,emblem,created) VALUES (?,?,?,?)')
      .run(crew, `Private ${i}`, 'rocket', NOW);
    f.native
      .prepare('INSERT INTO ranked_crew_tags (crew_id,tag) VALUES (?,?)')
      .run(crew, `Crew TEST${i}`);
    f.native
      .prepare(
        'INSERT INTO ranked_crew_runs (run_id,crew_id,week,team_size) VALUES (?,?,?,1)',
      )
      .run(`crew-run-${i}`, crew, week.start);
    f.native
      .prepare(`INSERT INTO ranked_attempts (account_id,run_id,week,room_code,player_id,team_size,started,eligible,height_cm,completed)
      VALUES (?,?,?,?,?,1,?,1,?,?)`)
      .run(
        id,
        `crew-run-${i}`,
        week.start,
        `crew-room-${i}`,
        `player-${i}`,
        NOW,
        i < 11 ? 600 : 500,
        NOW,
      );
  }
  const late = await createAccount(
    f.db,
    [{ provider: 'email', subject: 'late-crew-member', hint: 'private' }],
    NOW,
  );
  await initializeInventory(f.db, late, NOW);
  f.native
    .prepare(
      'INSERT INTO crew_members (account_id,crew_id,public_id,seat,joined) VALUES (?,?,?,?,?)',
    )
    .run(late, 'crew-fixture-0', 'late-public', 0, NOW + 1000);
  await readRankedStack(f.db, f.users[0], week.end + 1000);
  assert.equal(
    (
      f.native
        .prepare(
          "SELECT COUNT(*) AS n FROM commerce_grants WHERE reference LIKE '%:crew:%'",
        )
        .get() as { n: number }
    ).n,
    0,
  );
  const after = week.end + 86400000 + 1000;
  const view = await readRankedStack(f.db, f.users[0], after);
  assert.equal(view.previous.crewBoards[0].population, 100);
  assert.deepEqual(await readCrewRecords(f.db, 'crew-fixture-0'), {
    rankedRuns: 1,
    bestTowerCm: 600,
    towerAce: 1,
    skylineCrown: 1,
  });
  assert.deepEqual(await readCrewRecords(f.db, 'crew-fixture-50'), {
    rankedRuns: 1,
    bestTowerCm: 500,
    towerAce: 0,
    skylineCrown: 0,
  });
  assert.deepEqual(
    view.previous.crewBoards[0].entries
      .slice(0, 11)
      .map((entry) => entry.place),
    Array(11).fill(1),
  );
  for (const id of f.users) {
    const items = (await readInventory(f.db, id)).items;
    assert.ok(items.includes('stack-rank-safety-helmet'));
    assert.ok(items.includes('stack-rank-crown'));
  }
  assert.equal(
    (await readInventory(f.db, late)).items.includes(
      'stack-rank-safety-helmet',
    ),
    false,
  );
  const count = (
    f.native
      .prepare(
        "SELECT COUNT(*) AS n FROM commerce_grants WHERE reference LIKE '%:crew:%'",
      )
      .get() as { n: number }
  ).n;
  assert.equal(count, 22);
  await readRankedStack(f.db, f.users[0], after + 1000);
  assert.equal(
    (
      f.native
        .prepare(
          "SELECT COUNT(*) AS n FROM commerce_grants WHERE reference LIKE '%:crew:%'",
        )
        .get() as { n: number }
    ).n,
    count,
  );
});
