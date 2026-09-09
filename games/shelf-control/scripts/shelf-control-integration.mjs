import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';

const origin = process.argv[2] ?? 'http://127.0.0.1:3022';
const local = ['127.0.0.1', 'localhost'].includes(new URL(origin).hostname);
if (
  !local &&
  !(
    process.argv.includes('--live') &&
    origin === 'https://jumbleyard.up.railway.app'
  )
)
  throw new Error(
    'Use a local preview, or explicitly pass the Jumbleyard origin with --live.',
  );
const sessions = [];
const request = async (body) => {
  const response = await fetch(`${origin}/api/shelf-control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, ...(await response.json()) };
};
try {
  const page = await fetch(`${origin}/shelf-control`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Everything|SHELF CONTROL/);
  const collection = await fetch(origin);
  assert.equal(collection.status, 200);
  assert.match(await collection.text(), /href="\/shelf-control"/);
  const card = await fetch(`${origin}/images/shelf-control.png`);
  assert.equal(card.status, 200);
  assert.match(card.headers.get('content-type'), /image/);
  assert.equal(new Uint8Array(await card.arrayBuffer())[0], 137);
  const created = await request({ op: 'create', name: 'Guard' });
  assert.equal(created.status, 200);
  sessions.push(created.session);
  const early = await request({
    op: 'action',
    ...sessions[0],
    requestId: 'too-soon',
    action: { type: 'start' },
  });
  assert.equal(early.status, 400);
  for (let i = 1; i < 4; i++) {
    const joined = await request({
      op: 'join',
      code: sessions[0].code,
      name: `Mannequin ${i}`,
    });
    assert.equal(joined.status, 200);
    sessions.push(joined.session);
  }
  assert.equal(
    (await request({ op: 'join', code: sessions[0].code, name: 'Fifth' }))
      .status,
    409,
  );
  assert.equal(
    (await request({ op: 'sync', ...sessions[0], token: 'forged' })).status,
    401,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/shelf-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://unrelated.invalid',
        },
        body: JSON.stringify({ op: 'create' }),
      })
    ).status,
    403,
  );
  const start = await request({
    op: 'action',
    ...sessions[0],
    requestId: 'start',
    action: { type: 'start' },
  });
  assert.equal(start.snapshot.phase, 'hiding');
  assert.equal(start.snapshot.you.role, 'guard');
  const initial = await request({ op: 'sync', ...sessions[1] });
  const pose = await request({
    op: 'action',
    ...sessions[1],
    requestId: 'pose',
    action: { type: 'pose' },
  });
  assert.equal(pose.snapshot.you.pose, (initial.snapshot.you.pose + 1) % 3);
  let ticks = 0,
    views;
  while (ticks++ < 130) {
    views = await Promise.all(
      sessions.map((session) =>
        request({ op: 'sync', ...session, input: { x: 0, z: 0, seq: 1 } }),
      ),
    );
    for (const view of views) {
      assert.equal(view.status, 200);
      assert.ok(!JSON.stringify(view.snapshot).includes('members'));
      assert.ok(!JSON.stringify(view.snapshot).includes('routines'));
    }
    const guard = views[0].snapshot;
    if (guard.phase === 'hiding') {
      assert.equal(guard.figures.length, 0);
      assert.equal(guard.items.length, 0);
      assert.equal(guard.events.length, 0);
      assert.equal(guard.objectives, null);
    }
    if (guard.phase === 'playing') break;
    await sleep(140);
  }
  assert.equal(views[0].snapshot.phase, 'playing');
  assert.equal(
    views.filter((v) => v.snapshot.you.role === 'mannequin').length,
    3,
  );
  assert.equal(views[0].snapshot.objectives, null);
  assert.equal(views[0].snapshot.players.filter((p) => p.figureId).length, 0);
  await request({ op: 'leave', ...sessions[3] });
  sessions.pop();
  const left = await request({ op: 'sync', ...sessions[0] });
  assert.equal(left.snapshot.phase, 'lobby');
  assert.equal(left.snapshot.players.length, 3);
  console.log(
    `PASS: four independent HTTP sessions, auth/origin checks, 15-second hidden start, private snapshots, role assignment, pose, capacity and departure (${ticks} synchronized updates).`,
  );
} finally {
  for (const session of sessions)
    await request({ op: 'leave', ...session }).catch(() => {});
}
