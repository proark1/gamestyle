import assert from 'node:assert/strict';
import { identifyAction } from './room-action-identity.mjs';

const base = process.argv[2];
if (!base)
  throw new Error(
    'Usage: node games/chaos/scripts/check-multiplayer.mjs http://localhost:3100',
  );
const origin = new URL(base).origin;
const sessions = [];
async function request(body, expected = 200, requestOrigin = origin) {
  body = await identifyAction(origin, body);
  const response = await fetch(new URL('/api/handwerker/rooms', base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: requestOrigin },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { error: raw };
  }
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}
try {
  assert.equal((await fetch(new URL('/api/health', base))).status, 200);
  const created = await request({
    op: 'create',
    name: 'Hosting-Test',
    mode: 'sandbox',
  });
  sessions.push(created.session);
  const joined = await Promise.all(
    [1, 2, 3].map((color) =>
      request({
        op: 'join',
        code: created.session.code,
        name: `Test-${color}`,
        color,
      }),
    ),
  );
  sessions.push(...joined.map((data) => data.session));
  await request(
    { op: 'join', code: created.session.code, name: 'Fünfter Helm' },
    409,
  );
  await request({ ...sessions[0], op: 'sync', token: 'wrong' }, 401);
  await request(
    {
      ...sessions[1],
      op: 'action',
      action: { type: 'reset', mode: 'sandbox' },
    },
    400,
  );
  await request({ ...sessions[0], op: 'sync' }, 403, 'https://other.example');
  await Promise.all(
    sessions.map((session, index) =>
      request({
        ...session,
        op: 'action',
        position: { x: index * 2 - 3, z: 2, angle: Math.PI, y: 0.43, jump: 0 },
        action: {
          type: 'build',
          kind: 'floor',
          x: index * 2 - 3,
          z: 0,
          rotation: 0,
        },
      }),
    ),
  );
  const views = await Promise.all(
    sessions.map((session) => request({ ...session, op: 'sync' })),
  );
  for (const view of views) {
    assert.equal(view.snapshot.players.length, 4);
    assert.equal(view.snapshot.world.builds, 4);
    assert.equal(
      view.snapshot.world.pieces.filter((piece) => piece.kind === 'floor')
        .length,
      4,
    );
    assert.ok(
      view.snapshot.players.every((player) => !('token_hash' in player)),
    );
  }
  await request({ ...sessions[0], op: 'leave' });
  sessions.shift();
  const transferred = await request({ ...sessions[0], op: 'sync' });
  const newHost = sessions.find(
    (session) => session.id === transferred.snapshot.host,
  );
  assert.ok(newHost);
  await request({
    ...newHost,
    op: 'action',
    action: { type: 'reset', mode: 'sandbox' },
  });
  console.log(
    'PASS: health, four players, full room, auth, HTTPS origin, simultaneous builds, shared state, host transfer.',
  );
} finally {
  await Promise.allSettled(
    sessions.map((session) => request({ ...session, op: 'leave' })),
  );
}
