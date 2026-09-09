import assert from 'node:assert/strict';

const origin = process.env.GAME_TEST_URL || 'http://127.0.0.1:3026';
const sessions = [];
const npcs = (reply) => reply.snapshot.world.players.filter((p) => p.bot);
async function request(body, expected = 200) {
  const response = await fetch(`${origin}/api/act-natural`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const reply = await response.json();
  assert.equal(response.status, expected, reply.error);
  return reply;
}
async function create(name) {
  const reply = await request({ op: 'create', name, mode: 'human' });
  sessions.push(reply.session);
  return reply.session;
}
const action = (
  session,
  value,
  expected = 200,
  requestId = crypto.randomUUID(),
) => request({ op: 'action', ...session, requestId, action: value }, expected);
function privateSnapshot(reply) {
  const w = reply.snapshot.world;
  for (const field of [
    'seed',
    'botBrains',
    'cowRoutines',
    'members',
    'requests',
  ]) {
    assert.equal(field in w, false, `private field: ${field}`);
    assert.equal(
      field in reply.snapshot,
      false,
      `private snapshot field: ${field}`,
    );
  }
  for (const player of w.players)
    for (const field of ['cowId', 'input', 'token', 'goal', 'path', 'job'])
      assert.equal(field in player, false, `private player field: ${field}`);
}

try {
  const host = await create('NPC slots check');
  const added = await action(host, { type: 'add-bot' });
  assert.equal(npcs(added).length, 1);
  const replayId = crypto.randomUUID();
  await action(host, { type: 'fill-bots' }, 200, replayId);
  const filled = await action(host, { type: 'fill-bots' }, 200, replayId);
  assert.equal(npcs(filled).length, 3);
  assert.equal(filled.snapshot.world.players.length, 4);
  privateSnapshot(filled);
  const removed = await action(host, {
    type: 'remove-bot',
    target: npcs(filled)[1].id,
  });
  assert.equal(npcs(removed).length, 2);
  await action(host, { type: 'fill-bots' });
  const joined = await request({
    op: 'join',
    code: host.code,
    name: 'Human replacement',
  });
  sessions.push(joined.session);
  assert.equal(joined.snapshot.world.players.length, 4);
  assert.equal(npcs(joined).length, 2);
  await action(
    joined.session,
    { type: 'remove-bot', target: npcs(joined)[0].id },
    400,
  );
  await action(joined.session, { type: 'add-bot' }, 400);
  await request({ op: 'sync', ...host, id: npcs(joined)[0].id }, 401);
  const computer = await action(host, { type: 'mode', mode: 'computer' });
  assert.equal(npcs(computer).length, 0);
  assert.equal(computer.snapshot.world.players.length, 2);
  await action(host, { type: 'add-bot' }, 400);

  const oneHost = await create('One NPC check');
  await action(oneHost, { type: 'add-bot' });
  const one = await action(oneHost, { type: 'start' });
  assert.equal(one.snapshot.you.role, 'farmer');
  assert.equal(one.snapshot.world.phase, 'playing');
  assert.equal(npcs(one).length, 1);
  await action(oneHost, { type: 'fill-bots' }, 400);

  const solo = await create('NPC escape check');
  await action(solo, { type: 'fill-bots' });
  let round = await action(solo, { type: 'start' });
  assert.equal(round.snapshot.you.role, 'farmer');
  assert.equal(round.snapshot.you.cowId, null);
  assert.equal(npcs(round).length, 3);
  await request({ op: 'join', code: solo.code, name: 'Too late' }, 409);
  const started = Date.now();
  while (
    round.snapshot.world.phase === 'playing' &&
    Date.now() - started < 90000
  ) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    round = await request({
      op: 'sync',
      ...solo,
      input: { x: 0, z: 0, graze: false },
    });
    privateSnapshot(round);
    assert.equal(npcs(round).length, 3);
    assert.equal(round.snapshot.you.role, 'farmer');
  }
  assert.equal(
    round.snapshot.world.phase,
    'cows-win',
    'NPCs finish an unopposed round on the real server',
  );
  assert.ok(npcs(round).every((p) => p.status === 'escaped'));
  const next = await action(solo, { type: 'restart' });
  assert.equal(next.snapshot.you.role, 'farmer');
  assert.equal(next.snapshot.world.round, 2);
  assert.equal(npcs(next).length, 3);
  await request({ op: 'leave', ...solo });
  sessions.splice(sessions.indexOf(solo), 1);
  const reclaimed = await request({
    op: 'join',
    code: solo.code,
    name: 'New human host',
  });
  sessions.push(reclaimed.session);
  assert.equal(reclaimed.snapshot.host, reclaimed.session.id);
  assert.equal(reclaimed.snapshot.world.phase, 'lobby');
  assert.equal(reclaimed.snapshot.world.players.length, 1);
  assert.equal(npcs(reclaimed).length, 0);
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        origin,
        escapeSeconds: +((Date.now() - started) / 1000).toFixed(1),
        checks: [
          'add/fill/remove/replay',
          'human replacement',
          'host-only authenticated controls',
          'mode cleanup',
          'one-NPC start',
          'three-NPC complete escape',
          'private farmer snapshots',
          'solo farmer restart',
          'last-human cleanup',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  for (const session of sessions.reverse())
    await request({ op: 'leave', ...session }).catch(() => {});
}
