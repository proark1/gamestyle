import test from 'node:test';
import assert from 'node:assert/strict';
import { openSqlite, migrateSqlite } from '../../db/sqlite.mjs';
import { sqliteAdapter } from '../../db/node';
import { createAccount } from '../../shared/accounts/server/store';
import { startSession } from '../../shared/accounts/server/session';
import {
  initializeInventory,
  readInventory,
} from '../../shared/commerce/server/inventory';
import { readStackProgress } from '../../shared/challenges/server/progress';
import { stackWeek } from '../../shared/challenges/catalog';
import { verifiedStackRoom, settledStackHeight } from './challenge-server';
import { freshWorld } from './simulation';
import { createStackChallengeRoutes } from './challenge-route';
import type { StoredRoom } from './rooms';
import type { Session } from '../../shared/rooms/session';

const NOW = Date.UTC(2026, 8, 22, 10);
async function fixture(t: { after: (f: () => void) => void }, at = NOW) {
  const native = openSqlite(':memory:');
  t.after(() => native.close());
  migrateSqlite(native);
  const db = sqliteAdapter(native);
  const users = await Promise.all(
    [0, 1, 2].map((i) =>
      createAccount(
        db,
        [{ provider: 'email', subject: `challenge-${i}`, hint: 'private' }],
        NOW,
      ),
    ),
  );
  for (const id of users) await initializeInventory(db, id, NOW);
  const call = (user: number, body: Record<string, unknown>, now = at) =>
    verifiedStackRoom(db, users[user], body, now);
  const host = (await call(0, { op: 'create', name: 'Mika' })).session!;
  const guest = (await call(1, { op: 'join', code: host.code, name: 'Jules' }))
    .session!;
  const start = (now = NOW) =>
    call(
      0,
      { op: 'action', ...host, action: { type: 'start' }, requestId: 'start' },
      now,
    );
  const sync = (user: number, seat: Session, now = NOW) =>
    call(user, { op: 'sync', ...seat }, now);
  // Trusted server-state fixture only: no API accepts this world or a submitted score.
  const terminal = (height = 6, won = false) => {
    const row = native
      .prepare('SELECT state FROM rooms WHERE code = ?')
      .get(`verified-stack:${host.code}`) as { state: string };
    const room = JSON.parse(row.state) as StoredRoom;
    room.world.phase = won ? 'won' : 'lost';
    room.world.bestHeight = height;
    Object.assign(room, { challengeHeight: height });
    native
      .prepare('UPDATE rooms SET state = ? WHERE code = ?')
      .run(JSON.stringify(room), `verified-stack:${host.code}`);
  };
  return { native, db, users, call, host, guest, start, sync, terminal };
}
void test('verified rooms bind every seat to its signed-in account and hide identifiers', async (t) => {
  const f = await fixture(t);
  assert.equal(f.host.verified, true);
  await assert.rejects(f.sync(1, f.host), /account that joined/);
  await assert.rejects(f.sync(0, { ...f.host, token: 'forged' }), /expired/);
  await assert.rejects(
    f.call(0, { op: 'join', code: f.host.code }),
    /already have a seat/,
  );
  const reply = await f.sync(0, f.host);
  for (const id of f.users) assert.ok(!JSON.stringify(reply).includes(id));
  await f.start();
  await assert.rejects(
    f.call(2, { op: 'join', code: f.host.code }),
    /before its round/,
  );
  await assert.rejects(
    f.call(0, {
      op: 'action',
      ...f.host,
      action: { type: 'restart' },
      requestId: 'restart',
    }),
    /new verified attempt/,
  );
});
void test('browser scores, worlds, clocks and account IDs cannot grant mastery', async (t) => {
  const f = await fixture(t);
  await f.start();
  await f.call(0, {
    op: 'sync',
    ...f.host,
    accountId: f.users[1],
    now: NOW + 1e9,
    result: { won: true, height: 1000 },
    world: { phase: 'won', bestHeight: 1000 },
  });
  assert.equal((await readInventory(f.db, f.users[0])).coins, 500);
  assert.equal((await readStackProgress(f.db, f.users[0], NOW)).bestHeight, 0);
  assert.equal((await f.sync(0, f.host)).snapshot?.world.phase, 'playing');
});
void test('concurrent terminal sync and retries pay each milestone and week exactly once to both participants', async (t) => {
  const f = await fixture(t);
  await f.start();
  f.terminal(6, true);
  await Promise.all([f.sync(0, f.host), f.sync(1, f.guest), f.sync(0, f.host)]);
  await f.sync(1, f.guest);
  for (const user of [0, 1]) {
    assert.equal((await readInventory(f.db, f.users[user])).coins, 950);
    const progress = await readStackProgress(f.db, f.users[user], NOW);
    assert.deepEqual(progress.milestones, ['bronze', 'silver', 'gold']);
    assert.equal(progress.weeklyComplete, true);
  }
  assert.equal(
    (
      f.native.prepare('SELECT count(*) AS n FROM challenge_results').get() as {
        n: number;
      }
    ).n,
    2,
  );
});
void test('failed reward writes roll back the room version and every result; a retry settles once', async (t) => {
  const f = await fixture(t);
  await f.start();
  f.terminal();
  const before = f.native
    .prepare('SELECT version FROM rooms WHERE code = ?')
    .get(`verified-stack:${f.host.code}`);
  f.native.exec(
    "CREATE TRIGGER fail_challenge_reward BEFORE INSERT ON commerce_coin_ledger WHEN NEW.reference LIKE 'mastery:%' BEGIN SELECT RAISE(ABORT, 'test rollback'); END",
  );
  await assert.rejects(f.sync(0, f.host), /test rollback/);
  assert.deepEqual(
    f.native
      .prepare('SELECT version FROM rooms WHERE code = ?')
      .get(`verified-stack:${f.host.code}`),
    before,
  );
  assert.equal(
    (
      f.native.prepare('SELECT count(*) AS n FROM challenge_results').get() as {
        n: number;
      }
    ).n,
    0,
  );
  f.native.exec('DROP TRIGGER fail_challenge_reward');
  await f.sync(0, f.host);
  assert.equal((await readInventory(f.db, f.users[0])).coins, 750);
});
void test('leaving removes eligibility and deleting an account removes memberships and results', async (t) => {
  const f = await fixture(t);
  await f.start();
  await f.call(1, { op: 'leave', ...f.guest });
  f.terminal();
  await f.sync(0, f.host);
  assert.equal((await readInventory(f.db, f.users[1])).coins, 500);
  f.native.prepare('DELETE FROM accounts WHERE id = ?').run(f.users[0]);
  assert.equal(
    (
      f.native.prepare('SELECT count(*) AS n FROM challenge_members').get() as {
        n: number;
      }
    ).n,
    0,
  );
  assert.equal(
    (
      f.native.prepare('SELECT count(*) AS n FROM challenge_results').get() as {
        n: number;
      }
    ).n,
    0,
  );
});
void test('Monday rollover freezes the starting target and later runs cannot repay permanent mastery', async (t) => {
  const monday = stackWeek(NOW).end;
  const f = await fixture(t, monday - 1000);
  await f.start(monday - 1000);
  f.terminal(6);
  const reply = await f.sync(0, f.host, monday + 1000);
  assert.equal(reply.snapshot?.challenge?.week.start, monday - 7 * 86400000);
  assert.equal(
    (await readStackProgress(f.db, f.users[0], monday + 1000)).weeklyComplete,
    false,
  );
  const next = (await f.call(0, { op: 'create' }, monday + 2000)).session!;
  await f.call(
    0,
    { op: 'action', ...next, action: { type: 'start' }, requestId: 'start' },
    monday + 2000,
  );
  const row = f.native
    .prepare('SELECT state FROM rooms WHERE code = ?')
    .get(`verified-stack:${next.code}`) as { state: string };
  const room = JSON.parse(row.state);
  room.world.phase = 'lost';
  room.world.bestHeight = 6;
  room.challengeHeight = 6;
  f.native
    .prepare('UPDATE rooms SET state = ? WHERE code = ?')
    .run(JSON.stringify(room), `verified-stack:${next.code}`);
  await f.sync(0, next, monday + 2000);
  assert.equal((await readInventory(f.db, f.users[0])).coins, 850);
  assert.equal(
    (await readStackProgress(f.db, f.users[0], monday + 2000)).weeklyComplete,
    true,
  );
  assert.deepEqual(
    [0, 1, 2, 3, 4].map(
      (i) => stackWeek(stackWeek(NOW).start + i * 7 * 86400000).height,
    ),
    [3, 4, 5, 6, 3],
  );
});
void test('real server simulation can finish a round; its outcome ignores the submitted win', async (t) => {
  const f = await fixture(t);
  await f.start();
  // Repeated real server ticks submerge the idle players. There is no finish endpoint.
  let reply = await f.sync(0, f.host);
  for (
    let elapsed = 1000;
    elapsed <= 240000 && reply.snapshot?.world.phase === 'playing';
    elapsed += 1000
  ) {
    await f.sync(1, f.guest, NOW + elapsed);
    reply = await f.call(
      0,
      { op: 'sync', ...f.host, result: { outcome: 'won' } },
      NOW + elapsed,
    );
  }
  assert.equal(reply.snapshot?.world.phase, 'lost');
  assert.equal(
    (await readStackProgress(f.db, f.users[0], NOW)).milestones.includes(
      'gold',
    ),
    false,
  );
});

