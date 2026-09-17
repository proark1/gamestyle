import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceScaffoldScramble,
  freshScaffoldWorld,
  newPlayer,
  scaffoldScrambleAction,
} from './simulation';
import { reconcileScaffoldBots, stepScaffoldBot } from './bots';
import {
  stepBucketPhysics,
  stepCradleKinematics,
  stepPlayerPhysics,
} from './physics';
import {
  CRADLE_WIDTH,
  ROUND_TIME_MS,
  TARGET_CLEANED_WINDOWS,
  TILT_SLIP_DEG,
  type GameEvent,
} from './types';
import { createEngine } from './peer';
import { scaffoldAvatars } from './avatar';

void test('world initializes with 30 dirty windows, 2 buckets, helicopter and 0-score', () => {
  const world = freshScaffoldWorld(Date.now(), 123);
  assert.equal(world.phase, 'lobby');
  assert.equal(world.cleanedCount, 0);
  assert.equal(world.totalWindows, 30);
  assert.equal(world.buckets.length, 2);
  assert.equal(world.cradle.tiltDeg, 0);
  assert.equal(world.helicopter.landed, false);

  const dirtyWindows = world.windows.filter((w) => w.status === 'dirty');
  assert.equal(dirtyWindows.length, 30);
});

void test('bot reconciliation maintains a full 4-person crew', () => {
  const world = freshScaffoldWorld(Date.now());
  world.players.push(newPlayer('p1', 'Player 1', 0, 'cleaner', false, 0));
  reconcileScaffoldBots(world);

  assert.equal(world.players.length, 4);
  const bots = world.players.filter((p) => p.bot);
  assert.equal(bots.length, 3);

  // Both left and right winches are staffed
  assert.ok(world.players.some((p) => p.role === 'left-winch'));
  assert.ok(world.players.some((p) => p.role === 'right-winch'));
});

void test('dual winch kinematics: uneven cranking tilts the cradle platform', () => {
  const world = freshScaffoldWorld(Date.now());
  world.players.push(newPlayer('p1', 'Left Worker', 0, 'left-winch', false, 0));

  // Crank left winch up multiple times
  for (let i = 0; i < 8; i++) {
    scaffoldScrambleAction(world, 'p1', {
      type: 'crank',
      winch: 'left',
      dir: 'up',
    });
  }

  // Left side is higher than right side
  assert.ok(world.cradle.leftHeight > world.cradle.rightHeight);
  // Negative tilt (tilts downhill towards right)
  assert.ok(world.cradle.tiltDeg < 0);

  // Now crank right winch up even more to tip it the other direction
  for (let i = 0; i < 16; i++) {
    scaffoldScrambleAction(world, 'p1', {
      type: 'crank',
      winch: 'right',
      dir: 'up',
    });
  }

  assert.ok(world.cradle.rightHeight > world.cradle.leftHeight);
  assert.ok(world.cradle.tiltDeg > 0);
});

void test('tilt past 20 degrees triggers slip hazard and worker loses footing', () => {
  const world = freshScaffoldWorld(Date.now());
  const player = newPlayer('p1', 'Worker', 0, 'cleaner', false, 0);
  player.deckX = 0;
  world.players.push(player);

  const events: GameEvent[] = [];
  const eventIdRef = { current: 0 };

  // Level platform: worker stands normally
  world.cradle.leftHeight = 50;
  world.cradle.rightHeight = 50;
  stepCradleKinematics(world.cradle, 0.016);
  stepPlayerPhysics(
    player,
    world.cradle,
    world.buckets,
    0.016,
    events,
    eventIdRef,
  );
  assert.equal(player.state, 'standing');

  // Extreme tilt: left winch raised high, right winch lowered
  // tan(theta) = (right - left) / CRADLE_WIDTH
  // For ~25 deg tilt: (CRADLE_WIDTH * tan(25 deg)) approx 10 * 0.466 = 4.66m
  world.cradle.leftHeight = 47.0;
  world.cradle.rightHeight = 52.5; // diff = 5.5m -> tilt approx 28.8 deg
  stepCradleKinematics(world.cradle, 0.016);

  assert.ok(Math.abs(world.cradle.tiltDeg) > TILT_SLIP_DEG);

  stepPlayerPhysics(
    player,
    world.cradle,
    world.buckets,
    0.016,
    events,
    eventIdRef,
  );
  assert.equal(player.state, 'sliding');
  assert.ok(player.slips > 0);
  assert.ok(events.some((e) => e.type === 'slip'));
});

