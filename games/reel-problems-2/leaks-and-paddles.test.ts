import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceReel, freshReel, newAngler, reelAction } from './simulation';
import { createEngine } from './peer';
import { freshWildlife } from './chaos';
import {
  BOAT_HALF,
  BUCKET,
  CATCHES,
  DOCK,
  DOCK_RESCUE_MS,
  DOWNED_PENALTY,
  HULL_HALF,
  LEAK_FIRST_MS,
  LEAK_GAP_MS,
  MOORING,
  type ReelWorld,
} from './types';

/** A calm, empty lake, so each test brings only the trouble it is about. */
function crew(count = 1) {
  const w = freshReel(100_000);
  for (let i = 0; i < count; i++)
    w.players.push(newAngler(String(i), `Angler ${i}`, i, w.clock));
  reelAction(w, '0', { type: 'start' }, '0');
  w.fish = [];
  w.wildlife = [];
  w.debris = [];
  w.weather.until = w.clock + 900_000;
  w.leakDueAt = Number.MAX_SAFE_INTEGER;
  for (const p of w.players) p.recoveredAt = w.clock - 3000;
  return w;
}
function tick(w: ReelWorld, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 20); i++)
    advanceReel(w, w.clock + 50);
}
/** Past the quiet opening, where leaks are allowed. */
function midRound(count = 1) {
  const w = crew(count);
  w.started -= LEAK_FIRST_MS + 1000;
  w.leakReadyAt = w.clock;
  return w;
}
/** A leak sprung on a known plank, away from the bucket. */
function leaking(count = 1) {
  const w = midRound(count);
  w.leakDueAt = w.clock;
  tick(w, 0.05);
  assert.ok(w.leak, 'a due leak springs');
  w.leak.x = 1.5;
  w.leak.z = -2;
  w.leakDueAt = Number.MAX_SAFE_INTEGER;
  return w;
}
function standOnLeak(w: ReelWorld, ...ids: string[]) {
  for (const p of w.players.filter((p) => ids.includes(p.id))) {
    p.x = w.leak!.x;
    p.z = w.leak!.z;
    p.input.reel = true;
  }
}

void test('One angler holding E patches a leak in five seconds; two take about three', () => {
  for (const [count, seconds] of [
    [1, 5],
    [2, 3.03],
  ] as const) {
    const w = leaking(count);
    standOnLeak(w, ...w.players.map((p) => p.id));
    tick(w, seconds - 0.3);
    assert.ok(w.leak, `${count}: still open just before`);
    tick(w, 0.5);
    assert.equal(w.leak, null, `${count}: patched`);
    assert.ok(w.events.some((e) => e.kind === 'patched'));
  }
});

void test('On the leak, E patches instead of reeling; stepping off lets it slip back slowly', () => {
  const w = leaking(),
    p = w.players[0];
  const perch = freshReel(w.clock).fish.find((f) => f.kind === 'perch')!;
  perch.x = 9;
  perch.z = 2;
  w.fish = [perch];
  reelAction(w, p.id, { type: 'cast', x: perch.x, z: perch.z }, p.id);
  tick(w, 0.6);
  assert.equal(p.line?.kind, 'fish');
  standOnLeak(w, p.id);
  const length = p.line!.length;
  tick(w, 2.5);
  assert.ok(p.line!.length >= length, 'the line was not wound in');
  const banked = w.leak!.patch;
  assert.ok(banked > 0.4, `patching (${banked})`);
  p.x = 0;
  p.z = 2;
  tick(w, 1);
  assert.ok(
    w.leak!.patch < banked && w.leak!.patch > banked - 0.15,
    `slips back slowly (${w.leak!.patch})`,
  );
});

void test('Left alone, a leak pours in at ten seconds and sinks the boat at twenty, crew, lines and gear', () => {
  const w = leaking(2);
  w.gear.tire = true;
  reelAction(w, '1', { type: 'cast', x: 10, z: 0 }, '0');
  tick(w, 9.8);
  assert.ok(!w.events.some((e) => e.kind === 'flooding'));
  tick(w, 0.4);
  assert.ok(
    w.events.some((e) => e.kind === 'flooding'),
    'pouring at ten',
  );
  tick(w, 9.2);
  assert.equal(w.boat.sunk, false, 'still afloat at nineteen');
  tick(w, 0.9);
  assert.equal(w.boat.sunk, true, 'under at twenty');
  assert.ok(w.events.some((e) => e.kind === 'sink'));
  assert.equal(w.sinks, 1);
  for (const p of w.players) {
    assert.equal(p.swimming, true);
    assert.equal(p.line, null);
    assert.equal(p.splashes, 1);
  }
  assert.deepEqual(w.gear, { tire: false, magnet: false, boot: false });
  assert.equal(
    w.wildlife.filter((v) => v.wreck && v.activeUntil > w.clock).length,
    2,
    'two sharks come for the wreck',
  );
});

