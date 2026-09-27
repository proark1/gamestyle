import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceWorld, freshWorld, raceAction, setInput } from './simulation';
import { FINISH_Z, RACE_MS } from './types';
import { HAZARDS } from './hazards';

const advance = (w: ReturnType<typeof freshWorld>, duration: number) => {
  let remaining = duration;
  while (remaining > 0) {
    const step = Math.min(50, remaining);
    advanceWorld(w, w.clock + step);
    remaining -= step;
  }
};

void test('a landed trick creates a feature behind its rider for followers', () => {
  const w = freshWorld(1_000);
  const p = w.players[0];
  p.id = 'human';
  p.bot = false;
  raceAction(w, 'human', { type: 'start' }, true);
  raceAction(w, 'human', { type: 'jump' }, true);
  advance(w, 100);
  raceAction(w, 'human', { type: 'trick_ramp' }, true);
  advance(w, 1_200);
  assert.equal(p.grounded, true);
  assert.equal(p.cleanLandings, 1);
  assert.equal(w.features.length, 1);
  assert.equal(w.features[0].kind, 'ramp');
  assert.ok(w.features[0].z < p.z);
  assert.equal(w.features[0].wild, false);
});

void test('a badly timed trick still builds a wild shortcut and slows the rider', () => {
  const w = freshWorld(1_000);
  const p = w.players[0];
  p.id = 'human';
  p.bot = false;
  raceAction(w, 'human', { type: 'start' }, true);
  raceAction(w, 'human', { type: 'jump' }, true);
  advance(w, 750);
  raceAction(w, 'human', { type: 'trick_rail' }, true);
  advance(w, 500);
  assert.equal(w.features[0]?.wild, true);
  assert.equal(p.wipeouts, 1);
  assert.ok(p.speed < 8);
});

void test('a trailing rider can use a newly built ramp for air and speed', () => {
  const w = freshWorld(1_000);
  const leader = w.players[0],
    follower = w.players[1];
  leader.id = 'leader';
  leader.bot = false;
  follower.id = 'follower';
  follower.bot = false;
  raceAction(w, 'leader', { type: 'start' }, true);
  follower.x = 0;
  follower.z = 20;
  follower.speed = 8;
  w.features.push({
    id: 1,
    owner: 'leader',
    kind: 'ramp',
    x: 0,
    z: 21,
    wild: false,
    born: w.clock,
  });
  advance(w, 200);
  assert.equal(follower.grounded, false);
  assert.ok(follower.speed > 8);
});

void test('a rail side is solid when the rider misses its rideable center', () => {
  const w = freshWorld(1_000);
  const leader = w.players[0];
  const follower = w.players[1];
  leader.id = 'leader';
  leader.bot = false;
  follower.id = 'follower';
  follower.bot = false;
  raceAction(w, 'leader', { type: 'start' }, true);
  follower.x = 1.12;
  follower.z = 17;
  follower.speed = 19;
  w.features.push({
    id: 1,
    owner: 'leader',
    kind: 'rail',
    x: 0,
    z: 21,
    wild: false,
    born: w.clock,
  });
  advance(w, 300);
  assert.ok(follower.z < 18, `${follower.z} should remain before the rail`);
  assert.equal(follower.wipeouts, 1);
});

void test('solo bots finish and a 60-second race chooses a winner', () => {
  const w = freshWorld(1_000);
  w.players[0].id = 'human';
  w.players[0].bot = false;
  raceAction(w, 'human', { type: 'start' }, true);
  setInput(w, 'human', { steer: 0, tuck: true });
  advance(w, RACE_MS + 100);
  assert.equal(w.phase, 'ended');
  assert.ok(w.winner);
  assert.ok(w.players.every((p) => p.z <= FINISH_Z));
  assert.ok(w.players.some((p) => p.finishAt));
});

void test('only the host starts a race and invalid input is neutralized', () => {
  const w = freshWorld(1_000);
  w.players[0].id = 'human';
  w.players[0].bot = false;
  assert.throws(() => raceAction(w, 'human', { type: 'start' }, false));
  setInput(w, 'human', { steer: Infinity, tuck: 'yes', brake: true });
  assert.deepEqual(w.players[0].input, {
    x: 0,
    z: 0,
    steer: 0,
    tuck: false,
    brake: true,
  });
});

void test('rematches keep event and feature identifiers increasing', () => {
  const w = freshWorld(1_000);
  const p = w.players[0];
  p.id = 'human';
  p.bot = false;
  raceAction(w, 'human', { type: 'start' }, true);
  raceAction(w, 'human', { type: 'jump' }, true);
  advance(w, 100);
  raceAction(w, 'human', { type: 'trick_ramp' }, true);
  advance(w, 1_200);
  const firstEvent = w.nextEvent,
    firstFeature = w.nextFeature;
  w.phase = 'ended';
  raceAction(w, 'human', { type: 'reset' }, true);
  raceAction(w, 'human', { type: 'jump' }, true);
  advance(w, 100);
  raceAction(w, 'human', { type: 'trick_rail' }, true);
  advance(w, 1_200);
  assert.ok(w.nextEvent > firstEvent);
  assert.ok(w.nextFeature > firstFeature);
});

void test('solid gate poles stop a maximum-speed rider instead of tunneling', () => {
  const w = freshWorld(1_000);
  const p = w.players[0];
  const gate = HAZARDS.find((hazard) => hazard.type === 'gate');
  assert.ok(gate && gate.type === 'gate');
  p.id = 'human';
  p.bot = false;
  raceAction(w, 'human', { type: 'start' }, true);
  p.x = gate.x - gate.gap * 0.5;
  p.z = gate.z - 1.2;
  p.speed = 19;
  setInput(w, 'human', { steer: 0, tuck: true });
  advance(w, 160);
  assert.ok(p.z < gate.z, `${p.z} should remain before the gate`);
  assert.equal(p.wipeouts, 1);
});

void test('riders jostle apart without reversing or launching', () => {
  const w = freshWorld(1_000);
  raceAction(w, w.players[0].id, { type: 'start' }, true);
  const [a, b] = w.players;
  a.bot = false;
  b.bot = false;
  a.x = 0;
  b.x = 0.1;
  a.z = b.z = 100;
  a.speed = 14;
  b.speed = 11;
  advance(w, 50);
  assert.ok(Math.abs(a.x - b.x) > 0.6);
  assert.ok(a.speed > 0 && b.speed > 0);
  assert.ok(Math.abs(a.lateralSpeed) <= 8 && Math.abs(b.lateralSpeed) <= 8);
});

void test('a snowbank collapses only after a rider finds the safe line', () => {
  const w = freshWorld(1_000);
  const p = w.players[0];
  const bank = HAZARDS.find((hazard) => hazard.type === 'snowbank');
  assert.ok(bank && bank.type === 'snowbank');
  p.id = 'human';
  p.bot = false;
  raceAction(w, 'human', { type: 'start' }, true);
  p.x = bank.x < 0 ? 7 : -7;
  p.z = bank.z - 1;
  p.speed = 14;
  advance(w, 300);
  assert.ok(w.collapsedHazards.includes(bank.id));
  assert.equal(p.wipeouts, 0);
});