void test('sliding over the cradle ledge catches worker on safety tether and dangles', () => {
  const world = freshScaffoldWorld(Date.now());
  const player = newPlayer('p1', 'Worker', 0, 'cleaner', false, 0);
  world.players.push(player);

  const events: GameEvent[] = [];
  const eventIdRef = { current: 0 };

  // Place worker right at the edge while sliding
  player.state = 'sliding';
  player.deckX = 4.7; // past the 4.65m boundary
  player.vx = 2.5;

  world.cradle.tiltRad = 0.45; // ~25 degrees
  world.cradle.tiltDeg = 25.0;

  stepPlayerPhysics(
    player,
    world.cradle,
    world.buckets,
    0.016,
    events,
    eventIdRef,
  );

  assert.equal(player.state, 'dangling');
  assert.ok(player.deckY < 0);
  assert.ok(player.dangles > 0);
  assert.ok(events.some((e) => e.type === 'dangle'));

  // Press jump / climb to recover
  player.input.jump = true;
  stepPlayerPhysics(
    player,
    world.cradle,
    world.buckets,
    0.016,
    events,
    eventIdRef,
  );
  assert.equal(player.state, 'climbing');

  // Level the cradle so worker can stand upon climbing up
  world.cradle.tiltRad = 0.1;
  world.cradle.tiltDeg = 5.0;

  // Complete climb
  for (let i = 0; i < 60; i++) {
    stepPlayerPhysics(
      player,
      world.cradle,
      world.buckets,
      0.05,
      events,
      eventIdRef,
    );
  }
  assert.equal(player.state, 'standing');
  assert.equal(player.deckY, 0);
});

void test('soap bucket slides down tilted deck and spills on heavy impact', () => {
  const world = freshScaffoldWorld(Date.now());
  const bucket = world.buckets[0];
  bucket.x = 0;
  bucket.vx = 0;

  const events: GameEvent[] = [];
  const eventIdRef = { current: 0 };

  // Tilt cradle to 30 degrees
  world.cradle.tiltRad = 0.52; // ~30 deg
  world.cradle.tiltDeg = 30.0;

  // Step physics for multiple frames
  for (let i = 0; i < 40; i++) {
    stepBucketPhysics(bucket, world.cradle, 0.016, events, eventIdRef);
  }

  // Bucket should have slid towards negative X
  assert.ok(bucket.x < 0);
  assert.ok(
    events.some((e) => e.type === 'bucket_slide' || e.type === 'bucket_spill'),
  );
});

void test('window cleaning cycle: dirty -> foamed with sponge -> spotless with squeegee', () => {
  const world = freshScaffoldWorld(Date.now());
  const player = newPlayer('p1', 'Cleaner', 0, 'cleaner', false, 0);
  world.players.push(player);

  world.phase = 'playing';
  world.startedAt = Date.now();
  world.endsAt = world.startedAt + ROUND_TIME_MS;

  // Pick first dirty window and align player and cradle with it
  const dirtyWin = world.windows.find((w) => w.status === 'dirty')!;
  world.cradle.centerHeight = dirtyWin.y - 1.0;
  world.cradle.leftHeight = world.cradle.centerHeight;
  world.cradle.rightHeight = world.cradle.centerHeight;
  world.cradle.tiltDeg = 0;
  world.cradle.tiltRad = 0;

  player.deckX = dirtyWin.x;
  player.tool = 'sponge';
  player.input.action = true;

  // Step simulation: apply soap foam
  advanceScaffoldScramble(world, Date.now(), 0.016);

  assert.equal(dirtyWin.status, 'foamed');
  assert.equal(dirtyWin.foamAmount, 1.0);

  // Switch to squeegee and wipe clean
  player.tool = 'squeegee';
  player.input.action = true;
  advanceScaffoldScramble(world, Date.now() + 100, 0.016);

  assert.equal(dirtyWin.status, 'spotless');
  assert.equal(dirtyWin.foamAmount, 0);
  assert.equal(world.cleanedCount, 1);
  assert.equal(player.windowsCleaned, 1);
  assert.equal(player.score, 100);
});

