import assert from 'node:assert/strict';
import { identifyAction } from './room-action-identity.mjs';
const base = process.argv[2] || 'http://127.0.0.1:3137';
const sessions = [];
async function request(body, path = '/api/handwerker/rooms') {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify(
      path === '/api/handwerker/rooms'
        ? await identifyAction(base, body)
        : body,
    ),
  });
  return { status: response.status, data: await response.json() };
}
try {
  const created = await request({
    op: 'create',
    mode: 'sandbox',
    map: 'small',
    name: 'Home design check',
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const session = created.data.session;
  sessions.push(session);
  const act = async (
    action,
    position = { x: 0, z: 2, y: 0.43, angle: Math.PI },
  ) => request({ op: 'action', ...session, action, position });
  const built = await act({
    type: 'build',
    kind: 'floor',
    x: 0,
    z: 0,
    rotation: 0,
    paint: 'mint',
    finish: 'checker',
  });
  assert.equal(built.status, 200, JSON.stringify(built.data));
  const floor = built.data.snapshot.world.pieces.at(-1);
  assert.equal(floor.finish, 'checker');
  assert.equal(floor.paint, 'mint');
  const stove = await act({
    type: 'build',
    kind: 'stove',
    x: 0,
    z: 0,
    rotation: 0,
    paint: 'coral',
  });
  assert.equal(stove.status, 200, JSON.stringify(stove.data));
  const cooker = stove.data.snapshot.world.pieces.at(-1);
  const used = await act({ type: 'use', id: cooker.id });
  assert.equal(used.status, 200, JSON.stringify(used.data));
  const repainted = await act({ type: 'paint', id: cooker.id, paint: 'ocean' });
  assert.equal(repainted.status, 200, JSON.stringify(repainted.data));
  const walls = await act(
    {
      type: 'paint',
      id: 'starter-window',
      paint: 'rose',
      finish: 'plaster',
      wholeHouse: true,
    },
    { x: -1, z: -2, y: 0.43, angle: Math.PI },
  );
  assert.equal(walls.status, 200, JSON.stringify(walls.data));
  assert.ok(
    walls.data.snapshot.world.pieces
      .filter((p) => ['wall', 'window'].includes(p.kind))
      .every((p) => p.paint === 'rose' && p.finish === 'plaster'),
  );
  const bad = await act({
    type: 'paint',
    id: cooker.id,
    paint: 'invalid-color',
  });
  assert.equal(bad.status, 400);
  const joined = await request({
    op: 'join',
    code: session.code,
    name: 'Home design peer',
  });
  assert.equal(joined.status, 200);
  sessions.push(joined.data.session);
  assert.equal(
    joined.data.snapshot.world.pieces.find((p) => p.id === cooker.id).paint,
    'ocean',
  );
  assert.equal(
    joined.data.snapshot.world.pieces.find((p) => p.id === floor.id).finish,
    'checker',
  );
  const saved = await request(
    { ...session, title: 'Home customization verification' },
    '/api/handwerker/builds',
  );
  assert.equal(saved.status, 201, JSON.stringify(saved.data));
  const restored = await request({
    op: 'create',
    mode: 'sandbox',
    map: 'small',
    name: 'Home design restore',
    buildId: saved.data.id,
    buildMode: 'remix',
  });
  assert.equal(restored.status, 200, JSON.stringify(restored.data));
  sessions.push(restored.data.session);
  const pieces = restored.data.snapshot.world.pieces;
  assert.ok(
    pieces.some((p) => p.kind === 'stove' && p.paint === 'ocean' && p.tried),
  );
  assert.ok(
    pieces.some(
      (p) => p.kind === 'floor' && p.paint === 'mint' && p.finish === 'checker',
    ),
  );
  assert.ok(
    pieces.some(
      (p) => p.kind === 'wall' && p.paint === 'rose' && p.finish === 'plaster',
    ),
  );
  console.log(
    JSON.stringify({
      coloredTiles: 'passed',
      furniture: 'passed',
      propUse: 'passed',
      wholeHousePaint: 'passed',
      invalidColor: 'rejected',
      twoPlayers: 'passed',
      savedRemix: 'passed',
    }),
  );
} finally {
  for (const session of sessions) await request({ op: 'leave', ...session });
}
