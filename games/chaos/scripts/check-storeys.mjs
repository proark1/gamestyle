import assert from 'node:assert/strict';
import { identifyAction } from './room-action-identity.mjs';
const base = process.argv[2] || 'http://127.0.0.1:3123';
const sessions = [];
async function request(body) {
  const r = await fetch(base + '/api/handwerker/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await identifyAction(base, body)),
  });
  return { status: r.status, data: await r.json() };
}
try {
  const created = await request({
    op: 'create',
    mode: 'sandbox',
    map: 'small',
    name: 'Storey verification',
  });
  assert.equal(created.status, 200);
  const session = created.data.session;
  sessions.push(session);
  const build = async (kind, x, z, level, position) => {
    const r = await request({
      op: 'action',
      ...session,
      action: { type: 'build', kind, x, z, level, rotation: 0 },
      position: { ...position, angle: Math.PI },
    });
    assert.equal(
      r.status,
      200,
      JSON.stringify({ kind, x, z, level, error: r.data.error }),
    );
    return r.data.snapshot;
  };
  await build('stairs', -2, 0, 0, { x: -2, z: 2.5, y: 0.43 });
  for (const [x, z] of [
    [-2, -3],
    [0, -3],
    [2, -3],
    [2, -1],
    [2, 1],
    [2, 3],
    [0, -1],
    [0, 1],
    [0, 3],
  ])
    await build('floor', x, z, 1, { x, z, y: 0.43 });
  await build('stairs', 2, 0, 1, { x: 2, z: 2.5, y: 3.43 });
  await build('floor', 2, -3, 2, { x: 2, z: -3, y: 3.43 });
  const built = await build('chair', 2, -3, 2, { x: 2, z: -1.5, y: 6.43 });
  assert.equal(built.world.pieces.filter((p) => p.kind === 'stairs').length, 2);
  const invalid = await request({
    op: 'action',
    ...session,
    action: { type: 'build', kind: 'floor', x: 0, z: 0, level: 3, rotation: 0 },
  });
  assert.equal(invalid.status, 400);
  const stairs = built.world.pieces.find(
    (p) => p.kind === 'stairs' && p.level === 1,
  );
  const removed = await request({
    op: 'action',
    ...session,
    action: { type: 'remove', id: stairs.id },
    position: { x: 2, z: 2.5, y: 3.43, angle: Math.PI },
  });
  assert.equal(removed.status, 400);
  assert.match(removed.data.error, /supports/);
  const joined = await request({
    op: 'join',
    code: session.code,
    name: 'Storey verification peer',
  });
  assert.equal(joined.status, 200);
  sessions.push(joined.data.session);
  assert.equal(
    joined.data.snapshot.world.pieces.find(
      (p) => p.kind === 'chair' && p.x === 2 && p.z === -3,
    ).level,
    2,
  );
  console.log(
    JSON.stringify({
      floors: 3,
      stairs: 2,
      upperFurniture: 'passed',
      supportProtection: 'passed',
      invalidLevel: 'rejected',
      peerSnapshot: 'passed',
    }),
  );
} finally {
  for (const session of sessions) await request({ op: 'leave', ...session });
}
