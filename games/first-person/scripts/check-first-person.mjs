import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
const BASE = (process.argv[2] || 'http://localhost:3102').replace(/\/$/, '');
const FP = '/api/handwerker/first-person/rooms';
const sessions = [],
  checks = [],
  statusCounts = {};
let requests = 0,
  finalSnapshot;
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
const atProject = { x: 0, y: 1.8, z: 1, yaw: 0, pitch: 0 };
const placement = (x, y = 0.245) => ({ x, y, z: 0, rotation: 0 });
function check(name, ok, detail = {}) {
  checks.push({ name, ok, ...detail });
  console.log(JSON.stringify({ name, ok, ...detail }));
}
async function req(body, path = FP, origin = BASE) {
  requests++;
  const headers = { 'Content-Type': 'application/json' };
  if (origin !== null) headers.Origin = origin;
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }
  return { status: r.status, data };
}
async function create(path, name) {
  const r = await req({ op: 'create', name }, path);
  if (r.status !== 200)
    throw new Error('create ' + path + ': ' + JSON.stringify(r));
  const s = { ...r.data.session, path };
  sessions.push(s);
  return s;
}
async function join(code, name) {
  const r = await req({ op: 'join', code, name });
  if (r.status !== 200) throw new Error('join: ' + JSON.stringify(r));
  const s = { ...r.data.session, path: FP };
  sessions.push(s);
  return s;
}
async function sync(s, position) {
  const r = await req(
    { op: 'sync', code: s.code, id: s.id, token: s.token, position },
    s.path,
  );
  if (r.status !== 200) throw new Error('sync ' + JSON.stringify(r));
  return r.data.snapshot;
}
async function act(s, action, position, actionId = randomUUID()) {
  return req(
    {
      op: 'action',
      code: s.code,
      id: s.id,
      token: s.token,
      action,
      position,
      actionId,
    },
    s.path,
  );
}
function require200(r, label) {
  if (r.status !== 200) throw new Error(label + ': ' + JSON.stringify(r));
  return r.data.snapshot;
}
const inventory = (s, w) => w.inventories[s.id];
const total = (w, key) =>
  Object.values(w.inventories).reduce((a, v) => a + v[key], 0);
const digest = (w) =>
  createHash('sha256').update(JSON.stringify(w)).digest('hex');
