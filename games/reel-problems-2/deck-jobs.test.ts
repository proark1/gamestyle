import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceReel, freshReel, newAngler, reelAction } from './simulation';
import {
  advanceDeckJobs,
  completeDeckJob,
  deckJobTarget,
  gateOpen,
  STATIONS,
} from './deck-jobs';
import { releaseMaterial, workTarget } from './mission';
import { createEngine } from './peer';
import type { ReelWorld } from './types';

const emit = () => {};
function game(count = 1) {
  const w = freshReel(100000);
  for (let i = 0; i < count; i++)
    w.players.push(newAngler(String(i), `Crew ${i}`, i, w.clock));
  reelAction(
    w,
    '0',
    { type: 'start', mode: 'campaign', contract: 'last-boat-home' },
    '0',
  );
  w.mission!.survival!.stage = 'choice';
  return w;
}
function giant(w: ReelWorld) {
  w.mission!.cargo.push({
    id: 'giant',
    kind: 'monster',
    location: 'boat',
    x: 0,
    z: 0,
    until: 0,
  });
  advanceDeckJobs(w, 0.05, emit);
}
function tick(w: ReelWorld, seconds: number) {
  for (let i = 0; i < seconds * 20 && w.phase === 'playing'; i++)
    advanceReel(w, w.clock + 50);
}
function gate(count = 1) {
  const w = game(count);
  Object.assign(w.mission!.survival!, {
    stage: 'escape',
    progress: 1,
    waveAt: Number.MAX_SAFE_INTEGER,
  });
  Object.assign(w.boat, { x: 0, z: 33.4 });
  Object.assign(w.players[0], STATIONS.winch);
  return w;
}
void test('rope must be fetched, carried and tied at the fish; carrying prevents reeling', () => {
  const w = game(),
    p = w.players[0],
    j = w.mission!.survival!.jobs!;
  giant(w);
  Object.assign(p, STATIONS.rope);
  assert.equal(deckJobTarget(w, p)?.id, 'take-rope');
  completeDeckJob(w, p, 'take-rope', emit);
  assert.equal(j.carried[p.id], 'rope');
  completeDeckJob(w, p, 'tie-fish', emit);
  assert.equal(j.secured, false);
  w.mission!.survival!.stage = 'fight';
  p.input.reel = true;
  tick(w, 0.5);
  assert.equal(w.mission!.survival!.giant, 0);
  Object.assign(p, STATIONS.fish);
  completeDeckJob(w, p, 'tie-fish', emit);
  assert.equal(j.secured, true);
  assert.equal(j.carried[p.id], undefined);
});
void test('loose fish warns then knocks crew and cargo; securing it prevents further flops', () => {
  const w = game(),
    p = w.players[0],
    j = w.mission!.survival!.jobs!;
  giant(w);
  w.mission!.cargo.push({
    id: 'bonus',
    kind: 'salmon',
    location: 'boat',
    x: 0,
    z: 0,
    until: 0,
  });
  Object.assign(p, STATIONS.fish);
  w.clock = j.flopAt - 2000;
  advanceDeckJobs(w, 0.05, emit);
  assert.equal(j.flopWarned, true);
  w.clock = j.flopAt;
  advanceDeckJobs(w, 0.05, emit);
  assert.ok(p.tumbleUntil > w.clock);
  assert.equal(w.mission!.cargo[1].location, 'water');
  j.secured = true;
  const last = j.lastFlop;
  w.clock += 20000;
  advanceDeckJobs(w, 0.05, emit);
  assert.equal(j.lastFlop, last);
});
void test('planks seal only at the leak; bailing removes water separately; duplicate repair retains plank', () => {
  const w = game(2),
    [p, q] = w.players,
    j = w.mission!.survival!.jobs!;
  w.leak = { x: 1.2, z: -2.2, patch: 0, at: w.clock, warned: false };
  w.boat.flood = 0.5;
  Object.assign(p, w.leak);
  p.input.reel = true;
  tick(w, 2.2);
  assert.ok(w.leak, 'E must not bypass the plank job');
  Object.assign(p, STATIONS.bucket);
  completeDeckJob(w, p, 'bail-bucket', emit);
  assert.ok(w.leak);
  const flood = w.boat.flood;
  for (const crew of [p, q]) {
    Object.assign(crew, STATIONS.timber);
    completeDeckJob(w, crew, 'take-plank', emit);
  }
  completeDeckJob(w, p, 'patch-plank', emit);
  assert.ok(w.leak, 'cannot repair from timber station');
  Object.assign(p, w.leak);
  Object.assign(q, w.leak);
  completeDeckJob(w, p, 'patch-plank', emit);
  completeDeckJob(w, q, 'patch-plank', emit);
  assert.equal(w.leak, null);
  assert.equal(w.boat.flood, flood);
  assert.equal(j.patches, 1);
  assert.equal(j.carried[q.id], 'plank');
  releaseMaterial(w, q.id);
  assert.equal(j.carried[q.id], undefined);
});
void test('walking away interrupts contextual work instead of completing it remotely', () => {
  const w = game(),
    p = w.players[0];
  giant(w);
  Object.assign(p, STATIONS.rope);
  p.input.work = true;
  tick(w, 0.15);
  Object.assign(p, { x: 1.5, z: -2.5 });
  tick(w, 0.5);
  assert.equal(w.mission!.survival!.jobs!.carried[p.id], undefined);
});
void test('solo must crank the gate then row, and the 14-second latch permits escape', () => {
  const w = gate(),
    p = w.players[0];
  p.input.reel = true;
  tick(w, 4);
  assert.equal(w.phase, 'playing');
  p.input.reel = false;
  p.input.work = true;
  tick(w, 2.2);
  assert.ok(gateOpen(w));
  p.input.work = false;
  p.input.reel = true;
  tick(w, 3.5);
  assert.equal(w.phase, 'won');
});
void test('crew gate needs a continuing operator; a missing crew member blocks the finish', () => {
  const w = gate(2),
    [p, q] = w.players,
    j = w.mission!.survival!.jobs!;
  completeDeckJob(w, p, 'gate-winch', emit);
  w.clock += 2000;
  advanceDeckJobs(w, 0.1, emit);
  assert.equal(gateOpen(w), false);
  completeDeckJob(w, p, 'gate-winch', emit);
  p.input.work = true;
  q.input.reel = true;
  q.swimming = true;
  for (let i = 0; i < 40; i++) {
    w.clock += 100;
    advanceDeckJobs(w, 0.1, emit);
  }
  assert.equal(j.crossing, 0);
  q.swimming = false;
  for (let i = 0; i < 32; i++) {
    w.clock += 100;
    advanceDeckJobs(w, 0.1, emit);
  }
  assert.equal(w.phase, 'won');
});
void test('checkpoint keeps supplies and secured fish but releases controls; disconnect returns supplies', () => {
  const e = createEngine(100000),
    w = e.world;
  w.players.push(newAngler('0', 'Crew', 0, w.clock));
  reelAction(
    w,
    '0',
    { type: 'start', mode: 'campaign', contract: 'last-boat-home' },
    '0',
  );
  Object.assign(w.mission!.survival!.jobs!, {
    secured: true,
    carried: { '0': 'plank' },
  });
  w.players[0].input.work = true;
  const restored = createEngine(w.clock, e.checkpoint()).world;
  assert.equal(restored.mission!.survival!.jobs!.secured, true);
  assert.equal(restored.mission!.survival!.jobs!.carried['0'], 'plank');
  assert.equal(restored.players[0].input.work, undefined);
  restored.players = [];
  advanceDeckJobs(restored, 0.05, emit);
  assert.deepEqual(restored.mission!.survival!.jobs!.carried, {});
});
void test('older checkpoints without jobs retain their original escape interaction', () => {
  const w = gate();
  delete w.mission!.survival!.jobs;
  assert.equal(workTarget(w, w.players[0])?.id, 'escape');
});
void test('deckhand walks between stations to secure fish, repair a leak, and operate the gate', () => {
  const w = game(2),
    [human, bot] = w.players;
  bot.bot = true;
  Object.assign(human, { x: 1.6, z: 0 });
  giant(w);
  tick(w, 9);
  assert.equal(
    w.mission!.survival!.jobs!.secured,
    true,
    'deckhand ties the giant',
  );
  w.leak = { x: 1.2, z: -2.2, patch: 0, at: w.clock, warned: false };
  tick(w, 9);
  assert.equal(w.leak, null, 'deckhand carries a plank to the leak');
  Object.assign(w.mission!.survival!, {
    stage: 'escape',
    progress: 1,
    waveAt: Number.MAX_SAFE_INTEGER,
    warned: false,
  });
  w.boat.x = 0;
  w.boat.z = 33.4;
  human.input.reel = true;
  tick(w, 15);
  assert.equal(w.phase, 'won', 'deckhand holds the winch while human rows');
});
