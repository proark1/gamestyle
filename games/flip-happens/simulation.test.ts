import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceWorld,
  bank,
  canBank,
  daySeed,
  flipAction,
  freshWorld,
  launch,
  snapshot,
} from './simulation';
import {
  CHARGE_MS,
  DAILY_MS,
  MATCH_MS,
  OBJECTS,
  TABLE,
  cleanInput,
  type Prop,
  type World,
} from './types';
import { FlipControls } from './controls';

function setup(daily = false) {
  const w = freshWorld(Date.UTC(2026, 8, 24));
  for (const p of w.players) p.bot = false;
  if (daily) {
    for (const p of w.players.slice(1)) p.bot = true;
    flipAction(w, w.players[0].id, { type: 'mode', mode: 'daily' }, true);
  }
  flipAction(w, w.players[0].id, { type: 'start' }, true);
  return { w, p: w.players[0] };
}
function advance(w: World, ms: number) {
  for (let i = 0; i < ms; i += 50)
    advanceWorld(w, w.clock + Math.min(50, ms - i));
}
function landed(w: World, owner: string, object = 0, x = 0, z = 0): Prop {
  return {
    id: ++w.nextProp,
    owner,
    chain: 0,
    object,
    born: w.clock,
    x,
    y: TABLE.y + OBJECTS[object].height / 2,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    angle: 0,
    spin: 0,
    state: 'landed',
    scored: true,
    banked: false,
  };
}

