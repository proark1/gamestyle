import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addBrain,
  advanceBreakfast,
  breakfastAction,
  breakfastSnapshot,
  cupPosition,
  freshBreakfast,
  handPosition,
  platePosition,
  removeBrain,
} from './simulation';
import {
  BREWER,
  FAN,
  ROUND_MS,
  STOVE,
  idleInput,
  type BrainWorld,
  type Vec,
} from './types';
import { createEngine } from './peer';
import { breakfastCatalog } from './audio';

function kitchen(count = 1) {
  const w = freshBreakfast(100000);
  for (let i = 0; i < count; i++) addBrain(w, `p${i}`, `Brain ${i + 1}`, i);
  breakfastAction(w, 'p0', { type: 'start' }, 'p0');
  return w;
}
function tick(w: BrainWorld, ms: number) {
  for (let left = ms; left > 0; left -= 50)
    advanceBreakfast(w, w.clock + Math.min(50, left));
}
function claim(w: BrainWorld, n: number) {
  breakfastAction(w, 'p0', { type: 'claim', limb: n }, 'p0');
}
function reach(w: BrainWorld, pos: Vec) {
  claim(w, 0);
  const p = w.players[0];
  for (let i = 0; i < 500; i++) {
    const h = handPosition(w, 0),
      dx = pos.x - h.x,
      dz = pos.z - h.z,
      dy = pos.y - h.y;
    if (Math.hypot(dx, dy, dz) < 0.09) {
      p.input = idleInput();
      return;
    }
    p.input = {
      ...idleInput(),
      x: Math.max(-1, Math.min(1, dx * 3)),
      z: Math.max(-1, Math.min(1, dz * 3)),
      lift: Math.max(-1, Math.min(1, dy * 3)),
      steady: true,
    };
    tick(w, 50);
  }
  assert.fail(
    `Hand could not reach ${JSON.stringify(pos)} from ${JSON.stringify(handPosition(w, 0))}`,
  );
}
function walk(w: BrainWorld, x: number, z: number) {
  claim(w, 2);
  const p = w.players[0];
  for (let i = 0; i < 1200; i++) {
    const dx = x - w.robot.x,
      dz = z - w.robot.z,
      d = Math.hypot(dx, dz);
    if (d < 0.14) {
      p.input = idleInput();
      tick(w, 600);
      return;
    }
    p.input = {
      ...idleInput(),
      x: dx / Math.max(1, d),
      z: dz / Math.max(1, d),
      steady: d < 0.7,
    };
    tick(w, 50);
    assert.equal(
      w.phase,
      'playing',
      'Route must be possible before breakfast times out',
    );
  }
  assert.fail(`Robot could not reach ${x},${z}; at ${w.robot.x},${w.robot.z}`);
}
const act = (w: BrainWorld, type: 'grab' | 'use') =>
  breakfastAction(w, 'p0', { type }, 'p0');

void test('four players receive distinct limbs and cannot steal a friend’s limb', () => {
  const w = kitchen(4);
  assert.deepEqual(
    w.players.map((p) => p.limb),
    [0, 1, 2, 3],
  );
  assert.throws(
    () => breakfastAction(w, 'p0', { type: 'claim', limb: 1 }, 'p0'),
    /belongs to a friend/,
  );
  for (const n of [-1, 4, NaN, 0.5])
    assert.throws(
      () => breakfastAction(w, 'p0', { type: 'claim', limb: n }, 'p0'),
      /four limbs/,
    );
  assert.throws(() => addBrain(w, 'extra', 'Extra', 0), /occupied/);
  assert.throws(
    () => breakfastAction(w, 'p1', { type: 'restart' }, 'p0'),
    /host/,
  );
});

