import assert from 'node:assert/strict';
import { identifyAction } from './room-action-identity.mjs';
const origin = process.argv[2] || 'http://127.0.0.1:3105';
async function request(body) {
  const response = await fetch(`${origin}/api/handwerker/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
const created = await request({
  op: 'create',
  name: 'House audio check',
  mode: 'sandbox',
});
assert.equal(created.status, 200);
const session = created.data.session;
let snapshot = created.data.snapshot;
const position = { x: 2, z: 1.8, y: 0.43, angle: Math.PI };
async function action(value) {
  const body = await identifyAction(origin, {
    op: 'action',
    ...session,
    position,
    action: value,
  });
  const result = await request(body);
  if (result.data.snapshot) snapshot = result.data.snapshot;
  return { ...result, body };
}
try {
  for (const kind of ['fridge', 'washer', 'clock', 'duck']) {
    const built = await action({
      type: 'build',
      kind,
      x: 2,
      z: 0,
      rotation: 0,
    });
    assert.equal(built.status, 200, JSON.stringify(built.data));
    const piece = snapshot.world.pieces.at(-1);
    const used = await action({ type: 'use', id: piece.id });
    assert.equal(used.status, 200, JSON.stringify(used.data));
    const cue = `prop.${kind}.use`;
    assert.equal(
      snapshot.world.events.filter((e) => e.audioCue === cue).length,
      1,
    );
    const replay = await request(used.body);
    assert.equal(replay.status, 200);
    assert.equal(
      replay.data.snapshot.world.events.filter((e) => e.audioCue === cue)
        .length,
      1,
      'idempotent replay emits no second sound',
    );
    const rapid = await action({ type: 'use', id: piece.id });
    assert.equal(rapid.status, 400);
    const removed = await action({ type: 'remove', id: piece.id });
    assert.equal(removed.status, 200, JSON.stringify(removed.data));
    // Each builder also has a cross-object cooldown.
    await new Promise((resolve) => setTimeout(resolve, 1050));
  }
  console.log(
    'PASS: four buildable house props, reachable use, duplicate replay, cooldown and removal through the running server.',
  );
} finally {
  await request({ op: 'leave', ...session });
}