void test('A late patch while it pours saves the boat, which stays heavy until bailed', () => {
  const w = leaking(2),
    [patcher, bailer] = w.players;
  tick(w, 14);
  standOnLeak(w, patcher.id);
  tick(w, 5.2);
  assert.equal(w.leak, null, 'patched in time');
  assert.equal(w.boat.sunk, false);
  assert.ok(w.boat.flood > 0.8, `still full of water (${w.boat.flood})`);
  patcher.input.reel = false;
  const full = w.boat.flood;
  tick(w, 4);
  const drained = full - w.boat.flood;
  bailer.x = BUCKET.x;
  bailer.z = BUCKET.z;
  bailer.input.reel = true;
  const before = w.boat.flood;
  tick(w, 4);
  assert.ok(
    before - w.boat.flood > drained * 2,
    `bailing empties it faster (${drained} alone, ${before - w.boat.flood} bailing)`,
  );
});

void test('Bailing from the start buys time before the boat goes under', () => {
  const plain = leaking(),
    bailed = leaking();
  const p = bailed.players[0];
  p.x = BUCKET.x;
  p.z = BUCKET.z;
  p.input.reel = true;
  tick(plain, 20.5);
  tick(bailed, 20.5);
  assert.equal(plain.boat.sunk, true);
  assert.equal(bailed.boat.sunk, false);
  assert.ok(bailed.boat.flood < 0.8, `${bailed.boat.flood}`);
});

void test('After a sink, the first swimmer to reach the dock takes out a new boat', () => {
  const w = leaking(2);
  tick(w, 20.5);
  assert.equal(w.boat.sunk, true);
  w.wildlife = [];
  const [runner, floater] = w.players;
  runner.x = DOCK.x + 0.5;
  runner.z = DOCK.z - 3;
  runner.input.z = 1;
  tick(w, 1);
  assert.equal(w.boat.sunk, false);
  assert.equal(runner.swimming, false, 'the runner is aboard');
  assert.ok(
    Math.hypot(w.boat.x - MOORING.x, w.boat.z - MOORING.z) < 0.3,
    'the new boat waits at the dock',
  );
  assert.deepEqual(
    { flood: w.boat.flood, hull: w.boat.hull },
    {
      flood: 0,
      hull: 1,
    },
  );
  assert.ok(w.events.some((e) => e.kind === 'launch'));
  assert.equal(floater.swimming, true);
  assert.ok(
    w.clock - floater.overboardAt < 1500,
    'the safety rope starts counting from the new boat',
  );
});

void test('If nobody reaches the dock the harbour master launches one, and a pulled-under angler waits for it', () => {
  const w = leaking(),
    p = w.players[0];
  tick(w, 20.5);
  w.wildlife = [];
  p.health = 0;
  p.downedUntil = w.clock + 1000;
  tick(w, 5);
  assert.equal(p.swimming, true, 'nobody to haul them out yet');
  w.score = 50;
  tick(w, DOCK_RESCUE_MS / 1000 - 5);
  assert.equal(w.boat.sunk, false, 'a new boat came out');
  assert.equal(p.swimming, false, 'and the downed angler was hauled aboard');
  assert.equal(w.score, 50 - DOWNED_PENALTY);
});

void test('Leaks wait out the opening, the closing stretch and the gap after the last one', () => {
  const early = crew();
  early.leakReadyAt = early.leakDueAt = 0;
  tick(early, 1);
  assert.equal(early.leak, null, 'not in the first 45 seconds');
  const late = crew();
  late.started -= 285_000;
  late.leakReadyAt = late.leakDueAt = 0;
  tick(late, 1);
  assert.equal(late.leak, null, 'not in the last 30 seconds');
  const w = leaking();
  standOnLeak(w, '0');
  tick(w, 5.2);
  assert.equal(w.leak, null);
  w.players[0].input.reel = false;
  w.leakDueAt = 0;
  tick(w, LEAK_GAP_MS / 1000 - 2);
  assert.equal(w.leak, null, 'not straight after the last one');
  tick(w, 3);
  assert.ok(w.leak, 'but once the gap has passed');
});

