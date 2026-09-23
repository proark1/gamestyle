import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshWorld, startMatch, stepWorld } from './simulation';
import { clearCombat, INPUT_BUFFER, MOVES } from './combat';
import { idleInput, STEP, type World } from './types';
import { guardFist, kickMotion, strikeMotion } from './strike-motion';
import { createEngine } from './peer';
import { compatibility } from '../../shared/peer/protocol';

function fight() {
  const w = freshWorld(1000);
  for (const p of w.players) {
    p.bot = false;
    p.style = 'mma';
  }
  startMatch(w);
  w.phase = 'playing';
  w.players[0].x = -0.6;
  w.players[1].x = 0.6;
  return w;
}
function run(w: World, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) stepWorld(w);
}
void test('a late punch tap survives jab recovery and becomes one cross', () => {
  const w = fight(),
    p = w.players[0];
  p.move = 'jab';
  p.attack = 0.04;
  p.struck = true;
  p.input.punch = true;
  run(w, 0.035);
  p.input.punch = false;
  stepWorld(w);
  assert.equal(p.queuedMove, 'jab');
  run(w, 0.15);
  assert.equal(p.move, 'cross');
  assert.ok(p.attack > 0);
  assert.equal(p.punches, 1);
  run(w, 1);
  assert.equal(p.punches, 1);
});
void test('three quick punch taps flow through jab, cross and hook', () => {
  const w = fight(),
    p = w.players[0];
  for (const move of ['jab', 'cross', 'hook'] as const) {
    p.input.punch = true;
    run(w, 0.05);
    p.input.punch = false;
    stepWorld(w);
    run(w, MOVES[move].recovery + 0.02);
    assert.equal(p.move, move);
    assert.ok(p.attack > 0);
    run(w, MOVES[move].duration);
  }
  assert.equal(p.combo, 0);
  assert.equal(p.punches, 3);
});
void test('kick buffers near recovery, but early inputs expire without surprise attacks', () => {
  const w = fight(),
    p = w.players[0];
  p.cooldown = 0.14;
  p.input.kick = true;
  stepWorld(w);
  p.input.kick = false;
  run(w, 0.16);
  assert.equal(p.move, 'kick');
  assert.equal(p.punches, 1);
  clearCombat(p);
  p.punches = 0;
  p.cooldown = INPUT_BUFFER + 0.3;
  p.input.kick = true;
  stepWorld(w);
  p.input.kick = false;
  run(w, 0.8);
  assert.equal(p.punches, 0);
  assert.equal(p.queuedMove, null);
});
void test('guard, cancel, stun, knockdown and dodge discard a buffered strike', () => {
  for (const interrupt of [
    'guard',
    'cancel',
    'stagger',
    'down',
    'dodge',
  ] as const) {
    const w = fight(),
      p = w.players[0];
    p.cooldown = 0.1;
    p.input.kick = true;
    stepWorld(w);
    p.input.kick = false;
    if (
      interrupt === 'guard' ||
      interrupt === 'cancel' ||
      interrupt === 'dodge'
    )
      p.input[interrupt] = true;
    else p[interrupt] = 0.1;
    stepWorld(w);
    assert.equal(p.queuedMove, null, interrupt);
    p.input = idleInput();
    run(w, 0.8);
    assert.equal(p.punches, 0, interrupt);
  }
});
void test('held kick cannot repeat and insufficient stamina cannot leave a delayed strike', () => {
  const w = fight(),
    p = w.players[0];
  p.input.kick = true;
  run(w, 2);
  assert.equal(p.punches, 1);
  clearCombat(p);
  p.input = idleInput();
  stepWorld(w);
  p.stamina = 1;
  p.input.kick = true;
  stepWorld(w);
  p.input.kick = false;
  assert.equal(p.queuedMove, null);
  p.stamina = 100;
  run(w, 1);
  assert.equal(p.punches, 1);
});
void test('buffer survives checkpoint handover and old rules are rejected', () => {
  const engine = createEngine(1000),
    p = engine.world.players[0];
  p.queuedMove = 'kick';
  p.queueTime = 0.18;
  const checkpoint = JSON.parse(JSON.stringify(engine.checkpoint()));
  const restored = createEngine(1000, checkpoint);
  assert.equal(restored.world.players[0].queuedMove, 'kick');
  assert.equal(restored.world.players[0].queueTime, 0.18);
  assert.equal(compatibility('cage-clash').rules, 4);
  assert.throws(
    () => createEngine(1000, { ...checkpoint, rules: 1 }),
    /checkpoint/,
  );
});
void test('jab, cross and hook travel on distinct paths and contact on their hit frame', () => {
  for (const move of ['jab', 'cross', 'hook'] as const) {
    const side = move === 'jab' ? -1 : 1,
      profile = MOVES[move];
    assert.deepEqual(strikeMotion(move, 0, side).fist, guardFist(side));
    assert.equal(strikeMotion(move, profile.windup, side).drive, 1);
    const final = strikeMotion(move, profile.duration, side);
    final.fist.forEach((v, i) =>
      assert.ok(Math.abs(v - guardFist(side)[i]) < 1e-9),
    );
    assert.equal(final.drive, 0);
  }
  const hook = strikeMotion('hook', MOVES.hook.windup * 0.65, 1).fist;
  const cross = strikeMotion('cross', MOVES.cross.windup * 0.65, 1).fist;
  assert.ok(hook[0] > cross[0] + 0.2);
});
void test('kick chambers before contact, retracts, and ends at the planted stance', () => {
  const profile = MOVES.kick;
  const start = kickMotion(0);
  const chamber = kickMotion(profile.windup * 0.38);
  const contact = kickMotion(profile.windup);
  const end = kickMotion(profile.duration);
  assert.ok(chamber.knee[2] > start.knee[2]);
  assert.ok(chamber.ankle[1] < contact.ankle[1]);
  assert.ok(contact.ankle[2] > chamber.ankle[2]);
  assert.equal(contact.drive, 1);
  assert.deepEqual(end.knee, start.knee);
  end.ankle.forEach((value, index) =>
    assert.ok(Math.abs(value - start.ankle[index]) < 1e-9),
  );
  assert.equal(end.drive, 0);
});
