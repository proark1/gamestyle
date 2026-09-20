import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshHotel,
  newGuest,
  hotelAction,
  advanceHotel,
  hotelSnapshot,
  stationFor,
} from './simulation';
import { advancePractice } from './practice';
import { clueText, legacyFinding } from './evidence';
import { hotelHorror } from './horror';
import { STATIONS } from './types';

function world(seed = 5, count = 1) {
  const w = freshHotel(seed);
  for (let n = 0; n < count; n++)
    w.players.push(newGuest(String(n), 'Guest', n, seed));
  hotelAction(w, '0', { type: 'start' }, '0');
  return w;
}
void test('100 unattended stays never clear a floor or win, including haunted floors', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const w = world(seed);
    for (let n = 0; n < 362; n++) advanceHotel(w, w.clock + 250);
    assert.equal(w.phase, 'lost');
    assert.equal(w.endedBy, 'timeout');
    assert.equal(w.cleared, 0);
    assert.equal(w.lastDecision, null);
  }
});
void test('practice dialogs freeze the entire world during inspection and escape without catch-up', () => {
  const w = world();
  for (const phase of ['playing', 'escape'] as const) {
    w.phase = phase;
    w.players[0].input.z = -1;
    const before = structuredClone(w);
    for (let n = 0; n < 1000; n++) advancePractice(w, 1000, true);
    assert.deepEqual(w, before);
    advancePractice(w, 60000, false);
    assert.ok(w.clock - before.clock <= 101);
  }
});
void test('first practice stop permits movement and reports without timeout; a vote starts normal play', () => {
  const w = world();
  w.training = true;
  for (let n = 0; n < 500; n++) advanceHotel(w, w.clock + 250);
  assert.equal(w.phase, 'playing');
  assert.equal(w.cleared, 0);
  assert.ok(w.players.filter((p) => p.bot).every((p) => p.reportClue));
  const p = w.players[0];
  const oldZ = p.z;
  p.input.z = -1;
  advancePractice(w, 100, false);
  assert.ok(p.z < oldZ);
  p.x = 0;
  p.z = -23;
  hotelAction(
    w,
    '0',
    { type: 'vote', choice: w.plan.anomalies.length ? 'retreat' : 'advance' },
    '0',
  );
  assert.equal(w.training, false);
  assert.equal(w.cleared, 1);
  for (let n = 0; n < 380; n++) advanceHotel(w, w.clock + 250);
  assert.equal(w.phase, 'lost');
  assert.equal(w.endedBy, 'timeout');
});
void test('all clue variants have localized evidence and private clues are withheld until shared', () => {
  for (const variant of [0, 1]) {
    const w = world(30, 4);
    w.plan.anomalies = [0, 1, 2, 3];
    w.plan.variants = [variant, variant, variant, variant];
    for (const p of w.players) {
      const station = stationFor(w, p),
        clue = { station, odd: true, variant };
      p.x = STATIONS[station].x;
      p.z = STATIONS[station].z;
      hotelAction(w, p.id, { type: 'inspect' }, '0');
      const other = hotelSnapshot(
        w,
        'ABCDEF',
        '0',
        String((Number(p.id) + 1) % 4),
        1,
      );
      assert.equal(
        other.world.players.find((g) => g.id === p.id)?.reportClue,
        undefined,
      );
      hotelAction(w, p.id, { type: 'report' }, '0');
      assert.deepEqual(p.reportClue, clue);
      assert.equal(p.report, clueText(clue, 'en'));
      assert.notEqual(clueText(clue, 'de'), clueText(clue, 'en'));
      assert.equal(legacyFinding(p.report, 'de'), clueText(clue, 'de'));
    }
  }
});
void test('alternate door gives five impacts and fast clock matches its description', () => {
  const s = hotelSnapshot(world(), 'PRACTICE', '0', '0', 1);
  s.you.anomaly = true;
  s.you.variant = 1;
  s.you.station = 2;
  const impacts = new Set<string>();
  for (let n = 0; n < 6700; n += 30) {
    s.world.clock = s.world.stopAt + n;
    const h = hotelHorror(s);
    if (h.knockKey) impacts.add(h.knockKey);
  }
  assert.equal(impacts.size, 5);
  s.you.station = 3;
  s.world.clock = s.world.stopAt + 1440;
  assert.equal(hotelHorror(s).clockStep, 6);
});
void test('all four guests receive a visible pursuer, while inspection apparitions remain private', () => {
  const w = world(1000, 4);
  w.plan.anomalies = [0];
  w.plan.witness = 0;
  for (const p of w.players) {
    const s = hotelSnapshot(w, 'ABCDEF', '0', p.id, 1);
    assert.equal(s.you.apparition, p.id === '0');
    s.world.phase = 'escape';
    assert.equal(hotelHorror(s).ghost, true);
  }
});
void test('all four spawn positions keep the first-person view within the elevator opening', () => {
  const w = world(100, 4);
  for (const p of w.players) {
    assert.ok(Math.abs(p.x) <= 0.52);
    assert.ok(p.z > 2.7);
  }
});