void test('Paddles come from the rail, one per side, and keep hands off the rod', () => {
  const w = crew(2),
    [a, b] = w.players;
  a.x = 0;
  assert.throws(() => reelAction(w, '0', { type: 'paddle' }, '0'), /rail/);
  tick(w, 0.3);
  a.x = -BOAT_HALF.x;
  reelAction(w, '0', { type: 'paddle' }, '0');
  assert.equal(a.paddle, -1);
  b.x = -BOAT_HALF.x + 0.2;
  assert.throws(() => reelAction(w, '1', { type: 'paddle' }, '0'), /port/);
  tick(w, 0.3);
  assert.throws(
    () => reelAction(w, '0', { type: 'cast', x: -10, z: 0 }, '0'),
    /paddle/,
  );
  b.x = 1;
  reelAction(w, '1', { type: 'cast', x: 10, z: 0 }, '0');
  tick(w, 0.3);
  b.x = BOAT_HALF.x;
  assert.throws(() => reelAction(w, '1', { type: 'paddle' }, '0'), /line/);
  tick(w, 0.3);
  reelAction(w, '0', { type: 'jump' }, '0');
  assert.equal(a.paddle, 0, 'jumping drops the paddle');
});

void test('A lone paddler swings the bow away from their rail; one on each rail goes straight', () => {
  const lone = crew(),
    p = lone.players[0];
  p.x = -BOAT_HALF.x;
  reelAction(lone, p.id, { type: 'paddle' }, p.id);
  p.input.z = -1;
  tick(lone, 3);
  assert.ok(
    lone.boat.yaw < -0.3,
    `a port paddle turns the bow to starboard (${lone.boat.yaw})`,
  );
  assert.ok(Math.hypot(lone.boat.x, lone.boat.z) > 1.5, 'while moving');
  const pair = crew(2);
  pair.players[0].x = -BOAT_HALF.x;
  pair.players[1].x = BOAT_HALF.x;
  for (const q of pair.players) {
    reelAction(pair, q.id, { type: 'paddle' }, '0');
    q.input.z = -1;
  }
  tick(pair, 3);
  assert.ok(Math.abs(pair.boat.yaw) < 0.05, `straight (${pair.boat.yaw})`);
  assert.ok(pair.boat.z < -2.5, `toward the bow (${pair.boat.z})`);
  for (const q of pair.players) q.input.z = 1;
  tick(pair, 6);
  assert.ok(pair.boat.vz > 0.5, 'back strokes reverse it');
});

void test('Ramming driftwood at speed cracks a plank; drifting into it only nudges it', () => {
  for (const fast of [true, false]) {
    const w = midRound();
    w.leakDueAt = Number.MAX_SAFE_INTEGER;
    w.boat.vz = fast ? -2.5 : -0.4;
    w.debris = [
      {
        id: 'log-test',
        x: 0,
        z: -HULL_HALF.z - 0.9,
        vx: 0,
        vz: 0,
        angle: Math.PI / 2,
        bumpAt: 0,
      },
    ];
    tick(w, fast ? 0.5 : 2);
    if (fast) {
      assert.ok(w.leak, 'a hard ram cracks a plank');
      assert.ok(w.events.some((e) => e.text.includes('log')));
    } else {
      assert.equal(w.leak, null, 'a gentle bump does not');
      assert.ok(w.debris[0].z < -HULL_HALF.z - 0.9, 'the log is pushed on');
    }
  }
});

void test('A seagull steals a landed catch unless someone jumps while it dives', () => {
  for (const scare of [false, true]) {
    const w = crew(2);
    const gull = freshWildlife(w.clock).find((v) => v.kind === 'gull')!;
    gull.activeUntil = w.clock + 60_000;
    gull.x = 4;
    w.wildlife = [gull];
    const perch = freshReel(w.clock).fish.find((f) => f.kind === 'perch')!;
    perch.x = 6;
    perch.z = 1;
    perch.stamina = 0;
    w.fish = [perch];
    reelAction(w, '0', { type: 'cast', x: perch.x, z: perch.z }, '0');
    for (let i = 0; i < 400 && !w.pending; i++) {
      w.players[0].input.reel = true;
      advanceReel(w, w.clock + 50);
    }
    assert.ok(w.pending, 'the gull stoops for the catch');
    assert.equal(w.score, 0);
    if (scare) reelAction(w, '1', { type: 'jump' }, '0');
    tick(w, 2);
    assert.equal(w.pending, null);
    assert.equal(w.score, scare ? CATCHES.perch.value : 0, `scare ${scare}`);
    assert.equal(
      w.events.some((e) => e.kind === 'steal'),
      !scare,
    );
  }
});

