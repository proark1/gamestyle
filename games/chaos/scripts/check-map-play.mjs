import assert from 'node:assert/strict';
import { identifyAction } from './room-action-identity.mjs';
const origin = new URL(process.argv[2] || 'http://localhost:4321').origin;
const sessions = [];
async function request(session, op, extra = {}, expected = 200) {
  const response = await fetch(`${origin}/api/handwerker/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(
      await identifyAction(origin, { ...session, op, ...extra }),
    ),
  });
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}
try {
  await request({}, 'create', { map: 'huge' }, 400);
  for (const [map, travelX, buildX] of [
    ['medium', 14, 10],
    ['large', 20, 14],
  ]) {
    const created = await request({}, 'create', {
      name: 'Map-check',
      mode: 'sandbox',
      map,
    });
    sessions.push(created.session);
    assert.equal(created.snapshot.world.map, map);
    const joined = await request({ code: created.session.code }, 'join', {
      name: 'Map-guest',
      map: 'small',
    });
    sessions.push(joined.session);
    assert.equal(joined.snapshot.world.map, map);
    const moved = await request(created.session, 'sync', {
      position: { x: travelX, y: 0.18, z: 0, angle: 0 },
    });
    assert.equal(
      moved.snapshot.players.find((p) => p.id === created.session.id).x,
      travelX,
    );
    const built = await request(created.session, 'action', {
      position: { x: buildX - 1.8, y: 0.18, z: 0, angle: Math.PI / 2 },
      action: { type: 'build', kind: 'wall', x: buildX, z: 0, rotation: 0 },
    });
    const wall = built.snapshot.world.pieces.find(
      (p) => p.kind === 'wall' && p.x === buildX && p.z === 0,
    );
    assert.ok(wall?.placed);
    const seen = await request(joined.session, 'sync');
    assert.ok(seen.snapshot.world.pieces.some((p) => p.id === wall.id));
    if (map === 'large') {
      const stairs = await request(created.session, 'action', {
        position: { x: 8, y: 0.43, z: 2.5, angle: Math.PI },
        action: { type: 'build', kind: 'stairs', x: 8, z: 0, rotation: 0 },
      });
      assert.ok(
        stairs.snapshot.world.pieces.some(
          (p) => p.kind === 'stairs' && p.placed && p.x === 8,
        ),
      );
      assert.ok(
        (await request(joined.session, 'sync')).snapshot.world.pieces.some(
          (p) => p.kind === 'stairs' && p.placed && p.x === 8,
        ),
      );
    }
    const reset = await request(created.session, 'action', {
      action: { type: 'reset', mode: 'job' },
    });
    assert.equal(reset.snapshot.world.map, map);
    assert.equal(reset.snapshot.world.mode, 'job');
    assert.equal(
      (await request(joined.session, 'sync')).snapshot.world.map,
      map,
    );
  }
  const small = await request({}, 'create', {
    mode: 'sandbox',
    name: 'Small-check',
  });
  sessions.push(small.session);
  assert.equal(small.snapshot.world.map, 'small');
  await request(
    small.session,
    'action',
    {
      position: { x: 8.2, z: 0, angle: Math.PI / 2 },
      action: { type: 'build', kind: 'wall', x: 10, z: 0, rotation: 0 },
    },
    400,
  );
  console.log(
    'PASS: map validation, default Small, shared Medium/Large, expanded movement, walls and stairs, guest synchronization and reset persistence.',
  );
} finally {
  await Promise.all(
    sessions.map((session) => request(session, 'leave').catch(() => {})),
  );
}
