import assert from 'node:assert/strict';
const origin = process.env.GAME_TEST_URL || 'http://localhost:3001';
async function request(body) {
  const res = await fetch(`${origin}/api/act-natural`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
  const reply = await res.json();
  assert.equal(res.status, 200, reply.error);
  return reply;
}
const sessions = [];
try {
  const first = await request({
    op: 'create',
    name: 'Farmer test',
    mode: 'human',
  });
  sessions.push(first.session);
  for (let i = 1; i < 4; i++) {
    const r = await request({
      op: 'join',
      code: first.session.code,
      name: `Cow test ${i}`,
    });
    sessions.push(r.session);
  }
  await request({
    op: 'action',
    ...sessions[0],
    requestId: crypto.randomUUID(),
    action: { type: 'start' },
  });
  const snapshots = await Promise.all(
    sessions.map((s) =>
      request({ op: 'sync', ...s, input: { x: 0, z: 0, graze: true } }),
    ),
  );
  assert.deepEqual(
    snapshots.map((r) => r.snapshot.you.role),
    ['farmer', 'cow', 'cow', 'cow'],
  );
  assert.equal(
    new Set(snapshots.slice(1).map((r) => r.snapshot.you.cowId)).size,
    3,
  );
  for (const r of snapshots) {
    if (r.snapshot.you.role === 'cow')
      assert.equal(r.snapshot.world.cows.length, 18);
    else
      assert.ok(
        r.snapshot.world.cows.length < 18,
        'farmer only receives visible cows',
      );
    assert.equal(r.snapshot.world.phase, 'playing');
    assert.equal(r.snapshot.world.players.length, 4);
    assert.equal('seed' in r.snapshot.world, false);
    assert.equal('cowRoutines' in r.snapshot.world, false);
    assert.equal('members' in r.snapshot, false);
    assert.ok(r.snapshot.world.players.every((p) => !('cowId' in p)));
  }
  const farmer = snapshots[0].snapshot;
  assert.equal(farmer.you.cowId, null);
  assert.equal(farmer.world.inspections, 5);
  const playerCows = new Set(
    snapshots.map((r) => r.snapshot.you.cowId).filter(Boolean),
  );
  let sawMixedHerd = false;
  for (let attempt = 0; attempt < 16; attempt++) {
    const reply = await request({
      op: 'sync',
      ...sessions[1],
      input: { x: 0, z: 0, graze: false },
    });
    const animals = reply.snapshot.world.cows.filter(
      (c) => !playerCows.has(c.id),
    );
    const walking = animals.filter((c) => c.moving);
    if (
      animals.some((c) => c.grazing) &&
      walking.some((a) =>
        walking.some((b) => Math.cos(a.angle - b.angle) < 0.2),
      )
    ) {
      sawMixedHerd = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(
    sawMixedHerd,
    'the live herd should graze and wander in different directions together',
  );
  const bad = await fetch(`${origin}/api/act-natural`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({
      op: 'sync',
      ...sessions[0],
      token: 'invalid-token',
    }),
  });
  assert.equal(bad.status, 401);
  for (const route of [
    '/',
    '/stack-or-sink',
    '/act-natural',
    '/images/stack-or-sink.png',
    '/images/blend-business.png',
  ]) {
    const r = await fetch(`${origin}${route}`);
    assert.equal(r.status, 200, route);
  }
  const legacy = await fetch(`${origin}/?room=${first.session.code}`, {
    redirect: 'manual',
  });
  assert.ok([302, 303, 307, 308].includes(legacy.status));
  assert.equal(
    legacy.headers.get('location'),
    `/stack-or-sink?room=${first.session.code}`,
  );
  const cooperative = await request({
    op: 'create',
    name: 'Cooperative host',
    mode: 'computer',
  });
  const cowSessions = [cooperative.session];
  sessions.push(cooperative.session);
  assert.equal(cooperative.session.peer, undefined);
  for (let i = 1; i < 4; i++) {
    const joined = await request({
      op: 'join',
      code: cooperative.session.code,
      name: `Cooperative cow ${i}`,
    });
    cowSessions.push(joined.session);
    sessions.push(joined.session);
  }
  const coopStart = await request({
    op: 'action',
    ...cowSessions[0],
    requestId: crypto.randomUUID(),
    action: { type: 'start' },
  });
  const coopViews = await Promise.all(
    cowSessions.map((session) => request({ op: 'sync', ...session })),
  );
  assert.ok(
    coopViews.every(
      (reply) =>
        reply.snapshot.you.role === 'cow' &&
        reply.snapshot.world.mode === 'computer',
    ),
  );
  assert.equal(
    new Set(coopViews.map((reply) => reply.snapshot.you.cowId)).size,
    4,
  );
  await new Promise((resolve) => setTimeout(resolve, 200));
  const patrol = await request({ op: 'sync', ...cowSessions[0] });
  assert.notDeepEqual(
    patrol.snapshot.world.farmer,
    coopStart.snapshot.world.farmer,
    'computer patrol advances in a multiplayer room',
  );
  console.log(
    'PASS: collection, routes, four-player human hunt with restricted vision, four-player cooperative escape with computer patrol, private roles, independent herd movement, and authentication.',
  );
} finally {
  await Promise.all(
    sessions.map((s) => request({ op: 'leave', ...s }).catch(() => {})),
  );
}
