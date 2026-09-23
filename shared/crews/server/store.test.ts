import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateSqlite, openSqlite } from '../../../db/sqlite.mjs';
import { sqliteAdapter } from '../../../db/node';
import { createAccount } from '../../accounts/server/store';
import { startSession } from '../../accounts/server/session';
import { createCrewRoutes } from './routes';
import { readCrewRecords } from './records';
import {
  changeCrew,
  createCrew,
  INVITE_TTL,
  joinCrew,
  readCrew,
} from './store';

const NOW = 1790070000000;
async function fixture(t: { after: (f: () => void) => void }) {
  const native = openSqlite(':memory:');
  t.after(() => native.close());
  migrateSqlite(native);
  migrateSqlite(native);
  const db = sqliteAdapter(native);
  const users = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      createAccount(
        db,
        [
          {
            provider: 'email',
            subject: `person-${i}`,
            hint: 'private-email-hint',
          },
        ],
        NOW,
      ),
    ),
  );
  await createCrew(db, users[0], 'Wobbly Legends', 'rocket', NOW);
  const crew = (await readCrew(db, users[0]))!;
  const invite = (await changeCrew(
    db,
    users[0],
    { op: 'invite', crewId: crew.id },
    NOW,
  ))!;
  return { native, db, users, crew, invite };
}

void test('concurrent joins never exceed eight members or give one account two crews', async (t) => {
  const { db, users, invite, native } = await fixture(t);
  const result = await Promise.allSettled(
    users.slice(1).map((id) => joinCrew(db, id, invite.code, NOW)),
  );
  assert.equal(result.filter((r) => r.status === 'fulfilled').length, 7);
  assert.equal((await readCrew(db, users[0]))!.members.length, 8);
  await joinCrew(db, users[1], invite.code, NOW);
  await assert.rejects(
    createCrew(db, users[1], 'Another Crew', 'sun', NOW),
    /Leave your current crew/,
  );
  assert.equal(
    (native.prepare('SELECT count(*) AS n FROM crews').get() as { n: number })
      .n,
    1,
  );
});

void test('crew shelf counts only complete verified roster results', async (t) => {
  const { db, users, crew, invite, native } = await fixture(t);
  assert.deepEqual(await readCrewRecords(db, crew.id), {
    rankedRuns: 0,
    bestTowerCm: 0,
    towerAce: 0,
    skylineCrown: 0,
  });
  await joinCrew(db, users[1], invite.code, NOW);
  native
    .prepare(
      'INSERT INTO ranked_crew_runs (run_id,crew_id,week,team_size) VALUES (?,?,?,2)',
    )
    .run('complete-run', crew.id, NOW);
  const insert = native.prepare(`INSERT INTO ranked_attempts
    (account_id,run_id,week,room_code,player_id,team_size,started,eligible,height_cm,completed)
    VALUES (?,?,?,?,?,2,?,1,?,?)`);
  insert.run(
    users[0],
    'complete-run',
    NOW,
    'room-a',
    'player-a',
    NOW,
    420,
    NOW,
  );
  insert.run(
    users[1],
    'complete-run',
    NOW,
    'room-a',
    'player-b',
    NOW,
    420,
    NOW,
  );
  native
    .prepare(
      'INSERT INTO ranked_crew_runs (run_id,crew_id,week,team_size) VALUES (?,?,?,2)',
    )
    .run('incomplete-run', crew.id, NOW);
  insert.run(
    users[0],
    'incomplete-run',
    NOW,
    'room-b',
    'player-a',
    NOW,
    900,
    NOW,
  );
  assert.deepEqual(await readCrewRecords(db, crew.id), {
    rankedRuns: 1,
    bestTowerCm: 420,
    towerAce: 0,
    skylineCrown: 0,
  });
});

