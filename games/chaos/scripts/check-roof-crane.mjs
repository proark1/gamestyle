import assert from 'node:assert/strict';
import { identifyAction } from './room-action-identity.mjs';
const origin = new URL(process.argv[2] || 'http://localhost:4317').origin;
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
async function until(session, predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const { snapshot } = await request(session, 'sync');
    if (predicate(snapshot.world)) return snapshot.world;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Crane did not reach its expected state.');
}
try {
  const first = await request({}, 'create', {
    name: 'Roof-check',
    mode: 'sandbox',
    map: process.argv[3] || 'small',
  });
  sessions.push(first.session);
  const second = await request({}, 'join', {
    code: first.session.code,
    name: 'Roof-helper',
  });
  sessions.push(second.session);
  const stock = first.snapshot.world.pieces.find((p) => p.supply);
  assert.ok(stock);
  await request(
    sessions[0],
    'action',
    { action: { type: 'build', kind: 'roof', x: -3, z: -3, rotation: 0 } },
    400,
  );
  const pick = await request(sessions[0], 'action', {
    action: { type: 'crane-pick', id: stock.id },
  });
  const id = pick.snapshot.world.crane.pieceId;
  await request(
    sessions[1],
    'action',
    { action: { type: 'crane-pick', id: stock.id } },
    400,
  );
  await request(
    sessions[1],
    'action',
    { action: { type: 'crane-cancel' } },
    400,
  );
  await until(sessions[1], (world) => world.crane?.phase === 'ready');
  await request(
    sessions[0],
    'action',
    { action: { type: 'crane-place', x: 99, z: 99, rotation: 0 } },
    400,
  );
  await request(sessions[0], 'action', {
    action: { type: 'crane-place', x: -3, z: -3, rotation: 1 },
  });
  let world = await until(sessions[1], (world) => !world.crane);
  const roof = world.pieces.find((p) => p.id === id);
  assert.deepEqual(
    [roof.x, roof.z, roof.rotation, roof.placed],
    [-3, -3, 1, true],
  );
  assert.equal(world.pieces.filter((p) => p.supply).length, 2);
  await request(sessions[0], 'action', { action: { type: 'crane-pick', id } });
  await until(sessions[0], (world) => world.crane?.phase === 'ready');
  await request(sessions[0], 'action', {
    action: { type: 'crane-place', x: -1, z: -3, rotation: 1 },
  });
  world = await until(sessions[1], (world) => !world.crane);
  assert.equal(world.pieces.find((p) => p.id === id).x, -1);
  await request(sessions[0], 'action', { action: { type: 'crane-pick', id } });
  await request(sessions[0], 'leave');
  world = await until(sessions[1], (world) => !world.crane);
  assert.equal(world.pieces.find((p) => p.id === id).placed, true);
  assert.equal(world.pieces.find((p) => p.id === id).x, -1);
  console.log(
    'PASS: two-player roof pickup, exclusive crane, validation, timed installation, moving an installed roof, replenished stock and disconnect recovery.',
  );
} finally {
  await Promise.allSettled(
    sessions.map((session) => request(session, 'leave')),
  );
}