void test('a solo player completes the entire breakfast using limb inputs, cooking, transport, and pouring', () => {
  const w = kitchen();
  walk(w, -3.5, -2.4);
  reach(w, STOVE);
  act(w, 'grab');
  for (let n = 0; n < 3; n++) {
    if (n) {
      walk(w, -3.5, -2.4);
      reach(w, STOVE);
    }
    act(w, 'use');
    tick(w, 3200);
    act(w, 'use');
    tick(w, 3200);
    assert.equal(w.utensils[0].ready, true);
    walk(w, 1.75, 0.5);
    reach(w, platePosition(w));
    act(w, 'use');
    assert.equal(w.pancakes, n + 1);
  }
  act(w, 'grab'); // Release the empty pan; the other hand is not required for solo.
  walk(w, -3.5, 1.2);
  reach(w, BREWER);
  act(w, 'grab');
  assert.equal(w.limbs[0].held, 'jug');
  walk(w, 3, 2.5);
  reach(w, { ...cupPosition(w), y: 2.25 });
  w.players[0].input.use = true;
  tick(w, 4100);
  assert.equal(w.phase, 'won');
  assert.ok(w.coffee >= 0.98);
  assert.equal(w.falls, 0);
  assert.ok(w.clock - w.started < ROUND_MS);
});

void test('one side burns if ignored; flipping and cooking the second side produces edible pancakes', () => {
  const w = kitchen();
  Object.assign(w.robot, { x: -3.5, z: -2.6 });
  Object.assign(w.limbs[0], { x: -1.9, y: 1.8, z: 0 });
  act(w, 'grab');
  act(w, 'use');
  tick(w, 13000);
  assert.equal(w.utensils[0].fill, 0);
  assert.ok(w.events.some((e) => /charcoal/.test(e.text)));
  act(w, 'use');
  tick(w, 3100);
  act(w, 'use');
  tick(w, 3100);
  assert.equal(w.utensils[0].ready, true);
});

void test('coffee requires the cup and a useful pour height; pouring elsewhere creates a spill', () => {
  const w = kitchen();
  const jug = w.utensils[1];
  jug.held = 0;
  w.limbs[0].held = 'jug';
  w.players[0].input.use = true;
  tick(w, 1000);
  assert.equal(w.coffee, 0);
  assert.ok(jug.fill < 1);
  assert.ok(w.spills.length > 0);
  Object.assign(w.robot, { x: 2.3, z: 2.4 });
  Object.assign(w.limbs[0], { x: 2.3, z: -2.3, y: 2.25 });
  jug.fill = 1;
  tick(w, 3700);
  assert.ok(w.coffee >= 0.98);
});

void test('a leg kick physically displaces the table and spills coffee with visible attribution', () => {
  const w = kitchen(4);
  Object.assign(w.robot, { x: 1.5, z: 0.5 });
  w.coffee = 1;
  breakfastAction(w, 'p3', { type: 'kick' }, 'p0');
  const x = w.table.x;
  tick(w, 350);
  assert.ok(w.table.x > x + 0.5);
  assert.equal(w.coffee, 0.55);
  assert.equal(w.players[3].mishaps, 1);
  assert.match(
    w.events.find((e) => e.kind === 'kick')!.text,
    /Brain 4 \(right foot\)/,
  );
  assert.throws(
    () => breakfastAction(w, 'p0', { type: 'kick' }, 'p0'),
    /Only a foot/,
  );
});

void test('the ceiling fan launches held cookware and the kitchen replaces floor utensils', () => {
  const w = kitchen();
  Object.assign(w.robot, { x: FAN.x, z: FAN.z });
  Object.assign(w.limbs[0], { x: 0, z: 0, y: 4.7, held: 'pan' });
  w.utensils[0].held = 0;
  tick(w, 50);
  assert.equal(w.utensils[0].held, null);
  assert.ok(w.utensils[0].vy > 0);
  assert.equal(w.players[0].mishaps, 1);
  assert.ok(w.events.some((e) => e.kind === 'fan'));
  // A fan toss can land on the counter. Separately verify a floor landing restocks.
  Object.assign(w.utensils[0], { x: 0, z: 2, y: 0.22, vx: 0, vy: 0, vz: 0 });
  tick(w, 5300);
  assert.equal(w.utensils[0].x, STOVE.x);
  assert.equal(w.utensils[0].z, STOVE.z);
});

