import assert from 'node:assert/strict';
const origin = process.env.GAME_TEST_URL || 'http://localhost:3002';
async function request(body, expected = 200) {
  const res = await fetch(`${origin}/api/uphill-delivery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
  const result = await res.json();
  assert.equal(res.status, expected, result.error);
  return result;
}
const sessions = [];
try {
  const landing = await fetch(origin);
  assert.equal(landing.status, 200);
  const html = await landing.text();
  for (const game of ['stack-or-sink', 'act-natural', 'uphill-delivery'])
    assert.ok(html.includes(`href="/${game}"`), `${game} card missing`);
  for (const path of [
    '/uphill-delivery',
    '/uphill-delivery/admin',
    '/images/uphill-delivery.png',
    '/stack-or-sink',
    '/act-natural',
  ])
    assert.equal((await fetch(origin + path)).status, 200, path);
  const first = await request({ op: 'create', name: 'Delivery lead' });
  sessions.push(first.session);
  const joins = await Promise.all(
    [1, 2, 3].map((i) =>
      request({ op: 'join', code: first.session.code, name: `Mover ${i}` }),
    ),
  );
  sessions.push(...joins.map((r) => r.session));
  await request(
    { op: 'join', code: first.session.code, name: 'Fifth mover' },
    409,
  );
  await request({ op: 'sync', ...sessions[0], token: 'invalid-pass' }, 401);
  await request(
    {
      op: 'action',
      ...sessions[1],
      action: { type: 'start' },
      requestId: crypto.randomUUID(),
    },
    400,
  );
  await request({
    op: 'action',
    ...sessions[0],
    action: { type: 'start' },
    requestId: crypto.randomUUID(),
  });
  await Promise.all(
    sessions.map((s) =>
      request({
        op: 'action',
        ...s,
        action: { type: 'grab' },
        requestId: crypto.randomUUID(),
      }),
    ),
  );
  const together = await request({ op: 'sync', ...sessions[0] });
  assert.equal(
    together.snapshot.world.players.filter((p) => p.grip !== null).length,
    4,
  );
  const originalX = together.snapshot.world.sofa.x;
  for (let step = 1; step <= 18; step++) {
    const replies = await Promise.all(
      sessions.map((s) =>
        request({
          op: 'sync',
          ...s,
          input: { x: 1, z: 0, jump: false, seq: step },
        }),
      ),
    );
    for (const r of replies) {
      assert.equal(r.snapshot.world.phase, 'playing');
      assert.equal(r.snapshot.world.players.length, 4);
      assert.ok(Number.isFinite(r.snapshot.world.sofa.y));
      assert.ok(!JSON.stringify(r.snapshot).includes(sessions[0].token));
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  await Promise.all(
    sessions.map((s) =>
      request({
        op: 'sync',
        ...s,
        input: { x: 0, z: 0, jump: false, seq: 100 },
      }),
    ),
  );
  const carried = await request({ op: 'sync', ...sessions[0] });
  assert.ok(
    carried.snapshot.world.sofa.x > originalX + 0.5,
    'the shared sofa should move with the crew',
  );
  const releasing = {
    op: 'action',
    ...sessions[0],
    action: { type: 'release' },
    requestId: crypto.randomUUID(),
  };
  await request(releasing);
  await request(releasing);
  const shared = await Promise.all(
    sessions.map((s) => request({ op: 'sync', ...s })),
  );
  for (const r of shared) {
    assert.equal(
      r.snapshot.world.players.find((p) => p.id === sessions[0].id).grip,
      null,
    );
    assert.equal(
      r.snapshot.you,
      r.snapshot.world.players.find((p) => p.id === r.snapshot.you).id,
    );
  }
  console.log(
    'PASS: three landing cards, routes, artwork, four concurrent clients, shared carrying, release replay, capacity and authentication.',
  );
} finally {
  await Promise.allSettled(sessions.map((s) => request({ op: 'leave', ...s })));
}
