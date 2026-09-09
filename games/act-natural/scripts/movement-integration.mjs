import assert from 'node:assert/strict';
const origin = process.env.GAME_TEST_URL || 'http://127.0.0.1:3027';
const sessions = [];
async function request(body) {
  const response = await fetch(`${origin}/api/act-natural`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const reply = await response.json();
  assert.equal(response.status, 200, reply.error);
  return reply;
}
try {
  const created = await request({
    op: 'create',
    name: 'Movement check',
    mode: 'human',
  });
  const session = created.session;
  sessions.push(session);
  const act = (type) =>
    request({
      op: 'action',
      ...session,
      requestId: crypto.randomUUID(),
      action: { type },
    });
  await act('add-bot');
  let state = await act('start');
  assert.equal(state.snapshot.you.role, 'farmer');
  const start = { ...state.snapshot.world.farmer };
  const sync = (inputSequence, x, z) =>
    request({
      op: 'sync',
      ...session,
      inputSequence,
      input: { x, z, graze: false },
    });
  await sync(1, 1, 0);
  for (let i = 0; i < 8; i++) {
    await new Promise((resolve) => setTimeout(resolve, 60));
    state = await sync(1, 1, 0);
    assert.equal(state.snapshot.you.motion.sequence, 1);
    assert.ok(
      state.snapshot.world.players.every(
        (p) => !('input' in p) && !('inputSequence' in p),
      ),
    );
    assert.equal('botBrains' in state.snapshot.world, false);
  }
  assert.ok(state.snapshot.world.farmer.x - start.x > 1);
  const stopped = await sync(3, 0, 0);
  const stale = await sync(2, -1, 0);
  assert.deepEqual(stale.snapshot.you.motion, { sequence: 3, x: 0, z: 0 });
  await new Promise((resolve) => setTimeout(resolve, 220));
  const settled = await sync(3, 0, 0);
  assert.equal(
    settled.snapshot.world.farmer.x,
    stopped.snapshot.world.farmer.x,
  );
  assert.equal(
    settled.snapshot.world.farmer.z,
    stopped.snapshot.world.farmer.z,
  );
  await sync(4, 0, -1);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const turned = await sync(5, 0, 0);
  assert.ok(turned.snapshot.world.farmer.z < settled.snapshot.world.farmer.z);
  assert.ok(
    Math.abs(Math.abs(turned.snapshot.world.farmer.angle) - Math.PI) < 0.001,
  );
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        origin,
        checks: [
          'farmer movement',
          'own-control acknowledgement',
          'out-of-order input rejected',
          'released controls stay stopped',
          'direction change',
          'NPC and hidden-control privacy',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  for (const session of sessions)
    await request({ op: 'leave', ...session }).catch(() => {});
}