void test('every object lands upright at its gold timing on a level table', () => {
  for (let i = 0; i < OBJECTS.length; i++) {
    const { w, p } = setup();
    p.selected = i;
    p.aimX = p.aimZ = 0;
    assert.ok(launch(w, p, OBJECTS[i].ideal));
    advance(w, 1300);
    assert.equal(p.lands, 1, OBJECTS[i].id);
    assert.equal(p.pending, OBJECTS[i].points);
    assert.equal(p.score, 0);
  }
});
void test('late release busts the pending combo but never takes banked points', () => {
  const { w, p } = setup();
  p.score = 70;
  p.pending = 40;
  p.combo = 2;
  launch(w, p, 1);
  advance(w, 1600);
  assert.equal(p.pending, 0);
  assert.equal(p.combo, 0);
  assert.equal(p.score, 70);
  assert.equal(p.busts, 1);
});
void test('banking is idempotent, retires the chain and waits for airborne props', () => {
  const { w, p } = setup();
  p.aimX = p.aimZ = 0;
  launch(w, p, OBJECTS[0].ideal);
  advance(w, 1300);
  assert.ok(bank(w, p));
  assert.equal(p.score, 10);
  assert.equal(p.chain, 1);
  assert.equal(bank(w, p), false);
  assert.equal(p.score, 10);
  p.pending = 20;
  p.combo = 2;
  launch(w, p, OBJECTS[0].ideal);
  assert.equal(canBank(w, p), false);
  assert.equal(bank(w, p), false);
});
void test('combos multiply successive landings without allowing duplicate flight scores', () => {
  const { w, p } = setup();
  p.aimX = p.aimZ = 0;
  for (let i = 0; i < 3; i++) {
    launch(w, p, OBJECTS[0].ideal);
    advance(w, 1300);
  }
  assert.equal(p.pending, 60);
  assert.equal(p.combo, 3);
  assert.equal(p.bestCombo, 3);
  advance(w, 1000);
  assert.equal(p.pending, 60);
  bank(w, p);
  assert.equal(p.score, 60);
});
void test('the displayed combo and scoring multiplier both stop at eight', () => {
  const { w, p } = setup();
  p.combo = 8;
  p.pending = 360;
  p.aimX = p.aimZ = 0;
  launch(w, p, OBJECTS[0].ideal);
  advance(w, 1300);
  assert.equal(p.combo, 8);
  assert.equal(p.pending, 440);
  assert.equal(p.bestCombo, 8);
});
void test('a heavy landing launches nearby props and tips the table', () => {
  const { w, p } = setup();
  const victim = w.players[1];
  victim.pending = 10;
  victim.combo = 1;
  w.props.push(landed(w, victim.id, 0, 1.6, 0));
  p.selected = 5;
  p.aimX = 1;
  p.aimZ = 0;
  launch(w, p, OBJECTS[5].ideal);
  advance(w, 1250);
  const kicked = w.props.find((o) => o.owner === victim.id)!;
  assert.ok(kicked.vy !== 0 || kicked.state !== 'landed');
  assert.ok(Math.abs(w.table.z) + Math.abs(w.table.vz) > 0.01);
  assert.ok(w.events.some((e) => e.kind === 'impact'));
});
void test('falling off breaks an unbanked chain exactly once, secured props cannot break a new chain', () => {
  const { w, p } = setup();
  p.pending = 50;
  p.combo = 2;
  const o = landed(w, p.id, 0, TABLE.x + 0.1, 0);
  w.props.push(o);
  advance(w, 100);
  assert.equal(p.pending, 0);
  assert.equal(p.busts, 1);
  p.pending = 30;
  p.combo = 1;
  advance(w, 300);
  assert.equal(p.pending, 30);
  assert.equal(p.busts, 1);
});
void test('release uses host time, ignores a forged power and never throws without a charge', () => {
  const { w, p } = setup();
  flipAction(w, p.id, { type: 'throw', power: OBJECTS[0].ideal }, false);
  assert.equal(p.throws, 0);
  flipAction(w, p.id, { type: 'charge' }, false);
  advance(w, CHARGE_MS * OBJECTS[0].ideal);
  flipAction(w, p.id, { type: 'throw', power: 0 }, false);
  advance(w, 1400);
  assert.equal(p.lands, 1);
  assert.equal(p.throws, 1);
});
void test('cancel and abandoned charges cannot produce a late surprise throw', () => {
  const { w, p } = setup();
  flipAction(w, p.id, { type: 'charge' }, false);
  advance(w, 3000);
  assert.equal(p.chargingAt, null);
  flipAction(w, p.id, { type: 'throw' }, false);
  assert.equal(p.throws, 0);
  flipAction(w, p.id, { type: 'charge' }, false);
  flipAction(w, p.id, { type: 'cancel' }, false);
  flipAction(w, p.id, { type: 'throw' }, false);
  assert.equal(p.throws, 0);
});
void test('daily mode repeats the UTC seed, object sequence and scheduled nudges, without bot throws', () => {
  const a = setup(true),
    b = setup(true);
  assert.equal(a.w.duration, DAILY_MS);
  assert.equal(a.w.day, '2026-09-24');
  assert.notEqual(daySeed('2026-09-24'), daySeed('2026-09-25'));
  for (const { w, p } of [a, b]) {
    launch(w, p, 0);
    advance(w, 2000);
    assert.equal(p.selected, 1);
    flipAction(w, p.id, { type: 'select', object: 5 }, true);
    assert.equal(p.selected, 1);
    advance(w, 8000);
    assert.ok(w.players.slice(1).every((q) => q.throws === 0));
  }
  assert.deepEqual(a.w, b.w);
});
void test('only host starts rounds; daily challenge cannot begin with multiple humans', () => {
  const w = freshWorld(1000),
    p = w.players[0];
  assert.throws(() => flipAction(w, p.id, { type: 'start' }, false));
  p.bot = w.players[1].bot = false;
  assert.throws(() =>
    flipAction(w, p.id, { type: 'mode', mode: 'daily' }, true),
  );
  flipAction(w, p.id, { type: 'start' }, true);
  assert.equal(w.duration, MATCH_MS);
  assert.throws(() =>
    flipAction(w, p.id, { type: 'mode', mode: 'daily' }, true),
  );
});
void test('deadline banks settled points, ignores unfinished throws, and produces a tie fairly', () => {
  const { w, p } = setup();
  p.pending = 20;
  p.combo = 2;
  w.players[1].score = 20;
  w.started = w.clock - MATCH_MS + 100;
  launch(w, p, OBJECTS[0].ideal);
  advance(w, 200);
  assert.equal(w.phase, 'ended');
  assert.equal(p.score, 20);
  assert.equal(p.lands, 0);
  assert.equal(w.winner, 'draw');
  const points = p.score;
  advance(w, 2000);
  assert.equal(p.score, points);
});
void test('rematch clears table motion, risk and objects while retaining the human roster', () => {
  const { w, p } = setup();
  p.name = 'Player';
  p.pending = 90;
  p.score = 50;
  launch(w, p, 0.6);
  w.phase = 'ended';
  w.table.vx = 1;
  flipAction(w, p.id, { type: 'reset' }, true);
  assert.equal(p.name, 'Player');
  assert.equal(p.bot, false);
  assert.equal(p.score, 0);
  assert.equal(p.pending, 0);
  assert.equal(w.props.length, 0);
  assert.equal(w.table.vx, 0);
});
void test('input and object selection reject nonfinite or out-of-range values', () => {
  assert.deepEqual(cleanInput({ x: Infinity, z: -5, aimX: 900, aimZ: NaN }), {
    x: 0,
    z: -1,
    aimX: TABLE.x - 0.8,
    aimZ: null,
  });
  const { w, p } = setup();
  for (const object of [-1, 6, 1.2, Infinity, 'washer'])
    assert.throws(() => flipAction(w, p.id, { type: 'select', object }, false));
  const controls = new FlipControls();
  controls.aim(2, 1);
  controls.key('KeyD', true);
  assert.equal(controls.read().aimX, null);
  assert.equal(controls.read().x, 1);
  controls.clear();
  assert.equal(controls.read().x, 0);
});
void test('complete bot rounds remain finite and bounded and snapshots cannot mutate the host', () => {
  const w = freshWorld(1000);
  flipAction(w, w.players[0].id, { type: 'start' }, true);
  for (let i = 0; i < 1250; i++) {
    advanceWorld(w, w.clock + 100);
    assert.ok(w.props.length <= 32);
    assert.ok(w.events.length <= 32);
  }
  assert.equal(w.phase, 'ended');
  assert.ok(w.players.every((p) => p.throws > 10 && p.lands > 0));
  assert.ok(w.players.some((p) => p.score > 0));
  function finite(value: unknown) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value));
    else if (value && typeof value === 'object')
      for (const v of Object.values(value)) finite(v);
  }
  finite(w);
  const s = snapshot(w, 'TEST', 'host', 'self', 0);
  s.world.players[0].score = -1;
  assert.ok(w.players[0].score >= 0);
  assert.ok(Math.abs(w.table.x) <= 0.2 && Math.abs(w.table.z) <= 0.2);
});
