import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceCraneClash,
  craneClashAction,
  freshClashWorld,
  newPlayer,
} from './simulation';
import { getTeamTargetCrate, reconcileClashBots } from './bots';
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

void test('solo player controls both crane and swinger simultaneously', () => {
  const w = freshClashWorld(1000);
  const player = newPlayer(
    'solo-p1',
    'SoloPlayer',
    0,
    'orange',
    'swinger',
    false,
  );
  w.players.push(player);
  reconcileClashBots(w);

  w.phase = 'playing';
  w.started = 1000;

  const initAngle = w.cranes.orange.angle;
  const initTrolley = w.cranes.orange.trolleyDist;

  // Provide dual inputs: craneX/craneZ/craneY and swinger x/z
  player.input = {
    x: 1, // Swinger lean forward
    z: 0,
    craneX: 1, // Crane slew
    craneZ: 1, // Crane trolley out
    craneY: 0,
    seq: 1,
  };
  player.seen = 1000;

  advanceCraneClash(w, 1050);

  // Crane moved
  assert.ok(
    w.cranes.orange.angle > initAngle,
    'crane slewed with solo crane input',
  );
  assert.ok(
    w.cranes.orange.trolleyDist > initTrolley,
    'trolley moved out with solo crane input',
  );
  // Swinger moved
  assert.ok(
    w.cranes.orange.hookVx !== 0,
    'swinger gained momentum from solo swinger input',
  );
});

void test('two human players on the same team have separate individual controls', () => {
  const w = freshClashWorld(1000);
  const op = newPlayer('p-op', 'Operator', 0, 'orange', 'operator', false);
  const sw = newPlayer('p-sw', 'Swinger', 1, 'orange', 'swinger', false);
  w.players.push(op, sw);
  reconcileClashBots(w);

  w.phase = 'playing';
  w.started = 1000;

  const initAngle = w.cranes.orange.angle;

  // Only operator inputs slew
  op.input = { x: 1, z: 0, seq: 1 };
  op.seen = 1000;
  // Swinger has 0 input
  sw.input = { x: 0, z: 0, seq: 1 };
  sw.seen = 1000;

  advanceCraneClash(w, 1050);

  assert.ok(w.cranes.orange.angle > initAngle, 'operator drove crane');
});

void test('solo player grab and release action toggles smoothly', () => {
  const w = freshClashWorld(1000);
  const player = newPlayer(
    'solo-p1',
    'SoloPlayer',
    0,
    'orange',
    'operator',
    false,
  );
  w.players.push(player);
  reconcileClashBots(w);

  w.phase = 'playing';
  w.started = 1000;

  // Place a crate right by Orange swinger
  const crate = w.crates[0];
  crate.x = w.cranes.orange.hookX;
  crate.y = w.cranes.orange.hookY - 0.5;
  crate.z = w.cranes.orange.hookZ;

  // First grab action
  craneClashAction(w, player.id, { type: 'grab' });
  const swinger = w.players.find(
    (p) => p.team === 'orange' && p.role === 'swinger',
  )!;
  assert.equal(
    swinger.holdingCrateId,
    crate.id,
    'swinger grabbed crate via solo player action',
  );

  // Second grab action should toggle to release
  craneClashAction(w, player.id, { type: 'grab' });
  assert.equal(swinger.holdingCrateId, null, 'crate released on second action');
});

void test('cooperative 2-bot team targets reachable crate and grabs it', () => {
  const w = freshClashWorld(1000);
  reconcileClashBots(w); // 4 bots
  w.phase = 'playing';
  w.started = 1000;

  // Verify target crate selection
  const targetCrate = getTeamTargetCrate(w, 'teal');
  assert.ok(targetCrate, 'teal bot team found a valid target crate');

  // Position crate within reach of teal hook to verify grab
  const tealHook = w.cranes.teal;
  targetCrate.x = tealHook.hookX;
  targetCrate.y = tealHook.hookY - 0.8;
  targetCrate.z = tealHook.hookZ;

  advanceCraneClash(w, 1050);

  const swingerBot = w.players.find(
    (p) => p.team === 'teal' && p.role === 'swinger',
  )!;
  assert.equal(
    swingerBot.holdingCrateId,
    targetCrate.id,
    'bot swinger successfully grabbed target crate',
  );
});

void test('cooperative 2-bot team settles over pad and stacks crate', () => {
  const w = freshClashWorld(1000);
  reconcileClashBots(w);
  w.phase = 'playing';
  w.started = 1000;

  const cfg = CRANE_CONFIG.orange;
  const crate = w.crates[0];
  const swinger = w.players.find(
    (p) => p.team === 'orange' && p.role === 'swinger',
  )!;

  // Simulate swinger already holding crate directly over the pad at placing height
  crate.heldBy = swinger.id;
  swinger.holdingCrateId = crate.id;

  const crane = w.cranes.orange;
  crane.trolleyDist = Math.hypot(
    cfg.pad.x - cfg.mast.x,
    cfg.pad.z - cfg.mast.z,
  );
  crane.angle = Math.atan2(cfg.pad.z - cfg.mast.z, cfg.pad.x - cfg.mast.x);
  crane.trolleyX = cfg.pad.x;
  crane.trolleyZ = cfg.pad.z;
  crane.hookX = cfg.pad.x;
  crane.hookZ = cfg.pad.z;
  crane.hookY = PAD_Y + 1.2;
  crane.hookVx = 0;
  crane.hookVy = 0;
  crane.hookVz = 0;

  advanceCraneClash(w, 1050);

  // Bot should have released the crate gently onto the pad
  assert.equal(swinger.holdingCrateId, null, 'swinger released crate onto pad');
  assert.equal(crate.heldBy, null, 'crate is free to settle on pad');
});
