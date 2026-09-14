import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshReel, newAngler, step, bank } from './simulation';
import { ReelAudioDirector } from './audio/director';
import { ROUND_MS } from './types';

void test('Flying fish ("Salmon Slap") knocks unbraced anglers flat on deck, but bracing resists', () => {
  const w = freshReel(100_000);
  w.phase = 'playing';
  w.started = w.clock;

  const p1 = newAngler('p1', 'Unbraced', 0, w.clock);
  p1.x = 0;
  p1.z = 0;
  p1.input.brace = false;

  const p2 = newAngler('p2', 'Braced', 1, w.clock);
  p2.x = 0.5;
  p2.z = 0;
  p2.input.brace = true;

  w.players.push(p1, p2);

  // Manually trigger a flying fish passing through (0, 0)
  w.flyingFish = {
    id: 'ff-1',
    fromX: -5,
    fromZ: 0,
    toX: 5,
    toZ: 0,
    at: w.clock,
    duration: 1200,
    hit: false,
  };

  // Step halfway through the flight
  w.clock += 600;
  step(w, 0.6);

  // Check results:
  // p1 was unbraced: should have tumbleUntil set, lost hat, and a slap event announced
  assert.ok(
    p1.tumbleUntil > w.clock,
    'Unbraced angler should be knocked into a tumble',
  );
  assert.equal(
    p1.lostHat,
    true,
    'Unbraced angler should lose their hat on slap',
  );

  // p2 was bracing: should resist the tumble
  assert.equal(p2.tumbleUntil, 0, 'Braced angler should not tumble');
  assert.equal(p2.lostHat, false, 'Braced angler should keep their hat');

  // Event was logged
  assert.ok(
    w.events.some((e) => e.kind === 'slap'),
    'Slap event should be announced',
  );
});

void test('Anglers bump and repel each other softly when colliding on deck', () => {
  const w = freshReel(100_000);
  w.phase = 'playing';
  w.started = w.clock;

  const p1 = newAngler('p1', 'Alice', 0, w.clock);
  p1.x = 0;
  p1.z = 0;

  const p2 = newAngler('p2', 'Bob', 1, w.clock);
  p2.x = 0.25; // Closer than 0.7m
  p2.z = 0;

  w.players.push(p1, p2);

  step(w, 0.05);

  // Both players should experience repulsion velocity
  assert.ok(p1.slipX < 0, 'p1 should be pushed left away from p2');
  assert.ok(p2.slipX > 0, 'p2 should be pushed right away from p1');
  assert.ok(
    w.events.some((e) => e.kind === 'bump'),
    'Bump event should be announced',
  );
});

void test('Line snap triggers recoil tumble and lost balance', () => {
  const w = freshReel(100_000);
  w.phase = 'playing';
  w.started = w.clock;

  const p = newAngler('p1', 'Fisher', 0, w.clock);
  p.x = 0;
  p.z = 1;
  w.fish[0].x = 0;
  w.fish[0].z = 30;
  p.line = {
    kind: 'fish',
    target: 'fish-0',
    x: 0,
    z: 30,
    length: 1,
    tension: 1.4,
    strain: 1.15,
    tangled: false,
    crossing: 0,
    castAt: w.clock - 2000,
    clearUntil: 0,
  };
  w.players.push(p);

  step(w, 0.1);

  assert.equal(p.line, null, 'Line should be snapped and gone');
  assert.ok(p.tumbleUntil > w.clock, 'Player should tumble upon line snap');
  assert.ok(
    Math.hypot(p.slipX, p.slipZ) > 0,
    'Player should have recoil slip velocity',
  );
});

void test('Landing The Lake Manager triggers trophy celebration pose', () => {
  const w = freshReel(100_000);
  w.phase = 'playing';
  w.started = w.clock;

  const p = newAngler('p1', 'Hero', 0, w.clock);
  w.players.push(p);

  // Bank the monster catch
  bank(w, 'monster', [p], p.name, '');

  assert.ok(p.trophyUntil > w.clock, 'Player should have trophy pose active');
  assert.equal(p.trophyKind, 'monster', 'Trophy kind should match catch');
  assert.ok(
    w.events.some((e) => e.kind === 'trophy'),
    'Trophy event should be announced',
  );
});

void test('Audio Director triggers dread loop when shark stalks swimming player and 15s time warning', () => {
  const director = new ReelAudioDirector();
  const w = freshReel(100_000);
  w.phase = 'playing';
  w.started = w.clock;

  const swimmer = newAngler('p1', 'Swimmer', 0, w.clock);
  swimmer.swimming = true;
  swimmer.x = 10;
  swimmer.z = 10;
  w.players.push(swimmer);

  // Add shark nearby swimmer
  w.wildlife.push({
    id: 'shark-1',
    kind: 'shark',
    x: 12,
    z: 12,
    angle: 0,
    activeUntil: w.clock + 10_000,
    nextAt: w.clock + 5000,
    hitAt: 0,
  });

  const plan = director.update(w, 'p1');
  assert.ok(
    plan.loops.some((l) => l.channel === 'dread' && l.id === 'ambience.dread'),
    'Dread loop should be active when shark is stalking swimmer',
  );

  // Check 15-second countdown warning: step smoothly across the 15s boundary
  w.clock = w.started + ROUND_MS - 15_100;
  director.update(w, 'p1');
  w.clock += 200;
  const panicPlan = director.update(w, 'p1');
  assert.ok(
    panicPlan.hits.some((h) => h.id === 'event.time-warning'),
    '15s time warning hit should be emitted near round end',
  );
});
