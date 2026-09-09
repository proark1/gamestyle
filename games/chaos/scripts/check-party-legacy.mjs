import assert from 'node:assert/strict';
import { basename, resolve } from 'node:path';
import { openSqlite } from '../../../db/sqlite.mjs';
const base = new URL(process.argv[2] || 'http://127.0.0.1:3105'),
  file = resolve(process.env.DATABASE_PATH || 'data/party-preview.sqlite');
if (
  !['127.0.0.1', 'localhost'].includes(base.hostname) ||
  basename(file) !== 'party-preview.sqlite'
)
  throw new Error('Use the isolated local party-preview.sqlite fixture only.');
async function request(body) {
  const res = await fetch(new URL('/api/handwerker/rooms', base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  assert.equal(res.status, 200, JSON.stringify(data));
  return data;
}
const created = await request({
    op: 'create',
    mode: 'sandbox',
    name: 'Legacy fixture',
  }),
  native = openSqlite(file);
try {
  const world = created.snapshot.world;
  delete world.party;
  world.futurePrivateField = { marker: 'MUST_NOT_LEAK' };
  native
    .prepare(
      'UPDATE handwerker_rooms SET world = ?, version = version + 1 WHERE code = ?',
    )
    .run(JSON.stringify(world), created.session.code);
  const result = await request({
    ...created.session,
    op: 'action',
    position: { x: 1, z: 2, angle: 0 },
    action: { type: 'build', kind: 'floor', x: 1, z: 0, rotation: 0 },
  });
  assert.equal(result.snapshot.world.party, undefined);
  assert.equal(result.snapshot.world.builds, 1);
  assert.equal(JSON.stringify(result).includes('MUST_NOT_LEAK'), false);
  const synced = await request({ ...created.session, op: 'sync' });
  assert.equal(
    synced.snapshot.world.pieces.filter((p) => p.kind === 'floor').length,
    1,
  );
  console.log(
    'PASS: legacy persisted world, action without party metadata, safe public whitelist and retained build.',
  );
} finally {
  native.close();
  await request({ ...created.session, op: 'leave' });
}