try {
  const A = await create(FP, 'QA-A');
  const joined = await Promise.all(
    ['QA-B', 'QA-C', 'QA-D'].map((n) => join(A.code, n)),
  );
  const [B, C, D] = joined,
    four = [A, B, C, D];
  let snap = await sync(A);
  check(
    'four_players_same_room',
    snap.players.length === 4 &&
      new Set(snap.players.map((p) => p.color)).size === 4,
    { players: snap.players.length, slots: snap.players.map((p) => p.color) },
  );
  const fifth = await req({ op: 'join', code: A.code, name: 'QA-fifth' });
  check('fifth_player_blocked', fifth.status === 409, {
    status: fifth.status,
    error: fifth.data.error,
  });
  const preAuth = await sync(A);
  const auth = await Promise.all([
    req({ op: 'sync', code: A.code }),
    req({
      op: 'action',
      code: A.code,
      id: A.id,
      token: 'invalid',
      action: { type: 'supply', station: 'brick' },
      position: stations.brick,
      actionId: randomUUID(),
    }),
    req({ op: 'sync', code: A.code, id: A.id, token: B.token }),
    req(
      {
        op: 'action',
        code: A.code,
        id: A.id,
        token: A.token,
        action: { type: 'supply', station: 'brick' },
        position: stations.brick,
        actionId: randomUUID(),
      },
      FP,
      'https://evil.invalid',
    ),
    req({ op: 'create', name: 'QA-evil' }, FP, 'https://evil.invalid'),
    req({ op: 'sync', code: A.code, id: A.id, token: A.token }, FP, null),
  ]);
  const authAfter = await sync(A);
  check(
    'auth_and_origin',
    JSON.stringify(auth.map((r) => r.status)) ===
      JSON.stringify([401, 401, 401, 403, 403, 200]) &&
      digest(preAuth.world) === digest(authAfter.world),
    {
      statuses: auth.map((r) => r.status),
      worldUnchanged: digest(preAuth.world) === digest(authAfter.world),
      noOriginCliAllowed: auth[5].status === 200,
    },
  );
  const distant = await act(
    A,
    { type: 'supply', station: 'cement' },
    atProject,
  );
  check('station_reach_enforced', distant.status === 400, {
    status: distant.status,
    error: distant.data.error,
  });
  const chaos = await create('/api/handwerker/rooms', 'QA-chaos-isolation');
  const isolation = await Promise.all([
    req({ op: 'join', code: chaos.code, name: 'QA-cross' }),
    req({ op: 'sync', code: chaos.code, id: chaos.id, token: chaos.token }),
    req(
      { op: 'join', code: A.code, name: 'QA-reverse' },
      '/api/handwerker/rooms',
    ),
  ]);
  check(
    'room_namespace_isolation',
    isolation.every((r) => r.status === 404),
    { statuses: isolation.map((r) => r.status) },
  );
  const recipe = async (recipient, label) => {
    const pairs = [
      [A, 'cement'],
      [B, 'sand'],
      [C, 'sand'],
      [D, 'water'],
    ];
    const pickups = await Promise.all(
      pairs.map(([s, station]) =>
        act(s, { type: 'supply', station }, stations[station]),
      ),
    );
    pickups.forEach((r, i) => require200(r, label + ' pickup ' + i));
    const carried = await sync(A);
    check(
      label + '_physical_pickups',
      pairs.every(([s, ing]) => inventory(s, carried.world)?.carrying === ing),
      { carrying: pairs.map(([s]) => inventory(s, carried.world)?.carrying) },
    );
    const pours = await Promise.all(
      pairs.map(([s]) => act(s, { type: 'mixer' }, stations.mixer)),
    );
    pours.forEach((r, i) => require200(r, label + ' pour ' + i));
    const filled = await sync(A);
    check(
      label + '_recipe',
      filled.world.mixer.cement === 1 &&
        filled.world.mixer.sand === 2 &&
        filled.world.mixer.water === 1 &&
        pairs.every(([s]) => inventory(s, filled.world).carrying === null),
      {
        ingredients: {
          cement: filled.world.mixer.cement,
          sand: filled.world.mixer.sand,
          water: filled.world.mixer.water,
        },
        pourStatuses: pours.map((r) => r.status),
      },
    );
    const started = require200(
      await act(recipient, { type: 'mixer' }, stations.mixer),
      label + ' start',
    );
    const early = await act(recipient, { type: 'mixer' }, stations.mixer);
    check(
      label + '_wait_required',
      started.world.mixer.readyAt - started.world.mixer.started === 6500 &&
        early.status === 400,
      {
        mixMs: started.world.mixer.readyAt - started.world.mixer.started,
        earlyStatus: early.status,
        error: early.data.error,
      },
    );
    await new Promise((r) =>
      setTimeout(
        r,
        Math.max(0, started.world.mixer.readyAt - started.now) + 120,
      ),
    );
    const ready = require200(
      await act(recipient, { type: 'mixer' }, stations.mixer),
      label + ' collect',
    );
    check(
      label + '_mortar_collected',
      inventory(recipient, ready.world).mortar === 24 &&
        ready.world.mixer.remaining === 0,
      {
        mortar: inventory(recipient, ready.world).mortar,
        remaining: ready.world.mixer.remaining,
        batches: ready.world.mixer.batches,
      },
    );
  };
  await recipe(A, 'batch1');
  await recipe(B, 'batch2');
  (
    await Promise.all(
      [A, B].map((s) =>
        act(s, { type: 'supply', station: 'brick' }, stations.brick),
      ),
    )
  ).forEach((r) => require200(r, 'brick supply'));
  let before = await sync(A);
  require200(
    await act(A, { type: 'mortar', placement: placement(-1) }, atProject),
    'A mortar',
  );
  require200(
    await act(
      B,
      { type: 'place', kind: 'brick', placement: placement(-1) },
      atProject,
    ),
    'B brick',
  );
  require200(
    await act(B, { type: 'mortar', placement: placement(-0.5) }, atProject),
    'B mortar',
  );
  snap = require200(
    await act(
      A,
      { type: 'place', kind: 'brick', placement: placement(-0.5) },
      atProject,
    ),
    'A brick',
  );
  check(
    'two_helpers_alternate_mortar_and_bricks',
    snap.world.parts.length === 2 &&
      snap.world.parts.every((p) => p.bonded) &&
      snap.world.beds.length === 0 &&
      new Set(snap.world.parts.map((p) => p.by)).size === 2,
    {
      parts: snap.world.parts.length,
      bonded: snap.world.parts.filter((p) => p.bonded).length,
      mortarSpent: total(before.world, 'mortar') - total(snap.world, 'mortar'),
      bricksSpent: total(before.world, 'bricks') - total(snap.world, 'bricks'),
    },
  );
  before = await sync(A);
  const mortarRace = await Promise.all(
    [A, B].map((s) =>
      act(s, { type: 'mortar', placement: placement(0) }, atProject),
    ),
  );
  snap = await sync(A);
  check(
    'concurrent_mortar_same_location',
    mortarRace.filter((r) => r.status === 200).length === 1 &&
      mortarRace.filter((r) => r.status === 400).length === 1 &&
      snap.world.beds.length === 1 &&
      total(before.world, 'mortar') - total(snap.world, 'mortar') === 1,
    {
      statuses: mortarRace.map((r) => r.status),
      beds: snap.world.beds.length,
      mortarSpent: total(before.world, 'mortar') - total(snap.world, 'mortar'),
    },
  );
  before = snap;
  const brickRace = await Promise.all(
    [A, B].map((s) =>
      act(
        s,
        { type: 'place', kind: 'brick', placement: placement(0) },
        atProject,
      ),
    ),
  );
  snap = await sync(A);
  check(
    'concurrent_brick_same_location',
    brickRace.filter((r) => r.status === 200).length === 1 &&
      brickRace.filter((r) => r.status === 400).length === 1 &&
      snap.world.parts.length - before.world.parts.length === 1 &&
      total(before.world, 'bricks') - total(snap.world, 'bricks') === 1,
    {
      statuses: brickRace.map((r) => r.status),
      partsAdded: snap.world.parts.length - before.world.parts.length,
      bricksSpent: total(before.world, 'bricks') - total(snap.world, 'bricks'),
    },
  );
  before = snap;
  const mId = randomUUID();
  const duplicateMortar = await Promise.all(
    [0, 1].map(() =>
      act(A, { type: 'mortar', placement: placement(0.5) }, atProject, mId),
    ),
  );
  snap = await sync(A);
  check(
    'replayed_mortar_action_idempotent',
    duplicateMortar.every((r) => r.status === 200) &&
      snap.version - before.version === 1 &&
      total(before.world, 'mortar') - total(snap.world, 'mortar') === 1,
    {
      statuses: duplicateMortar.map((r) => r.status),
      versionDelta: snap.version - before.version,
      mortarSpent: total(before.world, 'mortar') - total(snap.world, 'mortar'),
    },
  );
  before = snap;
  const bId = randomUUID();
  const duplicateBrick = await Promise.all(
    [0, 1].map(() =>
      act(
        B,
        { type: 'place', kind: 'brick', placement: placement(0.5) },
        atProject,
        bId,
      ),
    ),
  );
  snap = await sync(A);
  check(
    'replayed_brick_action_idempotent',
    duplicateBrick.every((r) => r.status === 200) &&
      snap.version - before.version === 1 &&
      snap.world.parts.length - before.world.parts.length === 1 &&
      total(before.world, 'bricks') - total(snap.world, 'bricks') === 1,
    {
      statuses: duplicateBrick.map((r) => r.status),
      versionDelta: snap.version - before.version,
      partsAdded: snap.world.parts.length - before.world.parts.length,
      bricksSpent: total(before.world, 'bricks') - total(snap.world, 'bricks'),
    },
  );
  before = snap;
  const distinctMortar = await Promise.all(
    [
      [A, 1],
      [B, 1.5],
    ].map(([s, x]) =>
      act(s, { type: 'mortar', placement: placement(x) }, atProject),
    ),
  );
  distinctMortar.forEach((r) => require200(r, 'different location mortar'));
  const distinctBricks = await Promise.all(
    [
      [A, 1],
      [B, 1.5],
    ].map(([s, x]) =>
      act(
        s,
        { type: 'place', kind: 'brick', placement: placement(x) },
        atProject,
      ),
    ),
  );
  distinctBricks.forEach((r) => require200(r, 'different location brick'));
  snap = await sync(A);
  check(
    'parallel_different_locations_no_lost_updates',
    snap.world.parts.length - before.world.parts.length === 2 &&
      snap.version - before.version === 4 &&
      total(before.world, 'mortar') - total(snap.world, 'mortar') === 2 &&
      total(before.world, 'bricks') - total(snap.world, 'bricks') === 2,
    {
      partsAdded: snap.world.parts.length - before.world.parts.length,
      versionDelta: snap.version - before.version,
    },
  );
  require200(
    await act(
      A,
      { type: 'mortar', placement: placement(-1, 0.495) },
      atProject,
    ),
    'upper mortar',
  );
  snap = require200(
    await act(
      B,
      { type: 'place', kind: 'brick', placement: placement(-1, 0.495) },
      atProject,
    ),
    'upper brick',
  );
  const support = snap.world.parts.find((p) => p.x === -1 && p.y === 0.245);
  const protectedRemoval = await act(
    A,
    { type: 'remove', id: support.id },
    atProject,
  );
  const floating = await act(
    A,
    { type: 'place', kind: 'brick', placement: placement(2, 1.245) },
    atProject,
  );
  check(
    'support_and_removal_rules',
    protectedRemoval.status === 400 && floating.status === 400,
    {
      removalStatus: protectedRemoval.status,
      removalError: protectedRemoval.data.error,
      floatingStatus: floating.status,
      floatingError: floating.data.error,
    },
  );
  const beforeReload = await sync(A);
  const reloaded = await Promise.all(four.map((s) => sync(s)));
  check(
    'reload_same_saved_session_and_shared_state',
    reloaded.every(
      (s) =>
        s.version === beforeReload.version &&
        digest(s.world) === digest(beforeReload.world) &&
        s.players.length === 4,
    ),
    {
      versions: reloaded.map((s) => s.version),
      parts: beforeReload.world.parts.length,
      bonded: beforeReload.world.parts.filter((p) => p.bonded).length,
      beds: beforeReload.world.beds.length,
      totalBricks: total(beforeReload.world, 'bricks'),
      totalMortar: total(beforeReload.world, 'mortar'),
      batches: beforeReload.world.mixer.batches,
      worldHash: digest(beforeReload.world),
    },
  );
  finalSnapshot = beforeReload;
} catch (error) {
  check('fatal', false, { error: String(error) });
} finally {
  for (const s of sessions) {
    try {
      const r = await req(
        { op: 'leave', code: s.code, id: s.id, token: s.token },
        s.path,
      );
      check('cleanup_leave_' + s.path, r.status === 200 && r.data.ok === true, {
        status: r.status,
      });
    } catch (error) {
      check('cleanup_leave_failed', false, { error: String(error) });
    }
  }
  console.log(
    JSON.stringify({
      summary: {
        checks: checks.length,
        passed: checks.filter((c) => c.ok).length,
        failed: checks.filter((c) => !c.ok).length,
        requests,
        statusCounts,
        testSessions: sessions.length,
        finalVersion: finalSnapshot?.version,
        finalParts: finalSnapshot?.world.parts.length,
      },
    }),
  );
  if (checks.some((c) => !c.ok)) process.exitCode = 1;
}
