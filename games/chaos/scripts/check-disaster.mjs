import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { resolve, basename } from 'node:path';

// Synthetic completed rounds are allowed ONLY in an explicitly named local test database.
const base = process.argv[2] || 'http://127.0.0.1:3120';
const path = resolve(process.argv[3] || 'data/disaster-preview.sqlite');
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
assert.equal(basename(path), 'disaster-preview.sqlite');
const db = new DatabaseSync(path);
const sessions = [],
  savedIds = [];
async function request(path, body, headers = {}) {
  const r = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
async function create(extra = {}) {
  const r = await request('/api/handwerker/rooms', {
    op: 'create',
    name: 'Challenge test',
    ...extra,
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  sessions.push(r.data.session);
  return r.data;
}
async function action(room, action, seq = 1) {
  return request('/api/handwerker/rooms', {
    op: 'action',
    ...room.session,
    roundId: room.snapshot.world.party.roundId,
    seq,
    actionId: crypto.randomUUID(),
    action,
  });
}
function completeFixture(room) {
  const w = JSON.parse(
    db
      .prepare('SELECT world FROM handwerker_rooms WHERE code=?')
      .get(room.session.code).world,
  );
  w.pieces = Object.entries({
    wall: 4,
    window: 2,
    door: 1,
    roof: 2,
    sofa: 1,
    toilet: 1,
    plant: 1,
  }).flatMap(([kind, n]) =>
    Array.from({ length: n }, (_, i) => ({
      id: `fixture-${kind}-${i}`,
      kind,
      x: 0,
      z: 0,
      rotation: 0,
      placed: true,
    })),
  );
  w.started = Date.now() - 74000;
  w.party.phase = 'lastCall';
  w.party.deadline = Date.now() - 1;
  w.party.task.phase = 'done';
  w.party.task.roles = ['', ''];
  db.prepare(
    'UPDATE handwerker_rooms SET world=?,version=version+1 WHERE code=?',
  ).run(JSON.stringify(w), room.session.code);
}
try {
  const source = await create();
  const forged = await request('/api/handwerker/builds', {
    ...source.session,
    roundId: source.snapshot.world.party.roundId,
    title: 'Forged time',
    kind: 'challenge',
    elapsedMs: 1,
  });
  assert.equal(forged.status, 400);
  const start = await action(source, { type: 'party', op: 'start' });
  assert.equal(start.status, 200);
  const sourceStart = db
    .prepare('SELECT world FROM handwerker_rooms WHERE code=?')
    .get(source.session.code);
  const initial = JSON.parse(sourceStart.world).challengeSetup.pieces;
  completeFixture(source);
  const finish = await request('/api/handwerker/rooms', {
    op: 'sync',
    ...source.session,
  });
  assert.equal(finish.data.snapshot.world.party.result.passed, true);
  const stale = await request('/api/handwerker/builds', {
    ...source.session,
    roundId: 'old-round',
    title: 'Old round',
    kind: 'challenge',
  });
  assert.equal(stale.status, 409);
  const save = await request('/api/handwerker/builds', {
    ...source.session,
    roundId: source.snapshot.world.party.roundId,
    title: 'Beat our test disaster',
    kind: 'challenge',
    elapsedMs: 1,
  });
  assert.equal(save.status, 201, JSON.stringify(save.data));
  savedIds.push(save.data.id);
  const saved = JSON.parse(
    db
      .prepare('SELECT snapshot FROM handwerker_saved_builds WHERE id=?')
      .get(save.data.id).snapshot,
  );
  assert.ok(saved.challenge.elapsedMs >= 74000);
  assert.ok(saved.challenge.elapsedMs < 80000);
  assert.deepEqual(saved.pieces, initial);
  const page = await fetch(base + save.data.url);
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.ok(html.includes('Beat this time'));
  assert.ok(html.includes('Can your crew beat'));
  for (const secret of [
    source.session.code,
    source.session.token,
    source.session.id,
    'runCrew',
    'receipts',
  ])
    assert.ok(!html.includes(secret));
  const copy = await create({
    buildId: save.data.id,
    buildMode: 'try',
    daily: '2026-09-06',
    format: 'swap',
  });
  assert.notEqual(copy.session.code, source.session.code);
  assert.equal(copy.snapshot.world.party.format, 'classic');
  assert.equal(copy.snapshot.world.party.daily, undefined);
  assert.equal(
    copy.snapshot.world.party.challenge.elapsedMs,
    saved.challenge.elapsedMs,
  );
  const change = await action(copy, {
    type: 'party',
    op: 'configure',
    job: 'glass',
  });
  assert.equal(change.status, 400);
  const startCopy = await action(copy, { type: 'party', op: 'start' });
  assert.equal(startCopy.status, 200);
  completeFixture(copy);
  const finishCopy = await request('/api/handwerker/rooms', {
    op: 'sync',
    ...copy.session,
  });
  assert.equal(finishCopy.data.snapshot.world.party.result.passed, true);
  const onward = await request('/api/handwerker/builds', {
    ...copy.session,
    roundId: copy.snapshot.world.party.roundId,
    title: 'Our next challenge',
    kind: 'challenge',
  });
  assert.equal(onward.status, 201);
  savedIds.push(onward.data.id);
  const onwardRow = db
    .prepare(
      'SELECT source_id,snapshot FROM handwerker_saved_builds WHERE id=?',
    )
    .get(onward.data.id);
  assert.equal(onwardRow.source_id, save.data.id);
  assert.deepEqual(JSON.parse(onwardRow.snapshot).pieces, initial);
  const retry = await action(
    copy,
    { type: 'reset', mode: 'job', retry: true },
    2,
  );
  assert.equal(retry.status, 200);
  assert.equal(retry.data.snapshot.world.party.challenge.buildId, save.data.id);
  assert.equal(retry.data.snapshot.world.party.run, undefined);
  assert.deepEqual(retry.data.snapshot.world.pieces, initial);
  const remix = await create({ buildId: save.data.id, buildMode: 'remix' });
  assert.equal(remix.snapshot.world.party.challenge, undefined);
  const unsupported = {
    ...saved,
    challenge: { ...saved.challenge, rulesVersion: 999 },
  };
  db.prepare('UPDATE handwerker_saved_builds SET snapshot=? WHERE id=?').run(
    JSON.stringify(unsupported),
    onward.data.id,
  );
  const old = await request('/api/handwerker/rooms', {
    op: 'create',
    name: 'Old rules',
    buildId: onward.data.id,
    buildMode: 'try',
  });
  assert.equal(old.status, 400);
  console.log(
    'PASS: HTTP forged-time rejection, server verdict timing, immutable start, public privacy, locked rules, independent attempts, onward attribution, retry, remix and unsupported rules. Completion fixtures were local and synthetic.',
  );
} finally {
  for (const session of sessions)
    await request('/api/handwerker/rooms', { op: 'leave', ...session });
  for (const id of savedIds)
    db.prepare('DELETE FROM handwerker_saved_builds WHERE id=?').run(id);
  db.close();
}
