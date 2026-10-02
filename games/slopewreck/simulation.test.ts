import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceWorld, freshWorld, raceAction, setInput } from './simulation';
import { FINISH_Z, RACE_MS } from './types';

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
