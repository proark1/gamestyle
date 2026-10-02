import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshDriveThruWorld,
  newDriveThruPlayer,
  advanceDriveThruWorld,
  driveThruAction,
  generateOrderTicket,
} from './simulation';
import { stackLayer, orderProblems } from './rush';
function fixture() {
  const w = freshDriveThruWorld();
  w.players = ['driver', 'passenger', 'grill', 'barista'].map((r, i) =>
    newDriveThruPlayer(
      r,
      r,
      i,
      r as 'driver' | 'passenger' | 'grill' | 'barista',
    ),
  );
  Object.assign(w.car, { x: 0.15, z: 0.5, yaw: 0, speed: 0 });
  w.players[0].input.jump = true;
  return w;
}
function tick(w: ReturnType<typeof fixture>, seconds: number) {
  for (let t = 0; t < seconds - 1e-8; t += 1 / 60)
    advanceDriveThruWorld(w, 1 / 60, w.clock + 1000 / 60);
}
function ready(w: ReturnType<typeof fixture>) {
  w.kitchen.trayStack = [...w.ticket!.requestedBurger];
  w.kitchen.sodasPoured = w.ticket!.requestedDrinks;
  w.rush.friesReady = true;
}
void test('cups require a held pour followed by a release in the fill band', () => {
  const w = fixture(),
    b = w.players[3].input;
  b.action2 = true;
  tick(w, 1.35);
  assert.equal(w.kitchen.sodasPoured, 0);
  b.action2 = false;
  tick(w, 0.02);
  assert.equal(w.kitchen.sodasPoured, 1);
  const bad = fixture();
  bad.players[3].input.action2 = true;
  tick(bad, 2);
  bad.players[3].input.action2 = false;
  tick(bad, 0.02);
  assert.equal(bad.kitchen.sodasPoured, 0);
  assert.match(bad.rush.notice, /overflowed/);
});
void test('exact recipe consumes only flipped cooked patties and rejects skipped layers', () => {
  const w = fixture();
  assert.equal(stackLayer(w, 'top_bun'), false);
  assert.equal(stackLayer(w, 'bottom_bun'), true);
  tick(w, 0.7);
  assert.equal(stackLayer(w, 'patty'), false);
  const p = w.kitchen.patties[0];
  p.state = 'cooked';
  assert.equal(stackLayer(w, 'patty'), false);
  w.rush.flipped.push(p.id);
  assert.equal(stackLayer(w, 'patty'), true);
  assert.equal(w.kitchen.patties.length, 0);
  assert.ok(orderProblems(w).length);
});
void test('slide needs a complete ticket and properly charged release', () => {
  const w = fixture(),
    b = w.players[3].input;
  b.action3 = true;
  tick(w, 1);
  assert.equal(w.rush.stage, 'preparing');
  ready(w);
  tick(w, 0.9);
  assert.equal(w.rush.stage, 'charging');
  b.action3 = false;
  tick(w, 0.02);
  assert.equal(w.rush.stage, 'sliding');
  assert.equal(w.kitchen.trayAtWindow, false);
  tick(w, 1.2);
  assert.equal(w.rush.stage, 'offered');
});
void test('overcharged tray loses a cup but preserves burger and allows another attempt', () => {
  const w = fixture();
  ready(w);
  w.players[3].input.action3 = true;
  tick(w, 1.8);
  w.players[3].input.action3 = false;
  tick(w, 0.02);
  assert.equal(w.rush.stage, 'preparing');
  assert.equal(w.rush.spills, 1);
  assert.equal(w.kitchen.sodasPoured, 0);
  assert.deepEqual(w.kitchen.trayStack, w.ticket!.requestedBurger);
  assert.notEqual(w.phase, 'meltdown');
});
void test('secure then retract completes one order, preserving score into a harder ticket', () => {
  const w = fixture();
  ready(w);
  w.rush.stage = 'offered';
  w.kitchen.trayAtWindow = true;
  const p = w.players[1].input;
  p.action1 = true;
  for (let i = 0; i < 240 && w.rush.stage === 'offered'; i++) {
    p.x = -w.car.balanceMeter * 2;
    tick(w, 1 / 60);
  }
  assert.equal(w.rush.stage, 'carrying');
  assert.equal(w.ordersServed, 0);
  p.action1 = false;
  for (let i = 0; i < 150 && w.rush.stage === 'carrying'; i++) {
    p.x = -w.car.balanceMeter * 2;
    tick(w, 1 / 60);
  }
  assert.equal(w.ordersServed, 1);
  assert.equal(w.rush.stage, 'between');
  const score = w.score;
  tick(w, 3.6);
  assert.equal(w.ticket!.orderNumber, 2);
  assert.equal(w.score, score);
  assert.equal(w.kitchen.patties.length, 2);
  assert.equal(w.kitchen.trayStack.length, 0);
});
void test('moving during the carry spills; a handbrake holds the sloped pickup bay', () => {
  const w = fixture();
  ready(w);
  w.rush.stage = 'carrying';
  w.car.passengerReach = 1;
  w.players[1].input.action1 = true;
  tick(w, 1);
  assert.equal(w.rush.spills, 0);
  w.players[0].input.jump = false;
  w.players[0].input.action1 = true;
  tick(w, 0.3);
  assert.equal(w.rush.spills, 1);
  assert.notEqual(w.phase, 'meltdown');
});
void test('fries, burnt patties and shake splats all have working recovery paths', () => {
  const w = fixture();
  w.ticket = generateOrderTicket(2);
  w.kitchen.fryerBasketDown = true;
  w.kitchen.fryerTimer = 0.2;
  driveThruAction(w, 'grill', { type: 'liftFryer' });
  assert.equal(w.rush.friesReady, false);
  w.kitchen.fryerTimer = 0.6;
  driveThruAction(w, 'grill', { type: 'liftFryer' });
  assert.equal(w.rush.friesReady, true);
  Object.assign(w.kitchen.patties[0], {
    sizzleProgress: 1,
    burnProgress: 1,
    state: 'fire',
  });
  tick(w, 0.02);
  assert.equal(w.kitchen.patties[0].state, 'raw');
  assert.notEqual(w.phase, 'meltdown');
  w.car.windshieldSplat = 1;
  w.car.wipersActive = true;
  tick(w, 2);
  assert.equal(w.car.windshieldSplat, 0);
});
void test('warning can be swatted and ended shifts reject actions', () => {
  const w = fixture();
  w.rush.warning = 1;
  driveThruAction(w, 'passenger', { type: 'swatDistraction' });
  assert.equal(w.rush.warning, 0);
  w.phase = 'completed';
  const stack = [...w.kitchen.trayStack];
  driveThruAction(w, 'grill', { type: 'stackNext' });
  assert.deepEqual(w.kitchen.trayStack, stack);
});