void test('opposing leg directions cause a tumble while an empty partner foot allows stable solo walking', () => {
  const w = kitchen(4);
  w.players[2].input.x = 1;
  w.players[3].input.x = -1;
  tick(w, 6000);
  assert.ok(w.falls > 0);
  const solo = kitchen();
  claim(solo, 2);
  solo.players[0].input.z = 1;
  tick(solo, 3000);
  assert.ok(solo.robot.z > 2);
  assert.equal(solo.falls, 0);
});

void test('disconnects free only their owned limb and preserve held food for takeover', () => {
  const w = kitchen(4);
  w.limbs[0].held = 'pan';
  w.utensils[0].held = 0;
  w.utensils[0].ready = true;
  removeBrain(w, 'p0');
  assert.equal(w.limbs[0].owner, null);
  assert.equal(w.limbs[0].held, 'pan');
  breakfastAction(w, 'p1', { type: 'claim', limb: 0 }, 'p1');
  assert.equal(w.players[0].limb, 0);
  assert.equal(w.utensils[0].ready, true);
});

void test('the timer expires, snapshots do not leak mutable state, and restart clears the old breakfast', () => {
  const w = kitchen();
  tick(w, ROUND_MS + 50);
  assert.equal(w.phase, 'lost');
  const snap = breakfastSnapshot(w, 'ABC234', 'p0', 'p0', 1);
  snap.world.pancakes = 12;
  assert.equal(w.pancakes, 0);
  breakfastAction(w, 'p0', { type: 'restart' }, 'p0');
  assert.equal(w.phase, 'playing');
  assert.equal(w.clock, w.started);
  assert.equal(w.coffee, 0);
});

void test('fixed steps keep clock time equal to incoming elapsed time', () => {
  const w = kitchen();
  const now = w.clock;
  for (let i = 0; i < 1000; i++) advanceBreakfast(w, w.clock + 13);
  assert.ok(Math.abs(w.clock - now - 13000) < 0.001);
  assert.ok(w.remainder < 1000 / 60);
});

void test('peer input validation, idle expiry and checkpoint recovery release held transient controls', () => {
  const engine = createEngine(100000);
  const members = Array.from({ length: 4 }, (_, i) => ({
    id: `p${i}`,
    name: `Brain ${i}`,
    color: i,
    order: i,
    instance: `instance-${i}`,
    seen: 100000,
  }));
  engine.reconcile(members);
  engine.execute('p0', 'start-1', { type: 'start' }, 'p0');
  engine.input('p0', { x: Infinity, z: 0, lift: 1 }, 1);
  assert.equal(engine.world.players[0].input.x, 0);
  engine.input('p0', { x: 10, z: -10, lift: NaN, use: true, seq: 2 }, 2);
  assert.equal(engine.world.players[0].input.x, 1);
  assert.equal(engine.world.players[0].input.lift, 0);
  const saved = engine.checkpoint();
  const restored = createEngine(200000, saved);
  assert.equal(restored.world.players[0].input.use, false);
  assert.equal(restored.world.players[0].input.x, 0);
  assert.equal(restored.world.started, engine.world.started);
  for (let i = 0; i < 7; i++) engine.advance(100);
  assert.deepEqual(engine.world.players[0].input, idleInput());
  const result = engine.execute(
    'p1',
    'steal',
    { type: 'claim', limb: 0 },
    'p0',
  );
  assert.match(result.error!, /belongs to a friend/);
  assert.deepEqual(
    engine.execute('p1', 'steal', { type: 'claim', limb: 0 }, 'p0'),
    result,
    'actions remain idempotent',
  );
});

void test('every game event has a unique workshop cue within provider prompt limits', () => {
  assert.equal(
    new Set(breakfastCatalog.map((c) => c.id)).size,
    breakfastCatalog.length,
  );
  for (const id of [
    'start',
    'step',
    'grab',
    'flip',
    'pour',
    'serve',
    'spill',
    'kick',
    'fan',
    'fall',
    'finish',
  ])
    assert.ok(breakfastCatalog.some((c) => c.id === `event.${id}`));
  for (const cue of breakfastCatalog) {
    assert.ok(cue.prompt.length <= 450);
    assert.ok(
      cue.duration >= 0.5 &&
        cue.duration <= (cue.category === 'music' ? 120 : 30),
    );
  }
});