void test('only resting cargo counts toward verified tower height, never a held load or an airborne apex', () => {
  const world = freshWorld(NOW);
  world.bestHeight = 99;
  const piece = world.pieces[0];
  world.pieces = [piece];
  piece.y = 6;
  piece.vy = 0;
  piece.sleeping = false;
  assert.equal(settledStackHeight(world), 0);
  piece.sleeping = true;
  piece.heldBy = 'crane';
  assert.equal(settledStackHeight(world), 0);
  delete piece.heldBy;
  assert.ok(settledStackHeight(world) > 6);
});
void test('challenge API requires sign-in and allowed origin and ignores body account identity', async (t) => {
  const f = await fixture(t);
  const origin = 'https://game.example';
  const routes = createStackChallengeRoutes({
    db: () => f.db,
    config: () => ({ publicOrigin: origin }),
    now: () => NOW,
  });
  assert.equal((await routes.GET(new Request(origin))).status, 401);
  const cookies = (
    await startSession(new Request(origin), f.users[0], {
      db: f.db,
      config: { publicOrigin: origin },
      now: NOW,
    })
  )
    .map((c) => c.split(';')[0])
    .join('; ');
  const post = (from: string, body: object) =>
    routes.POST(
      new Request(origin, {
        method: 'POST',
        headers: {
          origin: from,
          cookie: cookies,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );
  assert.equal(
    (await post('https://evil.example', { op: 'create' })).status,
    403,
  );
  const response = await post(origin, {
    op: 'sync',
    ...f.guest,
    accountId: f.users[1],
  });
  assert.equal(response.status, 401);
});