void test('crew creation races are atomic without abandoned duplicate crews', async (t) => {
  const { db, native, users } = await fixture(t);
  const results = await Promise.allSettled([
    createCrew(db, users[1], 'First crew', 'sun', NOW),
    createCrew(db, users[1], 'Second crew', 'star', NOW),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    (native.prepare('SELECT count(*) AS n FROM crews').get() as { n: number })
      .n,
    2,
  );
});

void test('codes are hashed, expire and rotate; membership never leaks account identities', async (t) => {
  const { db, native, users, crew, invite } = await fixture(t);
  const raw = native.prepare('SELECT * FROM crews').get();
  assert.ok(!JSON.stringify(raw).includes(invite.code.replaceAll('-', '')));
  await assert.rejects(
    joinCrew(db, users[1], invite.code, NOW + INVITE_TTL),
    /expired/,
  );
  const next = (await changeCrew(
    db,
    users[0],
    { op: 'invite', crewId: crew.id },
    NOW + 1,
  ))!;
  await assert.rejects(joinCrew(db, users[1], invite.code, NOW + 2), /expired/);
  await joinCrew(db, users[1], next.code.toLowerCase(), NOW + 2);
  const snapshot = JSON.stringify(await readCrew(db, users[0]));
  for (const accountId of users) assert.ok(!snapshot.includes(accountId));
  assert.ok(!snapshot.includes('private-email-hint'));
  assert.ok(!snapshot.includes('invite_hash'));
});

void test('only leaders may edit, remove or transfer; removal revokes old invitations', async (t) => {
  const { db, users, crew, invite } = await fixture(t);
  await joinCrew(db, users[1], invite.code, NOW + 1);
  const member = (await readCrew(db, users[1]))!.self;
  for (const op of ['edit', 'invite', 'remove', 'transfer'])
    await assert.rejects(
      changeCrew(
        db,
        users[1],
        {
          op,
          crewId: crew.id,
          name: 'Bad edit',
          emblem: 'sun',
          memberId: crew.self,
        },
        NOW,
      ),
      /Only the crew leader/,
    );
  await assert.rejects(
    changeCrew(
      db,
      users[0],
      { op: 'transfer', crewId: crew.id, memberId: 'foreign-member' },
      NOW,
    ),
    /crew changed/,
  );
  await changeCrew(
    db,
    users[0],
    { op: 'remove', crewId: crew.id, memberId: member },
    NOW,
  );
  assert.equal(await readCrew(db, users[1]), null);
  await assert.rejects(joinCrew(db, users[1], invite.code, NOW + 2), /expired/);
});

void test('leadership transfer is persistent and account deletion promotes the oldest remaining member', async (t) => {
  const { db, native, users, crew, invite } = await fixture(t);
  await joinCrew(db, users[1], invite.code, NOW + 1);
  await joinCrew(db, users[2], invite.code, NOW + 2);
  const second = (await readCrew(db, users[1]))!;
  await changeCrew(
    db,
    users[0],
    { op: 'transfer', crewId: crew.id, memberId: second.self },
    NOW + 3,
  );
  assert.equal((await readCrew(db, users[0]))!.owner, second.self);
  await assert.rejects(
    changeCrew(
      db,
      users[0],
      { op: 'edit', crewId: crew.id, name: 'Not mine', emblem: 'sun' },
      NOW,
    ),
    /Only the crew leader/,
  );
  native.prepare('DELETE FROM accounts WHERE id = ?').run(users[1]);
  assert.equal((await readCrew(db, users[0]))!.owner, crew.self);
  await changeCrew(db, users[0], { op: 'leave', crewId: crew.id }, NOW);
  const last = (await readCrew(db, users[2]))!;
  assert.equal(last.owner, last.self);
  await changeCrew(db, users[2], { op: 'leave', crewId: crew.id }, NOW);
  assert.equal(await readCrew(db, users[2]), null);
  const archived = native
    .prepare('SELECT archived, owner_member_id, invite_hash FROM crews')
    .get() as {
    archived: number;
    owner_member_id: string | null;
    invite_hash: string | null;
  };
  assert.ok(archived.archived);
  assert.equal(archived.owner_member_id, null);
  assert.equal(archived.invite_hash, null);
});

void test('crew writes require origin, session and current account scope', async (t) => {
  const { db, users } = await fixture(t);
  const config = { publicOrigin: 'http://localhost:3000' };
  const cookie = (
    await startSession(new Request(config.publicOrigin), users[0], {
      db,
      config,
      now: NOW,
    })
  )
    .map((v) => v.split(';')[0])
    .join('; ');
  const routes = createCrewRoutes({
    db: () => db,
    config: () => config,
    now: () => NOW,
  });
  const request = (body?: object, origin = config.publicOrigin) =>
    new Request(`${config.publicOrigin}/api/account/crew`, {
      method: body ? 'POST' : 'GET',
      headers: { cookie, origin, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal(
    (await routes.GET(new Request(config.publicOrigin))).status,
    401,
  );
  const result = await routes.GET(request());
  assert.equal(result.headers.get('cache-control'), 'no-store');
  const { ownerKey, crew } = await result.json();
  const body = {
    op: 'edit',
    crewId: crew.id,
    name: 'New Name',
    emblem: 'sun',
    ownerKey,
  };
  assert.equal(
    (await routes.POST(request(body, 'https://elsewhere.example'))).status,
    403,
  );
  assert.equal(
    (await routes.POST(request({ ...body, ownerKey: 'another-account' })))
      .status,
    409,
  );
  assert.equal(
    (await routes.POST(request({ ...body, accountId: users[1] }))).status,
    200,
  );
  assert.equal((await readCrew(db, users[0]))!.name, 'New Name');
  assert.equal(await readCrew(db, users[1]), null);
});
