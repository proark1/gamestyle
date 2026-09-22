import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceDriveThruWorld,
  freshDriveThruWorld,
  generateOrderTicket,
  newDriveThruPlayer,
} from './simulation';
import {
  computeWindowReachGap,
  GRILL_BOUNDS,
  SPEAKER_POLE_POS,
  stepCarPhysics,
  stepPattyPhysics,
} from './physics';
import { reconcileDriveThruBots, stepDriveThruBot } from './bots';
import { createEngine } from './peer';
import { driveThruCatalog } from './audio/catalog';
import { promptLimit } from '../../shared/audio/limits';
import type { DriveThruSnapshot, Patty, SedanState } from './types';

void test('Drive-Thru: fresh world initializes with ordering phase and 75s timer', () => {
  const w = freshDriveThruWorld();
  assert.equal(w.phase, 'ordering');
  assert.equal(w.phaseTimer, 75);
  assert.ok(w.ticket);
  assert.equal(w.kitchen.patties.length, 1);
  assert.equal(w.failState, 'none');
  assert.equal(w.car.honking, false);
});

void test('Drive-Thru: order tickets generate scrambled and clear text with burger layers', () => {
  const t1 = generateOrderTicket(1);
  assert.ok(t1.scrambledText.includes('['));
  assert.ok(t1.requestedBurger.includes('patty'));
  assert.ok(t1.requestedDrinks >= 1);
});

void test('Drive-Thru: sedan steering and throttle physics advance position', () => {
  const w = freshDriveThruWorld();
  const initialZ = w.car.z;

  // Throttle forward for 1 second
  stepCarPhysics(w.car, true, false, 0, 1.0);
  assert.ok(w.car.speed > 0);
  assert.ok(w.car.z < initialZ, 'Forward car moves along negative Z');
});

void test('Drive-Thru: a car scraping the curb keeps the same speed at any frame rate', () => {
  // Scraping cost a flat 15% of the speed per step, so a car pressed on the
  // curb crawled at 1.23 m/s at 30 fps but 0.26 m/s at 144 fps.
  const scrapeSpeed = (hz: number) => {
    const car = { ...freshDriveThruWorld().car, x: 1.8, yaw: Math.PI / 2 };
    for (let i = 0; i < hz; i++) stepCarPhysics(car, true, false, 0, 1 / hz);
    return car.speed;
  };
  const at60 = scrapeSpeed(60);
  for (const hz of [30, 144]) {
    const speed = scrapeSpeed(hz);
    assert.ok(
      Math.abs(speed - at60) < 0.1,
      `${hz} Hz: ${speed.toFixed(2)} m/s on the curb, ${at60.toFixed(2)} at 60 Hz`,
    );
  }
});

void test('Drive-Thru: pole collision costs time and allows recovery', () => {
  const w = freshDriveThruWorld();
  // Place car right at the speaker pole and reverse into it
  w.car.x = SPEAKER_POLE_POS.x;
  w.car.z = SPEAKER_POLE_POS.z + 0.3;
  w.car.speed = -2.5;

  stepCarPhysics(w.car, false, true, 0, 0.1);
  assert.equal(w.car.reversedIntoPole, true);

  advanceDriveThruWorld(w, 0.1);
  assert.equal(w.failState, 'none');
  assert.notEqual(w.phase, 'meltdown');
  assert.ok(w.phaseTimer < 70);
  assert.ok(w.events.some((e) => e.kind === 'pole_crashed'));
});

void test('Drive-Thru: patty flips with upward impulse and cooks on grill surface', () => {
  const patty: Patty = {
    id: 'test-patty',
    x: 4.0,
    y: GRILL_BOUNDS.y,
    z: -0.5,
    vx: 0,
    vy: 0,
    vz: 0,
    flipAngle: 0,
    state: 'raw',
    sizzleProgress: 0,
    burnProgress: 0,
    onSpatula: false,
  };

  // Flip upward
  patty.vy = 4.0;
  stepPattyPhysics(patty, 0.1);
  assert.ok(patty.y > GRILL_BOUNDS.y);
  assert.ok(patty.flipAngle > 0);

  // Return to grill and progress cooking
  patty.y = GRILL_BOUNDS.y;
  patty.vy = 0;
  for (let i = 0; i < 50; i++) {
    stepPattyPhysics(patty, 0.1);
  }
  assert.ok(patty.state === 'sizzling' || patty.state === 'cooked');
});