void test('A crab pinch beside the rail throws you over it; landing a jump on the crab punts it', () => {
  const w = crew(2),
    [victim, stomper] = w.players;
  victim.x = BOAT_HALF.x - 0.2;
  victim.z = 0;
  w.crab = {
    x: victim.x - 0.3,
    z: 0,
    angle: Math.PI / 2,
    pinchAt: 0,
    until: w.clock + 30_000,
  };
  tick(w, 1.2);
  assert.ok(w.events.some((e) => e.kind === 'pinch'));
  assert.equal(victim.swimming, true, 'pinched over the side');
  assert.equal(victim.splashes, 1, 'and nobody planned that');
  w.crab = {
    x: stomper.x,
    z: stomper.z,
    angle: 0,
    pinchAt: w.clock + 10_000,
    until: w.clock + 30_000,
  };
  reelAction(w, stomper.id, { type: 'jump' }, '0');
  tick(w, 1.2);
  assert.equal(w.crab, null);
  assert.ok(w.events.some((e) => e.kind === 'stomp'));
});

void test('A cannonball stuns small fish nearby, and a hook beside one bites at once', () => {
  const w = crew(2),
    [diver, caster] = w.players;
  const catches = freshReel(w.clock).fish;
  const perch = catches.find((f) => f.kind === 'perch')!,
    pike = catches.find((f) => f.kind === 'pike')!;
  // Out past where the diver surfaces, so the cast hooks the fish, not them.
  perch.x = 8;
  perch.z = 1;
  pike.x = 5.5;
  pike.z = 3;
  w.fish = [perch, pike];
  diver.x = BOAT_HALF.x;
  diver.z = 1;
  diver.input.x = 1;
  reelAction(w, diver.id, { type: 'jump' }, '0');
  tick(w, 0.5);
  diver.input.x = 0;
  assert.equal(diver.swimming, true);
  assert.ok(perch.stunnedUntil > w.clock, 'the perch is knocked silly');
  assert.ok(pike.stunnedUntil <= w.clock, 'the pike shrugs it off');
  assert.ok(w.events.some((e) => e.text.includes('cannonballed')));
  reelAction(w, caster.id, { type: 'cast', x: perch.x, z: perch.z }, '0');
  tick(w, 0.1);
  assert.equal(caster.line?.kind, 'fish', 'bites without the usual wait');
});

void test('An idle tournament with leaks, sinks, gulls and driftwood replays identically', () => {
  const [a, b] = [freshReel(100_000), freshReel(100_000)];
  for (const w of [a, b]) {
    w.players.push(newAngler('0', 'Angler', 0, w.clock));
    reelAction(w, '0', { type: 'start' }, '0');
  }
  for (let i = 0; i < 3000; i++) {
    advanceReel(a, a.clock + 100);
    advanceReel(b, b.clock + 100);
  }
  assert.deepEqual(a, b);
  assert.ok(a.leaks >= 2, `${a.leaks} leaks`);
  assert.ok(a.sinks >= 1, `${a.sinks} sinks`);
});

void test('Checkpoints from before leaks and paddles upgrade and keep running', () => {
  const engine = createEngine(100_000);
  engine.reconcile([
    {
      id: '0',
      name: 'Angler',
      color: 0,
      order: 0,
      instance: 'tab-0',
      seen: 100_000,
    },
  ]);
  engine.execute('0', 'start-1', { type: 'start' }, '0');
  const legacy = JSON.parse(JSON.stringify(engine.checkpoint()));
  for (const key of [
    'leak',
    'leakReadyAt',
    'leakDueAt',
    'leaks',
    'sinks',
    'debris',
    'crab',
    'pending',
  ])
    delete legacy.world[key];
  for (const key of ['flood', 'sunk', 'sunkAt', 'hull'])
    delete legacy.world.boat[key];
  legacy.world.wildlife = legacy.world.wildlife.filter(
    (v: { kind: string }) => v.kind !== 'gull',
  );
  for (const p of legacy.world.players) {
    delete p.paddle;
    delete p.pinched;
    delete p.landedAt;
  }
  for (const f of legacy.world.fish) delete f.stunnedUntil;
  const upgraded = createEngine(200_000, legacy);
  upgraded.advance(50);
  const w = upgraded.world;
  assert.equal(w.boat.flood, 0);
  assert.equal(w.boat.sunk, false);
  assert.equal(w.debris.length, 2);
  assert.ok(w.wildlife.some((v) => v.kind === 'gull'));
  assert.equal(w.players[0].paddle, 0);
  assert.ok(Number.isFinite(w.leakDueAt));
  assert.ok(w.fish.every((f) => f.stunnedUntil === 0));
  assert.deepEqual(upgraded.execute('0', 'paddle-1', { type: 'paddle' }, '0'), {
    error: 'Walk to the rail to take a paddle.',
  });
});
