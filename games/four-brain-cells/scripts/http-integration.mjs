import assert from 'node:assert/strict';

const origin = new URL(process.env.GAME_TEST_URL || 'http://127.0.0.1:3016')
  .origin;
const game = 'four-brain-cells';
const sessions = [];
async function request(body, source = origin) {
  const response = await fetch(`${origin}/api/peer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: source },
    body: JSON.stringify({ ...body, game }),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }
  return { status: response.status, data };
}
try {
  for (const path of [
    '/four-brain-cells',
    '/four-brain-cells/admin',
    '/images/four-brain-cells.png',
  ]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    await response.arrayBuffer();
  }
  const manifest = await fetch(`${origin}/api/audio/${game}?manifest`);
  assert.equal(manifest.status, 200);
  const audio = await manifest.json();
  assert.ok(audio.settings && audio.cues);
  const rejected = await request(
    { op: 'create', name: 'Breakfast check' },
    'https://unrelated.example',
  );
  assert.equal(rejected.status, 403);
  for (let i = 0; i < 4; i++) {
    const reply = await request({
      op: i ? 'join' : 'create',
      code: sessions[0]?.code,
      name: `Breakfast check ${i + 1}`,
    });
    assert.equal(reply.status, 200, reply.data.error);
    assert.equal(reply.data.view.game, game);
    assert.equal(reply.data.view.members.length, i + 1);
    sessions.push(reply.data.session);
  }
  const full = await request({
    op: 'join',
    code: sessions[0].code,
    name: 'Extra brain',
  });
  assert.notEqual(full.status, 200);
  const denied = await request({
    ...sessions[0],
    op: 'leave',
    token: 'invalid-token',
  });
  assert.equal(denied.status, 401);
  const other = await fetch(`${origin}/api/peer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({
      op: 'join',
      game: 'reel-problems',
      code: sessions[0].code,
      name: 'Wrong kitchen',
    }),
  });
  assert.notEqual(other.status, 200, 'rooms must remain isolated across games');
  console.log(
    'Four Brain Cells: page, workshop, artwork, audio manifest, four-member rooms, capacity, origin checks, authentication, and game isolation passed.',
  );
} finally {
  for (const session of sessions) await request({ ...session, op: 'leave' });
}