void test('Drive-Thru: overcooked fries are replaced with a time penalty', () => {
  const w = freshDriveThruWorld();
  w.kitchen.fryerBasketDown = true;
  w.kitchen.fryerTimer = 0.98;

  advanceDriveThruWorld(w, 1.0);
  assert.ok(w.kitchen.fryerTimer < 0.1);
  assert.equal(w.failState, 'none');
  assert.notEqual(w.phase, 'meltdown');
  assert.ok(w.phaseTimer < 71);
});

void test('Drive-Thru: a meltdown ends the round even with the car stopped by the window', () => {
  // The window check used to run after the fail checks and flip the phase
  // back to 'reaching', so the round carried on after the fire.
  const w = freshDriveThruWorld();
  Object.assign(w.car, { x: -1.23, z: 0.52, yaw: -0.54, speed: 0 });
  w.phaseTimer = 0.01;

  advanceDriveThruWorld(w, 0.1, w.clock + 100);
  assert.equal(w.failState, 'none');
  assert.equal(w.phase, 'meltdown');
  advanceDriveThruWorld(w, 0.1, w.clock + 100);
  assert.equal(w.phase, 'meltdown');
});

void test('Drive-Thru: unvented milkshake machine explodes and splatters windshield', () => {
  const w = freshDriveThruWorld();
  w.kitchen.shakePressure = 98;

  advanceDriveThruWorld(w, 0.5);
  assert.equal(w.kitchen.shakeExploded, true);
  assert.equal(w.car.windshieldSplat, 1.0);
});

void test('Drive-Thru: venting milkshake pressure prevents blowout', () => {
  const w = freshDriveThruWorld();
  w.players = [newDriveThruPlayer('test-p', 'Barista', 0, 'barista', false)];
  w.kitchen.shakePressure = 80;

  w.players[0].input.action1 = true;
  advanceDriveThruWorld(w, 1);
  assert.ok(w.kitchen.shakePressure < 55);
  assert.equal(w.kitchen.shakeExploded, false);
});

void test('Drive-Thru: Short Stop detection triggers when car parks too far from ledge', () => {
  const w = freshDriveThruWorld();
  // Park car with passenger window ~1.05m from sill (Short Stop range: 0.75m to 2.2m)
  w.car.x = 0.2;
  w.car.z = 0;
  w.car.yaw = 0;

  const check = computeWindowReachGap(w.car);
  assert.equal(check.isShortStop, true);
  assert.equal(check.canReach, true);
});

void test('Drive-Thru: bot reconciliation ensures all 4 roles have players', () => {
  const w = freshDriveThruWorld();
  w.players = [newDriveThruPlayer('human-1', 'Alice', 0, 'driver', false)];

  reconcileDriveThruBots(w);
  assert.equal(w.players.length, 4);
  const roles = w.players.map((p) => p.role);
  assert.ok(roles.includes('driver'));
  assert.ok(roles.includes('passenger'));
  assert.ok(roles.includes('grill'));
  assert.ok(roles.includes('barista'));
});

void test('Drive-Thru: a bots-only round steers around the speaker pole and serves the order', () => {
  // The car starts right behind the pole. The bot driver used to grind into
  // it: free after half a minute at 60 fps, and at 144 fps a patty caught
  // fire before it ever got loose.
  for (const hz of [30, 60, 144]) {
    const w = freshDriveThruWorld();
    reconcileDriveThruBots(w);
    let seconds = 0;
    while (w.phase !== 'completed' && w.phase !== 'meltdown' && seconds < 80) {
      for (const p of w.players) if (p.bot) stepDriveThruBot(p, w, 1 / hz);
      advanceDriveThruWorld(w, 1 / hz, w.clock + 1000 / hz);
      seconds += 1 / hz;
    }
    assert.equal(
      w.phase,
      'completed',
      `${hz} Hz: ${w.phase} after ${seconds.toFixed(1)} s (${w.failReason})`,
    );
    assert.equal(w.ordersServed, 3);
    assert.equal(w.car.bumperDamage, 0, `${hz} Hz: the car hit the pole`);
  }
});

