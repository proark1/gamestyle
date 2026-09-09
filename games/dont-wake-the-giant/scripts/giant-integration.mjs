import assert from 'node:assert/strict';
const origin = process.env.GAME_TEST_URL || 'http://localhost:3003';
async function request(body, expected = 200, source = origin) {
  const res = await fetch(`${origin}/api/dont-wake-the-giant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: source },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  assert.equal(res.status, expected, raw.slice(0, 200));
  try {
    return JSON.parse(raw);
  } catch {
    if (expected === 200) throw new Error('Expected a JSON room response.');
    return { error: raw };
  }
}
const sessions = [];
try {
  const html = await (await fetch(origin)).text();
  for (const game of [
    'stack-or-sink',
    'act-natural',
    'uphill-delivery',
    'dont-wake-the-giant',
  ]) {
    assert.ok(
      html.includes(`href="/${game}"`),
      `${game} collection link missing`,
    );
    assert.equal(
      (await fetch(`${origin}/${game}`)).status,
      200,
      `${game} route failed`,
    );
  }
  assert.equal(
    (await fetch(`${origin}/images/tiptoe-thieves.png`)).status,
    200,
  );
  const first = await request({ op: 'create', name: 'Tiny lead' });
  sessions.push(first.session);
  assert.equal(
    first.snapshot.world.items.filter((item) => item.value > 0).length,
    22,
  );
  assert.equal(
    first.snapshot.world.items.find((item) => item.id === 'crown')?.value,
    100,
  );
  const others = await Promise.all(
    [1, 2, 3].map((i) =>
      request({ op: 'join', code: first.session.code, name: `Tiny ${i}` }),
    ),
  );
  sessions.push(...others.map((r) => r.session));
  await request(
    { op: 'join', code: first.session.code, name: 'Fifth thief' },
    409,
  );
  await request({ op: 'sync', ...sessions[0], token: 'forged' }, 401);
  await request(
    { op: 'sync', ...sessions[0] },
    403,
    'https://unrelated.example',
  );
  await request(
    {
      op: 'action',
      ...sessions[1],
      action: { type: 'start' },
      requestId: 'not-host',
    },
    400,
  );
  const start = {
    op: 'action',
    ...sessions[0],
    action: { type: 'start' },
    requestId: 'start',
  };
  const begun = await request(start),
    repeated = await request(start);
  assert.equal(begun.snapshot.world.started, repeated.snapshot.world.started);
  await request(
    { op: 'join', code: first.session.code, name: 'Late thief' },
    409,
  );
  const replies = await Promise.all(
    sessions.map((s) =>
      request({
        op: 'sync',
        ...s,
        input: { x: 0, z: 0, jump: false, crouch: false, seq: 1 },
      }),
    ),
  );
  for (const r of replies) {
    assert.equal(r.snapshot.world.players.length, 4);
    assert.equal(r.snapshot.world.phase, 'playing');
    for (const s of sessions)
      assert.ok(!JSON.stringify(r.snapshot).includes(s.token));
  }
  let seq = 10;
  async function walk(x, z, player = 0) {
    let state = await request({ op: 'sync', ...sessions[player] });
    for (let n = 0; n < 100; n++) {
      const p = state.snapshot.world.players.find(
          (p) => p.id === sessions[player].id,
        ),
        dx = x - p.x,
        dz = z - p.z,
        d = Math.hypot(dx, dz);
      if (d < 0.16)
        return request({
          op: 'sync',
          ...sessions[player],
          input: { x: 0, z: 0, jump: false, crouch: true, seq: ++seq },
        });
      state = await request({
        op: 'sync',
        ...sessions[player],
        input: {
          x: dx / Math.max(d, 0.4),
          z: dz / Math.max(d, 0.4),
          jump: false,
          crouch: true,
          seq: ++seq,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 70));
    }
    assert.fail('Thief could not reach the expected floor location.');
  }
  await walk(-9, 7.6);
  const grab = {
    op: 'action',
    ...sessions[0],
    action: { type: 'interact' },
    requestId: 'coin-grab',
  };
  await request(grab);
  const grabbed = await request(grab);
  assert.equal(
    grabbed.snapshot.world.items.filter((i) => i.heldBy === sessions[0].id)
      .length,
    1,
  );
  await walk(-9, 6.8, 1);
  // Keep the receiver's presence fresh while checking replay-safe passing.
  await request({ op: 'sync', ...sessions[1] });
  const pass = {
    op: 'action',
    ...sessions[0],
    action: { type: 'pass' },
    requestId: 'quiet-pass',
  };
  const handed = await request(pass),
    retriedPass = await request(pass);
  const carried = handed.snapshot.world.items.find(
    (i) => i.heldBy === sessions[1].id,
  );
  assert.ok(carried, 'the nearby empty-handed thief should receive the item');
  assert.equal(
    retriedPass.snapshot.world.items.find((i) => i.id === carried.id).heldBy,
    sessions[1].id,
  );
  const returned = await request({
    op: 'action',
    ...sessions[1],
    action: { type: 'pass' },
    requestId: 'pass-back',
  });
  assert.equal(
    returned.snapshot.world.items.find((i) => i.id === carried.id).heldBy,
    sessions[0].id,
  );
  assert.equal(
    returned.snapshot.world.wakefulness,
    grabbed.snapshot.world.wakefulness,
    'quiet handoffs must not wake the giant',
  );
  await walk(-11.7, 8.5);
  const banking = {
    op: 'action',
    ...sessions[0],
    action: { type: 'interact' },
    requestId: 'bank',
  };
  await request(banking);
  const banked = await request(banking);
  assert.equal(banked.snapshot.world.banked, 15);
  await request({
    op: 'sync',
    ...sessions[0],
    input: { x: 1, z: 0, jump: false, crouch: false, seq: 2 },
  });
  const stopped = await request({ op: 'sync', ...sessions[0] });
  assert.equal(stopped.snapshot.world.players[0].input.x, 0);
  await request({
    op: 'action',
    ...sessions[0],
    action: { type: 'exit' },
    requestId: 'exit',
  });
  const shared = await Promise.all(
    sessions.map((s) => request({ op: 'sync', ...s })),
  );
  for (const r of shared) {
    assert.equal(r.snapshot.world.banked, 15);
    assert.equal(
      r.snapshot.world.players.find((p) => p.id === sessions[0].id).escaped,
      true,
    );
  }
  console.log(
    'PASS: four collection routes, artwork, 22 treasures and crown, four concurrent thieves, shared movement and banking, quiet handoffs, one-time grabs, replay safety, host controls, origin validation, private credentials and stale input.',
  );
} finally {
  await Promise.allSettled(sessions.map((s) => request({ op: 'leave', ...s })));
}
