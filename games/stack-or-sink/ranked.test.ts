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
import { stackWeek } from '../../shared/challenges/catalog';
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
  const create = async () =>
    (await call(0, { op: 'create', ranked: true })).session!;
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
