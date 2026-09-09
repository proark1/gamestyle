import assert from 'node:assert/strict';
import { identifyAction } from './room-action-identity.mjs';
const origin = new URL(process.argv[2] || 'http://localhost:3100').origin;
const sessions = [];
async function request(session, op, extra = {}, status = 200) {
  const response = await fetch(`${origin}/api/handwerker/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(
      await identifyAction(origin, { ...session, op, ...extra }),
    ),
  });
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
}
try {
  const first = await request({}, 'create', {
    name: 'Physics-HTTP',
    mode: 'sandbox',
  });
  sessions.push(first.session);
  const second = await request({}, 'join', {
    code: first.session.code,
    name: 'Physics-Friend',
  });
  sessions.push(second.session);
  const p = { x: -1.5, z: 5.8, y: 0.18, angle: Math.PI, jump: 0 };
  await request(sessions[0], 'action', {
    position: p,
    action: { type: 'grab', id: 'site-bone' },
  });
  await request(
    sessions[1],
    'action',
    { position: p, action: { type: 'grab', id: 'site-bone' } },
    400,
  );
  const carried = await request(sessions[1], 'sync');
  assert.equal(
    carried.snapshot.world.pieces.find((p) => p.id === 'site-bone').heldBy,
    sessions[0].id,
  );
  const thrown = await request(sessions[0], 'action', {
    position: p,
    action: { type: 'throw' },
  });
  const before = thrown.snapshot.world.pieces.find((p) => p.id === 'site-bone');
  assert.ok(before.physics);
  assert.equal(before.heldBy, undefined);
  assert.equal(before.flight, undefined);
  await new Promise((resolve) => setTimeout(resolve, 600));
  const after = await request(sessions[1], 'sync');
  const bone = after.snapshot.world.pieces.find((p) => p.id === 'site-bone');
  assert.ok(Math.hypot(bone.x - before.x, bone.z - before.z) > 0.5);
  assert.ok(Number.isFinite(bone.physics.y));
  const speeches = [];
  for (let i = 0; i < 4; i++) {
    const r = await request(sessions[0], 'action', {
      action: { type: 'emote' },
    });
    speeches.push(r.snapshot.world.events.at(-1).speech);
  }
  assert.equal(new Set(speeches).size, 4);
  await request(
    sessions[0],
    'action',
    {
      position: p,
      action: { type: 'build', kind: 'floor', x: 0, z: -4, rotation: 0 },
    },
    400,
  );
  console.log(
    'PASS: shared pickup ownership, double-grab rejection, physical throw movement, saved transforms, varied speech, remote-build rejection.',
  );
} finally {
  await Promise.allSettled(sessions.map((s) => request(s, 'leave')));
}
