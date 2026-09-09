import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const base = (process.argv[2] || 'http://localhost:3100').replace(/\/$/, '');
const existingRoom = process.argv[3],
  sessions = [];
let count = 0;
const model = await readFile(new URL('../model.ts', import.meta.url), 'utf8');
const stations = Object.fromEntries(
  [
    ...model.matchAll(
      /\{ id: '([^']+)', name: (?:'[^']*'|"[^"]*"), x: ([\d.-]+), z: ([\d.-]+) \}/g,
    ),
  ].map((m) => [
    m[1],
    { x: Number(m[2]), y: 1.8, z: Number(m[3]), yaw: 0, pitch: 0 },
  ]),
);
if (!stations.cement || !stations.sand || !stations.water || !stations.mixer)
  throw new Error('Could not read supply station coordinates from the model.');
async function request(body) {
  const r = await fetch(`${base}/api/handwerker/first-person/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json();
  return { status: r.status, ...data };
}
function check(name, condition) {
  assert.ok(condition, name);
  count++;
  console.log(JSON.stringify({ name, ok: true }));
}
async function player(code, name) {
  const r = await request(
    code ? { op: 'join', code, name } : { op: 'create', name },
  );
  assert.equal(r.status, 200, r.error);
  sessions.push(r.session);
  return r.session;
}
async function action(s, value, position, id = randomUUID()) {
  const r = await request({
    op: 'action',
    ...s,
    action: value,
    position,
    actionId: id,
  });
  assert.equal(r.status, 200, r.error);
  return r.snapshot;
}
const at = (x, z, y = 1.8) => ({ x, z, y, yaw: 0, pitch: 0 });
const place = (kind, x, z, y, rotation = 0) => ({
  type: 'place',
  kind,
  placement: { x, z, y, rotation },
});
try {
  const a = await player(existingRoom, 'Prüfung Maurer'),
    b = await player(a.code, 'Prüfung Zimmerer');
  let snap = await action(a, { type: 'race' }, at(-2.8, -4.2));
  check(
    'shared_race_starts_with_five_minutes',
    snap.world.race.deadline - snap.world.race.started === 300000,
  );
  const start = snap.world.race.started;
  for (const s of [a, b]) {
    for (const station of ['cement', 'sand', 'sand', 'water']) {
      await action(s, { type: 'supply', station }, stations[station]);
      await action(s, { type: 'mixer' }, stations.mixer);
    }
    snap = await action(s, { type: 'mixer' }, stations.mixer);
    if (s === b) {
      check('second_batch_jams_during_race', snap.world.mixer.jammed === true);
      snap = await action(a, { type: 'mixer' }, stations.mixer, 'team-rescue');
      const replay = await action(
        a,
        { type: 'mixer' },
        stations.mixer,
        'team-rescue',
      );
      check(
        'other_helper_rescues_once',
        !snap.world.mixer.jammed && replay.version === snap.version,
      );
    }
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.max(0, snap.world.mixer.readyAt - snap.now) + 100,
      ),
    );
    snap = await action(s, { type: 'mixer' }, stations.mixer);
    check(
      s === a ? 'first_helper_has_mortar' : 'second_helper_has_mortar',
      snap.world.inventories[s.id].mortar === 24,
    );
    await action(s, { type: 'supply', station: 'brick' }, stations.brick);
    await action(s, { type: 'supply', station: 'beam' }, stations.beam);
  }
  const corners = [
    ...Array.from({ length: 7 }, (_, i) => ({
      x: -1.5 + i * 0.5,
      z: 1.5,
      y: 0.245,
      rotation: 0,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      x: 1.875,
      z: 1.375 - i * 0.5,
      y: 0.245,
      rotation: 1,
    })),
  ];
  for (let i = 0; i < corners.length; i++) {
    const p = corners[i],
      s = i % 2 ? b : a,
      other = s === a ? b : a,
      position = at(p.x, p.z + 1.2);
    await action(s, { type: 'place', kind: 'brick', placement: p }, position);
    snap = await action(other, { type: 'mortar', placement: p }, position);
  }
  check(
    'twelve_shared_bricks_have_visible_top_mortar',
    snap.world.parts.filter(
      (p) => p.kind === 'brick' && p.bonded && p.mortaredTop,
    ).length === 12,
  );
  const corner = snap.world.parts.find((p) => p.x === 1.875 && p.z === 1.375);
  check(
    'server_preserves_eighth_metre_corner_and_outer_edge',
    corner.x - 0.125 === 1.5 + 0.25 && corner.z + 0.25 === 1.5 + 0.125,
  );
  for (const x of [-0.75, 0.75])
    await action(a, place('beam', x, -1.5, 1.12, 2), at(x, -0.5));
  snap = await action(b, place('beam', 0, -1.5, 2.245), at(0, -0.5));
  check(
    'standing_posts_and_supported_crossbeam_saved',
    snap.world.parts.filter((p) => p.kind === 'beam' && p.rotation === 2)
      .length === 2,
  );
  await action(b, { type: 'supply', station: 'roof' }, stations.roof);
  for (const z of [-1, -2])
    snap = await action(b, place('roof', 0, z, 2.43), at(0, z + 1));
  check(
    'roof_sits_on_beam_without_ground_snap',
    snap.world.parts
      .filter((p) => p.kind === 'roof')
      .every((p) => p.y === 2.43),
  );
  check(
    'race_completes_for_everyone_without_reset',
    snap.world.race.completed > start &&
      snap.world.parts.length === 17 &&
      snap.world.notice.kind === 'race',
  );
  const synced = await request({ op: 'sync', ...a });
  check(
    'both_clients_receive_identical_construction_and_race',
    JSON.stringify(synced.snapshot.world) === JSON.stringify(snap.world),
  );
  const first = await action(a, { type: 'shout' }, at(0, 3));
  const denied = await request({
    op: 'action',
    ...a,
    action: { type: 'shout' },
    actionId: randomUUID(),
  });
  check(
    'sayings_are_shared_and_rate_limited',
    first.world.notice.by === a.id && denied.status === 400,
  );
  await action(b, { type: 'horn' }, at(7.5, -4.5));
  const other = await request({ op: 'sync', ...a });
  check(
    'truck_horn_is_a_shared_event',
    other.snapshot.world.notice.kind === 'horn',
  );
  console.log(
    JSON.stringify({
      checks: count,
      passed: count,
      room: a.code,
      url: `${base}/first-person?raum=${a.code}`,
      parts: 17,
    }),
  );
} finally {
  for (const s of sessions) {
    const r = await request({ op: 'leave', ...s });
    assert.equal(r.status, 200, 'test helper leaves');
  }
}
