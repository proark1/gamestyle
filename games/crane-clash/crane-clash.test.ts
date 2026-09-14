import test from 'node:test';
import assert from 'node:assert/strict';
import { freshClashWorld, newPlayer } from './simulation';
import { reconcileClashBots } from './bots';
import { CraneClashPhysics } from './physics';
import { createEngine } from './peer';
import { CRANE_CONFIG, CRATE_CONFIGS, PAD_Y } from './types';

void test('world initializes with 2 cranes and crates in yard', () => {
  const w = freshClashWorld(1000);
  assert.equal(w.phase, 'lobby');
  assert.ok(w.cranes.orange, 'orange crane exists');
  assert.ok(w.cranes.teal, 'teal crane exists');
  assert.ok(w.crates.length >= 20, 'plenty of crates scattered in yard');
  assert.equal(w.scores.orange.height, 0);
  assert.equal(w.scores.teal.height, 0);
});

void test('bot reconciliation keeps all 4 slots filled', () => {
  const w = freshClashWorld(1000);
  // Add 1 human player
  w.players.push(
    newPlayer('human-1', 'Player 1', 0, 'orange', 'swinger', false),
  );
  reconcileClashBots(w);

  assert.equal(w.players.length, 4, '4 slots active');
  const bots = w.players.filter((p) => p.bot);
  assert.equal(bots.length, 3, '3 bots fill the remaining slots');

  // Verify roles and teams
  assert.ok(
    w.players.some(
      (p) => p.team === 'orange' && p.role === 'operator' && p.bot,
    ),
  );
  assert.ok(
    w.players.some(
      (p) => p.team === 'orange' && p.role === 'swinger' && !p.bot,
    ),
  );
  assert.ok(
    w.players.some((p) => p.team === 'teal' && p.role === 'operator' && p.bot),
  );
  assert.ok(
    w.players.some((p) => p.team === 'teal' && p.role === 'swinger' && p.bot),
  );
});

void test('crane operator controls slew and trolley movement', () => {
  const w = freshClashWorld(1000);
  const physics = new CraneClashPhysics(w);

  const initialAngle = w.cranes.orange.angle;
  const initialDist = w.cranes.orange.trolleyDist;

  // Slew left
  physics.driveOperator('orange', { x: 1, z: 0, seq: 1 }, 0.1);
  assert.ok(w.cranes.orange.angle > initialAngle, 'slew rotated');

  // Move trolley out
  physics.driveOperator('orange', { x: 0, z: 1, seq: 2 }, 0.1);
  assert.ok(w.cranes.orange.trolleyDist > initialDist, 'trolley moved out');
});

void test('swinger can pump momentum and swing', () => {
  const w = freshClashWorld(1000);
  const physics = new CraneClashPhysics(w);

  // Apply swing force forward
  physics.driveSwinger('orange', { x: 1, z: 0, seq: 1 });
  physics.step(1 / 60);

  const hookVx = w.cranes.orange.hookVx;
  assert.ok(hookVx !== 0, 'swinger gained horizontal velocity');
});

void test('swinger grabs and releases crates', () => {
  const w = freshClashWorld(1000);
  const player = newPlayer('sw-1', 'Swinger', 0, 'orange', 'swinger', false);
  w.players.push(player);

  // Place a crate right by the swinger hook
  const crate = w.crates[0];
  crate.x = w.cranes.orange.hookX;
  crate.y = w.cranes.orange.hookY - 1.0;
  crate.z = w.cranes.orange.hookZ;

  const physics = new CraneClashPhysics(w);
  const grabbed = physics.grabCrate(player);

  assert.equal(grabbed, crate.id, 'crate was grabbed');
  assert.equal(player.holdingCrateId, crate.id);

  // Step with held crate
  physics.step(1 / 60);
  assert.ok(crate.heldBy === player.id, 'crate remains held');

  // Release crate
  const released = physics.releaseCrate(player);
  assert.equal(released, crate.id, 'crate was released');
  assert.equal(player.holdingCrateId, null);
  assert.equal(crate.heldBy, null);
});

void test('tower height calculates correctly for crates resting on pad', () => {
  const w = freshClashWorld(1000);
  const cfg = CRANE_CONFIG.orange;

  // Place crate 1 on pad
  const crate1 = w.crates[0];
  crate1.kind = 'crate';
  crate1.x = cfg.pad.x;
  crate1.z = cfg.pad.z;
  crate1.y = PAD_Y + CRATE_CONFIGS.crate.h / 2;
  crate1.vx = 0;
  crate1.vy = 0;
  crate1.vz = 0;

  const physics = new CraneClashPhysics(w);
  const scores = physics.calculateHeights();

  assert.ok(scores.orange.height > 0, 'height measured above 0');
  assert.equal(scores.orange.crates, 1, '1 crate counted on pad');
});

void test('peer engine creates, reconciles, steps, and takes actions', () => {
  const engine = createEngine(1000);
  assert.equal(engine.checkpoint().game, 'crane-clash');

  const w = engine.world;
  assert.equal(w.phase, 'lobby');

  engine.reconcile([
    {
      id: 'p0',
      name: 'Kranführer',
      color: 0,
      order: 0,
      instance: 'a',
      seen: 1000,
    },
  ]);

  // Start action
  engine.execute('p0', 'req-1', { type: 'start' }, 'p0');
  assert.equal(w.phase, 'playing');

  // Advance time
  engine.advance(50);
  assert.equal(w.clock, 1050);

  // Checkpoint & Snapshot
  const checkpoint = engine.checkpoint();
  assert.equal(checkpoint.game, 'crane-clash');
  const restored = createEngine(1050, checkpoint);
  assert.equal(restored.world.phase, 'playing');

  const snap = restored.snapshot('CRANE1', 'p0', 'p0', 1);
  assert.equal(snap.code, 'CRANE1');
  assert.equal(snap.host, 'p0');
});