/**
 * Plays a bots-only round with the car handed over at `start`, at 30, 60 and
 * 144 Hz, and requires the order served within 10 simulated seconds without
 * touching the speaker pole.
 */
function assertBotsServeFrom(
  start: Pick<SedanState, 'x' | 'z' | 'yaw'>,
  deadline = 85,
) {
  for (const hz of [30, 60, 144]) {
    const w = freshDriveThruWorld();
    reconcileDriveThruBots(w);
    Object.assign(w.car, start, { speed: 0 });
    let seconds = 0;
    while (
      w.phase !== 'completed' &&
      w.phase !== 'meltdown' &&
      seconds < deadline
    ) {
      for (const p of w.players) if (p.bot) stepDriveThruBot(p, w, 1 / hz);
      advanceDriveThruWorld(w, 1 / hz, w.clock + 1000 / hz);
      seconds += 1 / hz;
    }
    const from = `from (${start.x}, ${start.z}) at ${hz} Hz`;
    assert.equal(
      w.phase,
      'completed',
      `${from}: ${w.phase} after ${seconds.toFixed(1)} s (${w.failReason})`,
    );
    assert.equal(w.ordersServed, 3);
    assert.equal(w.car.bumperDamage, 0, `${from}: the car hit the pole`);
  }
}

void test('Drive-Thru: a bot taking the wheel off the lane line by the window still serves the order', () => {
  // A human driver can leave the car beside the window but metres off the
  // lane line, too close for the ~7 m turning circle to line it up. The bot
  // used to stop there out of the passenger's reach, stalling the round.
  assertBotsServeFrom({ x: -3, z: 1.5, yaw: 0.8 }); // pulls on past the stop
  assertBotsServeFrom({ x: -1.23, z: 0.52, yaw: -0.54 }); // backs up, comes round
  assertBotsServeFrom({ x: -4.5, z: 1.5, yaw: 0.3 }); // backs up past the pole
});

void test('Drive-Thru: a bot handed a car across the lane works it round and serves the order', () => {
  // Behind the pole against the curb, every forward turn clips the pole, and
  // nosed into the far edge the car only grinds along it. The bot used to
  // stall in both; now it reverses while turning toward the lane.
  // Full-size body and correct reverse steering require a three-point turn.
  assertBotsServeFrom({ x: 1, z: 14.5, yaw: -1.2 }, 95);
  assertBotsServeFrom({ x: -8, z: 5.5, yaw: -1.2 }, 95);
});

void test('Drive-Thru: peer engine creates room, accepts actions, and builds snapshot', () => {
  const engine = createEngine(Date.now());
  assert.equal(engine.checkpoint().game, 'drive-thru');

  engine.reconcile([
    {
      id: 'p-test',
      name: 'Tester',
      color: 0,
      order: 0,
      instance: 'a',
      seen: 1000,
    },
  ]);
  assert.equal(engine.world.players.length, 4);

  engine.execute('p-test', 'req-1', { type: 'honk' }, 'p-test');
  engine.advance(1 / 60);

  const snap = engine.snapshot(
    'ROOM',
    'p-test',
    'p-test',
    Date.now(),
  ) as DriveThruSnapshot;
  assert.ok(snap);
  assert.ok(snap.events.some((e) => e.kind === 'horn_honked'));
});

void test('Drive-Thru: ElevenLabs audio catalog conforms to prompt length limits', () => {
  for (const cue of driveThruCatalog) {
    const limit = promptLimit(cue.category);
    assert.ok(
      cue.prompt.length <= limit,
      `Cue ${cue.id} prompt length ${cue.prompt.length} exceeds limit ${limit}`,
    );
    assert.ok(cue.duration > 0, `Cue ${cue.id} duration must be positive`);
  }
});
