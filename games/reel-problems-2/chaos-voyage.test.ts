import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from './peer';
import { advanceReel, freshReel, newAngler, reelAction } from './simulation';

function game() {
  const w = freshReel(100_000);
  w.players.push(newAngler('captain', 'Captain', 0, w.clock));
  return w;
}

void test('Chaos Voyage starts as its own mode without Last Boat Home state', () => {
  const w = game();
  reelAction(
    w,
    'captain',
    { type: 'start', mode: 'chaos-voyage', contract: 'giant-catch' },
    'captain',
  );
  assert.equal(w.mode, 'chaos-voyage');
  assert.equal(w.mission, undefined);
  assert.equal(w.voyage?.contract, 'giant-catch');
  assert.equal(w.voyage?.director.act, 'plan');
});

void test('restart preserves the voyage contract and seed unless a new seed is requested', () => {
  const w = game();
  reelAction(
    w,
    'captain',
    {
      type: 'start',
      mode: 'chaos-voyage',
      contract: 'giant-catch',
      seed: 12345,
    },
    'captain',
  );
  assert.equal(w.voyage?.seed, 12345);
  reelAction(w, 'captain', { type: 'restart' }, 'captain');
  assert.equal(w.voyage?.seed, 12345);
  reelAction(w, 'captain', { type: 'restart', newSeed: true }, 'captain');
  assert.notEqual(w.voyage?.seed, 12345);
});

void test('Classic and Last Boat Home setup remain unchanged', () => {
  const classic = game();
  reelAction(classic, 'captain', { type: 'start', mode: 'classic' }, 'captain');
  assert.equal(classic.mode, 'classic');
  assert.equal(classic.mission, undefined);
  assert.equal(classic.voyage, undefined);

  const campaign = game();
  reelAction(
    campaign,
    'captain',
    { type: 'start', mode: 'campaign', contract: 'last-boat-home' },
    'captain',
  );
  assert.equal(campaign.mode, 'campaign');
  assert.equal(campaign.mission?.survival?.stage, 'fight');
  assert.equal(campaign.voyage, undefined);
});

void test('Chaos Voyage uses its nine-minute foundation duration', () => {
  const w = game();
  reelAction(w, 'captain', { type: 'start', mode: 'chaos-voyage' }, 'captain');
  w.clock = w.started + 300_000 - 50;
  advanceReel(w, w.clock + 50);
  assert.equal(w.phase, 'playing');
  w.clock = w.started + 540_000 - 50;
  advanceReel(w, w.clock + 50);
  assert.notEqual(w.phase, 'playing');
});

void test('legacy checkpoints restore to their original mode without voyage state', () => {
  const engine = createEngine(100_000);
  engine.world.players.push(
    newAngler('captain', 'Captain', 0, engine.world.clock),
  );
  reelAction(
    engine.world,
    'captain',
    { type: 'start', mode: 'campaign', contract: 'last-boat-home' },
    'captain',
  );
  const checkpoint = engine.checkpoint();
  checkpoint.world.schemaVersion = 2;
  delete checkpoint.world.voyage;
  const restored = createEngine(engine.world.clock, checkpoint).world;
  assert.equal(restored.mode, 'campaign');
  assert.equal(restored.voyage, undefined);
  assert.equal(restored.schemaVersion, 3);
});

void test('a voyage checkpoint keeps Director state and clears held input', () => {
  const engine = createEngine(100_000);
  engine.world.players.push(
    newAngler('captain', 'Captain', 0, engine.world.clock),
  );
  reelAction(
    engine.world,
    'captain',
    { type: 'start', mode: 'chaos-voyage', seed: 88 },
    'captain',
  );
  engine.world.players[0].input.reel = true;
  const checkpoint = engine.checkpoint();
  const restored = createEngine(engine.world.clock, checkpoint).world;
  assert.deepEqual(restored.voyage, engine.world.voyage);
  assert.equal(restored.players[0].input.reel, false);
});
