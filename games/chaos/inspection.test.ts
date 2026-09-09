import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  freshWorld,
  tickWorld,
  type Player,
  type Piece,
} from './model';
import { enableParty, partyAction, tickParty, tickTask } from './party';
import { inspectConstruction, inspectionAction } from './inspection';
const now = 100000;
const builder = (id = 'host', x = 0, z = 5): Player => ({
  id,
  name: id,
  color: 0,
  x,
  z,
  angle: 0,
  seen: now,
});
function fixture() {
  const w = enableParty(freshWorld('job', now), now),
    a = builder();
  partyAction(
    w,
    { type: 'party', op: 'configure', format: 'inspection' },
    a,
    [a],
    a.id,
    now,
  );
  partyAction(w, { type: 'party', op: 'start' }, a, [a], a.id, now);
  return { w, a };
}
const part = (
  id: string,
  kind: Piece['kind'],
  x: number,
  z: number,
  rotation = 0,
): Piece => ({ id, kind, x, z, rotation, placed: true });
void test('inspection is opt-in, host-controlled, and preserves the classic lane', () => {
  const { w, a } = fixture();
  assert.deepEqual(w.party!.task.target, { x: 0, z: 0 });
  assert.equal(
    enableParty(freshWorld('job', now), now).party!.inspection,
    undefined,
  );
  assert.throws(() =>
    partyAction(
      w,
      { type: 'party', op: 'configure', format: 'classic' },
      builder('guest'),
      [a],
      a.id,
      now,
    ),
  );
  const reset = applyAction(
    w,
    { type: 'reset', mode: 'job' },
    a,
    [a],
    a.id,
    now + 1,
  );
  assert.equal(reset.party!.format, 'inspection');
  assert.deepEqual(reset.party!.task.target, { x: 0, z: 0 });
});
void test('functional inspection fails on uncovered seating and checks actual door geometry', () => {
  const { w } = fixture();
  w.pieces = [
    part('back', 'wall', 0, -1),
    part('left', 'wall', -1, 0, 1),
    part('right', 'wall', 1, 0, 1),
    part('front', 'wall', 0, 1),
  ];
  Object.assign(w.party!.task, { x: 0, z: 0, phase: 'done' });
  assert.equal(inspectConstruction(w).access, false);
  w.pieces[3].kind = 'door';
  assert.equal(inspectConstruction(w).access, true);
  assert.equal(inspectConstruction(w).passed, false);
  w.pieces.push(part('roof', 'roof', 0, 0));
  assert.equal(inspectConstruction(w).passed, true);
  w.pieces.at(-1)!.hoisted = true;
  assert.equal(inspectConstruction(w).covered, 0);
});
void test('one 20-second rescue permits repairs, resumes carrying safely, then freezes', () => {
  const { w, a } = fixture();
  Object.assign(w.party!.task, {
    solo: true,
    phase: 'working',
    roles: [a.id, ''],
  });
  tickParty(w, [a], now + 240000, 1);
  assert.equal(w.party!.phase, 'rescue');
  assert.equal(w.party!.deadline, now + 260000);
  tickTask(w, [a], now + 240100);
  assert.ok(Number.isFinite(w.party!.task.x));
  w.pieces = [part('roof', 'roof', 0, 0)];
  Object.assign(w.party!.task, { phase: 'done', x: 0, z: 0 });
  tickParty(w, [a], now + 260000, 1);
  assert.equal(w.party!.phase, 'inspection');
  assert.equal(w.party!.result!.passed, true);
  assert.equal(w.party!.result!.awards[0].title, 'Last-second legends');
  assert.throws(() =>
    applyAction(
      w,
      { type: 'build', kind: 'chair', x: 2, z: 2, rotation: 0 },
      a,
      [a],
      a.id,
      now + 260001,
    ),
  );
});
void test('a missing construction checklist also earns only one rescue window', () => {
  const { w, a } = fixture();
  w.pieces = [part('roof', 'roof', 0, 0)];
  Object.assign(w.party!.task, { phase: 'done', x: 0, z: 0 });
  tickParty(w, [a], now + 240000, 0.2);
  assert.equal(w.party!.phase, 'rescue');
  tickParty(w, [a], now + 260000, 0.2);
  assert.equal(w.party!.phase, 'inspection');
  assert.equal(w.party!.result!.passed, false);
});
void test('a leak affects carrying until a nearby builder repairs it; catching is cooldown-limited', () => {
  const { w, a } = fixture(),
    t = w.party!.task;
  Object.assign(t, {
    x: 0,
    z: 2,
    solo: true,
    phase: 'working',
    roles: [a.id, ''],
    lastTick: now + 60100,
  });
  a.seen = now + 60250;
  t.inputs[a.id] = { x: 0, z: 0, turn: 0, at: a.seen };
  tickTask(w, [a], a.seen);
  assert.ok(t.x > 0);
  assert.ok(t.tilt > 0);
  assert.throws(() =>
    inspectionAction(w, 'repair', builder('far', 8, 8), a.seen),
  );
  inspectionAction(w, 'repair', builder('helper', 0, 2), a.seen);
  assert.equal(w.party!.inspection!.leakFixed, true);
  t.tilt = 0.8;
  inspectionAction(w, 'steady', builder('helper', 0, 2), a.seen);
  assert.ok(t.tilt < 0.2);
  t.tilt = 0.8;
  assert.throws(() =>
    inspectionAction(w, 'steady', builder('helper', 0, 2), a.seen + 1),
  );
  assert.equal(w.party!.stats.rescues, 1);
});
void test('recovering a spilled sofa retains the inside destination', () => {
  const { w, a } = fixture();
  Object.assign(a, w.party!.task.origin);
  partyAction(w, { type: 'party', op: 'recover' }, a, [a], a.id, now);
  assert.deepEqual(w.party!.task.target, { x: 0, z: 0 });
  tickWorld(w, [a], now + 1);
});
