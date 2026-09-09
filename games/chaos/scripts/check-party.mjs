import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:3001';
async function request(body, path = '/api/handwerker/rooms') {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
const created = await request({
  op: 'create',
  name: 'Crew test host',
  mode: 'job',
  map: 'small',
});
assert.equal(created.status, 200, JSON.stringify(created.data));
const sessions = [created.data.session];
let snapshot = created.data.snapshot;
try {
  for (let i = 1; i < 4; i++) {
    const joined = await request({
      op: 'join',
      code: sessions[0].code,
      name: `Crew test ${i}`,
    });
    assert.equal(joined.status, 200);
    sessions.push(joined.data.session);
  }
  const seq = [0, 0, 0, 0];
  const action = (index, action, extra = {}) =>
    request({
      op: 'action',
      ...sessions[index],
      roundId: snapshot.world.party.roundId,
      seq: ++seq[index],
      actionId: crypto.randomUUID(),
      action,
      ...extra,
    });
  const denied = await action(1, { type: 'party', op: 'start' });
  assert.equal(denied.status, 400);
  const started = await action(0, { type: 'party', op: 'start' });
  assert.equal(started.status, 200, JSON.stringify(started.data));
  snapshot = started.data.snapshot;
  const peers = await Promise.all(
    sessions.map((session) => request({ op: 'sync', ...session })),
  );
  assert.equal(
    new Set(peers.map((p) => p.data.snapshot.world.party.roundId)).size,
    1,
  );
  for (const [i, res] of peers.entries()) {
    assert.equal(res.data.snapshot.world.partyPrivate, undefined);
    assert.equal(res.data.snapshot.mission.owner, sessions[i].id);
  }
  const command = {
    op: 'action',
    ...sessions[0],
    roundId: snapshot.world.party.roundId,
    seq: ++seq[0],
    actionId: crypto.randomUUID(),
    action: { type: 'party', op: 'consent', enabled: true },
  };
  const once = await request(command),
    twice = await request(command);
  assert.equal(once.status, 200);
  assert.equal(twice.status, 200);
  assert.deepEqual(
    once.data.snapshot.world.party.audioConsent,
    twice.data.snapshot.world.party.audioConsent,
  );
  const grants = await request(
    { ...sessions[0], token: 'invalid' },
    '/api/handwerker/voice/token',
  );
  assert.equal(grants.status, 401);
  const handle = await action(
    0,
    { type: 'party', op: 'role', role: 0 },
    { position: { x: 4.6, z: 7.15, angle: 0 } },
  );
  assert.equal(handle.status, 200, JSON.stringify(handle.data));
  const occupied = await action(
    1,
    { type: 'party', op: 'role', role: 0 },
    { position: { x: 4.6, z: 7.15, angle: 0 } },
  );
  assert.equal(occupied.status, 400);
  const partner = await action(
    1,
    { type: 'party', op: 'role', role: 1 },
    { position: { x: 1.6, z: 7.15, angle: 0 } },
  );
  assert.equal(partner.status, 200, JSON.stringify(partner.data));
  const moves = await Promise.all([
    action(0, { type: 'party', op: 'drive', x: -1, z: 0, turn: 0 }),
    action(1, { type: 'party', op: 'drive', x: -1, z: 0, turn: 0 }),
  ]);
  for (const move of moves)
    assert.equal(move.status, 200, JSON.stringify(move.data));
  const reset = await action(0, { type: 'reset', mode: 'job' });
  assert.equal(reset.status, 200);
  assert.equal(reset.data.snapshot.world.party.phase, 'lobby');
  const stale = await request(command);
  assert.equal(stale.status, 409);
  console.log(
    JSON.stringify({
      players: 4,
      privacy: 'passed',
      hostStart: 'passed',
      idempotency: 'passed',
      roles: 'passed',
      concurrentMovement: 'passed',
      staleRound: 'passed',
      voiceAuthorization: 'passed',
    }),
  );
} finally {
  for (const session of sessions) await request({ op: 'leave', ...session });
}
