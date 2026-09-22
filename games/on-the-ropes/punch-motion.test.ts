import test from 'node:test';
import assert from 'node:assert/strict';
import { PUNCHES, combatStep, nextCombo } from './combat';
import { guardFist, punchMotion, type PunchKind } from './punch-motion';
import { freshWorld, startMatch } from './simulation';
import { createBoxer, poseBoxer } from './models';

void test('punches have distinct paths and return to guard after contact', () => {
  for (const side of [-1, 1]) {
    for (const kind of Object.keys(PUNCHES) as PunchKind[]) {
      const p = PUNCHES[kind];
      assert.deepEqual(punchMotion(kind, 0, side).fist, guardFist(side));
      assert.equal(punchMotion(kind, p.windup, side).drive, 1);
      const end = punchMotion(kind, p.duration, side).fist;
      end.forEach((v, i) => assert.ok(Math.abs(v - guardFist(side)[i]) < 1e-9));
    }
    const low = punchMotion(
      'uppercut',
      PUNCHES.uppercut.windup * 0.3,
      side,
    ).fist;
    const high = punchMotion('uppercut', PUNCHES.uppercut.windup, side).fist;
    assert.ok(high[1] - low[1] > 0.7);
    const hook = punchMotion('hook', PUNCHES.hook.windup * 0.65, side).fist;
    const straight = punchMotion('jab', PUNCHES.jab.windup * 0.65, side).fist;
    assert.ok(Math.abs(hook[0]) > Math.abs(straight[0]) + 0.2);
  }
});

void test('damage never creates lateral sway, and the non-punching fist stays in guard', () => {
  const p = freshWorld(1).players[0];
  const visual = createBoxer(p);
  for (const balance of [0, 40, 90, 120]) {
    p.balance = balance;
    for (const time of [0, 0.2, 0.5, 1]) {
      poseBoxer(visual, p, time, false);
      assert.equal(visual.model.rotation.z, 0);
      assert.equal(visual.rig.body.rotation.z, 0);
    }
  }
  p.combo = 3;
  p.hand = 0;
  p.attack = PUNCHES.uppercut.duration - PUNCHES.uppercut.windup;
  poseBoxer(visual, p, 1, false);
  assert.deepEqual(visual.arms[1].glove.position.toArray(), guardFist(1));
  assert.ok(visual.arms[0].glove.position.y > 0.4);
});

void test('three timed taps land jab, cross, uppercut; exhaustion and expiry reset the sequence', () => {
  const w = freshWorld(1);
  startMatch(w);
  const [a, , b] = w.players;
  for (const p of w.players) p.bot = false;
  a.x = b.x = 0;
  a.z = 0;
  b.z = 1;
  a.heading = 0;
  b.heading = Math.PI;
  for (const [combo, kind] of [
    [1, 'jab'],
    [2, 'cross'],
    [3, 'uppercut'],
  ] as const) {
    a.charge = 0.08;
    combatStep(w, 1 / 60);
    assert.equal(a.combo, combo);
    assert.equal(a.attack, PUNCHES[kind].duration - 1 / 60);
    const before = b.balance;
    while (a.attack > 0 || a.cooldown > 0) combatStep(w, 1 / 60);
    assert.equal(b.balance - before, PUNCHES[kind].damage);
  }
  assert.equal(nextCombo(a), 1);
  a.combo = 2;
  a.comboTime = 0.5;
  a.stamina = 10;
  assert.equal(nextCombo(a), 1);
  a.stamina = 100;
  a.comboTime = 0;
  assert.equal(nextCombo(a), 1);
});

void test('uppercut cannot connect at straight-punch distance', () => {
  const w = freshWorld(1);
  startMatch(w);
  const [a, , b] = w.players;
  a.x = b.x = 0;
  a.z = 0;
  b.z = 1.4;
  a.heading = 0;
  a.combo = 3;
  a.attack = PUNCHES.uppercut.duration - PUNCHES.uppercut.windup + 1 / 120;
  a.struck = false;
  combatStep(w, 1 / 60);
  assert.equal(b.balance, 0);
  assert.equal(a.whiffed, true);
  assert.equal(a.comboTime, 0);
});