void test('cleaning 30 windows achieves crew victory before helicopter landing', () => {
  const world = freshScaffoldWorld(Date.now());
  world.phase = 'playing';
  world.startedAt = Date.now();
  world.endsAt = world.startedAt + ROUND_TIME_MS;
  world.cleanedCount = TARGET_CLEANED_WINDOWS - 1;

  // Clean the 30th window
  const dirtyWin = world.windows.find((w) => w.status === 'dirty')!;
  dirtyWin.status = 'foamed';

  const player = newPlayer('p1', 'Cleaner', 0, 'cleaner', false, 0);
  player.deckX = dirtyWin.x;
  player.tool = 'squeegee';
  player.input.action = true;
  world.players.push(player);

  world.cradle.centerHeight = dirtyWin.y - 1.0;
  world.cradle.leftHeight = world.cradle.centerHeight;
  world.cradle.rightHeight = world.cradle.centerHeight;

  advanceScaffoldScramble(world, Date.now(), 0.016);

  assert.equal(world.cleanedCount, TARGET_CLEANED_WINDOWS);
  assert.equal(world.phase, 'ended');
  assert.equal(world.winner, 'crew');
  assert.ok(world.events.some((e) => e.type === 'win'));
});

void test('helicopter landing timeout fails match if dirty windows remain', () => {
  const now = Date.now();
  const world = freshScaffoldWorld(now);
  world.phase = 'playing';
  world.startedAt = now - ROUND_TIME_MS;
  world.endsAt = now; // time is up!
  world.cleanedCount = 12; // only 12 / 30

  advanceScaffoldScramble(world, now + 10, 0.016);

  assert.equal(world.phase, 'ended');
  assert.equal(world.winner, 'failed');
  assert.equal(world.helicopter.landed, true);
  assert.ok(world.events.some((e) => e.type === 'timeout'));
});

void test('bot AI operates winch to balance tilted cradle', () => {
  const world = freshScaffoldWorld(Date.now());
  const rightBot = newPlayer('bot-r', 'Winch Bot', 1, 'right-winch', true, 1);
  world.players.push(rightBot);

  // Cradle is tilted: right side is higher than left side (+20 deg)
  world.cradle.leftHeight = 45;
  world.cradle.rightHeight = 52;
  world.cradle.tiltDeg = 20.0;
  world.cradle.tiltRad = 0.35;

  rightBot.deckX = CRADLE_WIDTH / 2 - 0.8; // at right winch station

  stepScaffoldBot(rightBot, world, 0.016);

  // Bot should crank right winch down to restore balance!
  assert.equal(rightBot.input.crankRightDown, true);
  assert.equal(rightBot.input.crankRightUp, false);
});

void test('peer engine creates and steps scaffold scramble adapter', () => {
  const engine = createEngine(Date.now());
  const snap = engine.snapshot('LOCAL', 'p-host', 'p-host', 1);
  assert.ok(snap);
  assert.equal(snap.world.totalWindows, 30);
});

void test('avatar looks catalog exposes high-rise cleaner model', () => {
  assert.ok(scaffoldAvatars.length > 0);
  const look = scaffoldAvatars[0];
  assert.equal(look.key, 'scaffold-cleaner');
  const instance = look.create();
  assert.ok(instance.root);
  instance.pose?.(1.0, true);
});
