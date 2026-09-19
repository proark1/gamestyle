import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advanceSampleStampedeTick,
  advanceSampleStampedeWorld,
  freshSampleStampedeWorld,
  newStampedePlayer,
  sampleStampedeSnapshot,
} from './simulation';
import { SampleStampedePhysics } from './physics';
import { createEngine } from './peer';
import { eventsToShow } from './scene';
import {
  ITEM_DEFS,
  type ItemKind,
  type PlayerInput,
  type ShoppingCart,
  type StampedeEvent,
} from './types';

// The solo game's red crew: the player drives, a bot rides in the basket.
function soloWorld() {
  const world = freshSampleStampedeWorld(1000);
  world.players.push(
    newStampedePlayer('me', 'You', 0, 'red', 'cart-red', 'driver'),
    newStampedePlayer('gus', 'Gus', 1, 'red', 'cart-red', 'grabber', true),
  );
  return world;
}

// A point straight ahead of the cart.
function ahead(cart: { x: number; z: number; rotY: number }, distance: number) {
  return {
    x: cart.x + Math.cos(cart.rotY) * distance,
    z: cart.z - Math.sin(cart.rotY) * distance,
  };
}

const redSwings = (events: StampedeEvent[]) =>
  events.filter((e) => e.type === 'grabber_whack' && e.team === 'red').length;

void test('cart mass increases dynamically as bulk items are loaded into the basket', () => {
  const world = freshSampleStampedeWorld(1000);
  const cart = world.carts[0];
  assert.equal(cart.baseMass, 45);
  assert.equal(cart.totalMass, 45);

  const physics = new SampleStampedePhysics(world);
  const events: StampedeEvent[] = [];
  const inputs = new Map<string, PlayerInput>();

  // Add 50lb Kibble (45kg) and 80-pack Mega Soda (38kg)
  cart.items.push({
    id: 'test-kibble',
    kind: 'kibble_50lb',
    relX: 0,
    relY: 0.2,
    relZ: 0,
    rotY: 0,
  });
  cart.items.push({
    id: 'test-soda',
    kind: 'mega_soda',
    relX: 0,
    relY: 0.4,
    relZ: 0,
    rotY: 0,
  });

  // Step physics
  physics.step(1 / 60, inputs, events);

  // Mass should equal 45 (base) + 45 (kibble) + 38 (soda) = 128kg!
  assert.equal(cart.totalMass, 128);

  physics.destroy();
});

void test('squeaky wheel wobbles and advances phase while cart is moving', () => {
  const world = freshSampleStampedeWorld(1000);
  const player = newStampedePlayer(
    'p1',
    'Shopper',
    0,
    'red',
    'cart-red',
    'driver',
    false,
  );
  world.players.push(player);
  const cart = world.carts[0];

  const physics = new SampleStampedePhysics(world);
  const events: StampedeEvent[] = [];
  const inputs = new Map<string, PlayerInput>();

  inputs.set('p1', {
    x: 0,
    z: 1.0,
    steer: 0,
    throttle: 1.0, // Full throttle forward
    drift: false,
    grabberAction: false,
  });

  const initialWobble = cart.wobblePhase;

  // Step physics for 30 ticks
  for (let i = 0; i < 30; i++) {
    physics.step(1 / 60, inputs, events);
  }

  assert.ok(
    cart.wobblePhase > initialWobble,
    'Squeaky wheel wobble phase should advance with speed',
  );
  assert.ok(
    cart.wobbleIntensity > 0,
    'Wobble intensity should increase as cart gains forward speed',
  );

  physics.destroy();
});

void test('driving over slippery paper plate triggers slip spinout hazard', () => {
  const world = freshSampleStampedeWorld(1000);
  const cart = world.carts[0];
  const physics = new SampleStampedePhysics(world);
  const events: StampedeEvent[] = [];
  const inputs = new Map<string, PlayerInput>();

  // Place a paper plate hazard directly ahead of the cart
  world.hazards.push({
    id: 'slip-test-plate',
    x: cart.x,
    z: cart.z, // directly under cart
    kind: 'plate',
    rotation: 0,
    duration: 30,
  });

  assert.equal(cart.slipSpinTimer, 0);

  // Step physics
  physics.step(1 / 60, inputs, events);

  assert.ok(
    cart.slipSpinTimer > 0,
    'Cart should enter slip spin state after touching paper plate',
  );
  assert.ok(
    events.some((e) => e.type === 'plate_slip'),
    'plate_slip event should be dispatched',
  );

  physics.destroy();
});

void test('collecting sample item grants nitrous sugar rush speed boost', () => {
  const world = freshSampleStampedeWorld(1000);
  const player = newStampedePlayer(
    'p1',
    'Shopper',
    0,
    'red',
    'cart-red',
    'driver',
    false,
  );
  world.players.push(player);
  const cart = world.carts[0];

  const physics = new SampleStampedePhysics(world);
  const events: StampedeEvent[] = [];
  const inputs = new Map<string, PlayerInput>();

  // Place sample item right at the reach position of the grabber
  const reachX = cart.x + Math.cos(cart.rotY) * 2.0;
  const reachZ = cart.z - Math.sin(cart.rotY) * 2.0;
  physics.spawnGroundItem('sample_taquito', reachX, 0.5, reachZ, false);

  // Trigger grabber action
  inputs.set('p1', {
    x: 0,
    z: 0,
    steer: 0,
    throttle: 0,
    drift: false,
    grabberAction: true,
  });

  physics.step(1 / 60, inputs, events);

  assert.ok(
    cart.sugarRushTimer > 0,
    'Snagging a sample should trigger sugar rush turbo timer',
  );
  assert.ok(
    cart.items.some((it) => it.kind === 'sample_taquito'),
    'Sample should be added into cart basket',
  );

  physics.destroy();
});

void test('exit receipt gauntlet approves completed manifest and scores points', () => {
  const world = freshSampleStampedeWorld(1000);
  const cart = world.carts[0];

  // Fill cart with required items to fulfill default manifest
  for (const target of cart.manifest.targetItems) {
    for (let i = 0; i < target.required; i++) {
      cart.items.push({
        id: `item-${target.kind}-${i}`,
        kind: target.kind,
        relX: 0,
        relY: 0.2,
        relZ: 0,
        rotY: 0,
      });
    }
  }

  // Move cart inside the Exit Gauntlet inspection zone
  cart.x = world.exitGauntlet.x;
  cart.z = world.exitGauntlet.z;

  const physics = new SampleStampedePhysics(world);
  const events: StampedeEvent[] = [];

  advanceSampleStampedeWorld(world, physics, 1 / 60, events);

  assert.ok(
    events.some((e) => e.type === 'receipt_approved'),
    'Receipt should be approved when all manifest items are present',
  );
  assert.ok(cart.score > 0, 'Team should be awarded points upon approval');
  assert.equal(
    cart.items.length,
    0,
    'Cart items should be checked out and cleared',
  );

  physics.destroy();
});

void test('exit receipt gauntlet rejects cart contaminated by 10-foot giant teddy bear', () => {
  const world = freshSampleStampedeWorld(1000);
  const cart = world.carts[0];

  // Fill cart with valid items...
  for (const target of cart.manifest.targetItems) {
    for (let i = 0; i < target.required; i++) {
      cart.items.push({
        id: `item-${target.kind}-${i}`,
        kind: target.kind,
        relX: 0,
        relY: 0.2,
        relZ: 0,
        rotY: 0,
      });
    }
  }

  // BUT also add the unauthorized 10-foot giant teddy bear contraband!
  cart.items.push({
    id: 'sabotage-teddy',
    kind: 'giant_teddy',
    relX: 0,
    relY: 0.5,
    relZ: 0,
    rotY: 0,
  });

  // Move cart inside the Exit Gauntlet
  cart.x = world.exitGauntlet.x;
  cart.z = world.exitGauntlet.z;

  const physics = new SampleStampedePhysics(world);
  const events: StampedeEvent[] = [];

  advanceSampleStampedeWorld(world, physics, 1 / 60, events);

  assert.ok(
    events.some((e) => e.type === 'receipt_rejected'),
    'Receipt checker should reject cart with unauthorized giant teddy bear',
  );
  assert.equal(cart.score, 0, 'No points awarded on rejection');
  assert.ok(
    cart.rejectedUntil > world.clock,
    'Cart should receive penalty delay',
  );

  physics.destroy();
});

void test('peer engine creates sample-stampede room and manages players', () => {
  const engine = createEngine(1000);
  assert.equal(engine.checkpoint().game, 'sample-stampede');

  // Reconcile members (simulating player joining peer room)
  engine.reconcile([
    {
      id: 'human-1',
      name: 'Shopper Sam',
      order: 0,
      color: 0,
      instance: 'inst-1',
      seen: 1000,
    },
  ]);

  const cp = engine.checkpoint();
  const world = cp.world;
  const human = world.players.find((p) => p.id === 'human-1');
  assert.ok(human, 'Human player should be registered in the world');

  // Advance engine
  engine.advance(1 / 60);
  assert.ok(
    engine.checkpoint().world.clock > 1000,
    'Engine clock should advance on tick',
  );
});

void test("the solo player's GRAB works the pole beside a bot rider", () => {
  const world = soloWorld();
  const cart = world.carts[0];
  const physics = new SampleStampedePhysics(world);
  // In the pole's reach, but not on the list, so the bot rider leaves it.
  const spot = ahead(cart, 2.4);
  physics.spawnGroundItem('cereal_box', spot.x, 0.5, spot.z, false);

  const idle: StampedeEvent[] = [];
  advanceSampleStampedeWorld(world, physics, 1 / 60, idle);
  assert.equal(redSwings(idle), 0);

  const me = world.players[0];
  me.input = { ...me.input, grabberAction: true };
  const events: StampedeEvent[] = [];
  advanceSampleStampedeWorld(world, physics, 1 / 60, events);

  assert.equal(redSwings(events), 1);
  assert.ok(cart.items.some((it) => it.kind === 'cereal_box'));
  physics.destroy();
});

void test("a GRAB tap during the bot rider's cooldown swings once the pole is free", () => {
  const world = soloWorld();
  const cart = world.carts[0];
  const physics = new SampleStampedePhysics(world);
  const spot = ahead(cart, 2);
  physics.spawnGroundItem('paper_towels', spot.x, 0.5, spot.z, false);

  // The bot rider snags the roll, which starts the pole's cooldown.
  const first: StampedeEvent[] = [];
  advanceSampleStampedeWorld(world, physics, 1 / 60, first);
  assert.equal(redSwings(first), 1);

  // The player taps GRAB for 200 ms, well before the cooldown ends.
  const me = world.players[0];
  const swungAt: number[] = [];
  for (let frame = 0; frame < 90; frame++) {
    me.input = { ...me.input, grabberAction: frame < 12 };
    const events: StampedeEvent[] = [];
    advanceSampleStampedeWorld(world, physics, 1 / 60, events);
    if (redSwings(events)) swungAt.push(frame);
  }
  assert.equal(swungAt.length, 1, 'the tap swings exactly once');
  assert.ok(swungAt[0] >= 12, 'after the tap was released');
  physics.destroy();
});

void test('the scene shows each event once, from a solo frame or a room snapshot', () => {
  const shown = new Set<number>();

  // Solo keeps no events on the world; Game.tsx hands in the frame's own.
  const world = soloWorld();
  const cart = world.carts[0];
  const physics = new SampleStampedePhysics(world);
  world.hazards.push({
    id: 'plate-under-cart',
    x: cart.x,
    z: cart.z,
    kind: 'plate',
    rotation: 0,
    duration: 30,
  });
  const frame: StampedeEvent[] = [];
  advanceSampleStampedeWorld(world, physics, 1 / 60, frame);
  const snap = sampleStampedeSnapshot(world, 'SOLO', 'me', 'me', 1);
  assert.equal(snap.world.events.length, 0);
  const slip = eventsToShow(shown, snap.world.events, frame);
  assert.deepEqual(
    slip.map((e) => e.type),
    ['plate_slip'],
  );
  physics.destroy();

  // A room snapshot repeats its recent events; only the new one shows.
  const snag: StampedeEvent = {
    id: slip[0].id + 1,
    type: 'item_snagged',
    x: 0,
    y: 0,
    z: 0,
    text: '+ Paper Towels',
  };
  assert.deepEqual(eventsToShow(shown, [...slip, snag]), [snag]);
  assert.deepEqual(eventsToShow(shown, [...slip, snag]), []);

  // The memory of shown ids stays small over a long match.
  for (let id = 0; id < 1000; id++) eventsToShow(shown, [], [{ ...snag, id }]);
  assert.ok(shown.size <= 128);
});

void test("a room keeps only recent events, and a tick's events reach its snapshot", () => {
  const world = freshSampleStampedeWorld(1000);
  for (let id = 0; id < 200; id++)
    world.events.push({ id, type: 'grabber_whack', x: 0, y: 0, z: 0 });
  const cart = world.carts[0];
  world.hazards.push({
    id: 'plate-under-cart',
    x: cart.x,
    z: cart.z,
    kind: 'plate',
    rotation: 0,
    duration: 30,
  });

  advanceSampleStampedeTick(world, 1016);

  assert.equal(world.events.length, 25, "the last 24, then this tick's slip");
  const snap = sampleStampedeSnapshot(world, 'ROOM', 'host', 'host', 1);
  assert.equal(snap.world.events.at(-1)?.type, 'plate_slip');
});

void test('a bot driver turns toward the item it wants', () => {
  const world = freshSampleStampedeWorld(1000);
  world.players.push(
    newStampedePlayer('bot', 'Bot', 0, 'red', 'cart-red', 'driver', true),
  );
  for (const kiosk of world.kiosks) kiosk.active = false;
  const cart = world.carts[0];
  // One roll the manifest wants, 12 m to the cart's left.
  const roll = world.groundItems.find((it) => it.kind === 'paper_towels')!;
  world.groundItems = [
    { ...roll, x: cart.x - 12, y: 0.5, z: cart.z, onShelf: false },
  ];
  const physics = new SampleStampedePhysics(world);
  const distance = () =>
    Math.hypot(
      world.groundItems[0].x - cart.x,
      world.groundItems[0].z - cart.z,
    );

  for (let frame = 0; frame < 90; frame++)
    advanceSampleStampedeWorld(world, physics, 1 / 60, []);

  assert.ok(distance() < 8, `still ${distance().toFixed(1)} m away`);
  physics.destroy();
});

// A point `distance` from the cart, `angle` off its heading (left positive).
function offHeading(cart: ShoppingCart, angle: number, distance: number) {
  return {
    x: cart.x + Math.cos(cart.rotY + angle) * distance,
    z: cart.z - Math.sin(cart.rotY + angle) * distance,
  };
}

function load(cart: ShoppingCart, kinds: ItemKind[]) {
  for (const kind of kinds)
    cart.items.push({
      id: `held-${cart.items.length}`,
      kind,
      relX: 0,
      relY: 0.2,
      relZ: 0,
      rotY: 0,
    });
}

const crashes = (events: StampedeEvent[]) =>
  events.filter((e) => e.type === 'cart_crash').length;

void test('speed alone sheds no stock; a hard hit into a rack sheds one item', () => {
  // Full throttle up the open lane between aisles 2 and 3.
  const open = freshSampleStampedeWorld(1000);
  open.players.push(
    newStampedePlayer('me', 'You', 0, 'red', 'cart-red', 'driver'),
  );
  const runner = open.carts[0];
  load(runner, ['paper_towels', 'kibble_50lb', 'mega_soda']);
  const openPhysics = new SampleStampedePhysics(open);
  open.players[0].input = { ...open.players[0].input, throttle: 1, z: 1 };
  const fast: StampedeEvent[] = [];
  for (let frame = 0; frame < 60; frame++)
    advanceSampleStampedeWorld(open, openPhysics, 1 / 60, fast);
  assert.ok(Math.hypot(runner.vx, runner.vz) > 7.5, 'the cart got going');
  assert.equal(runner.items.length, 3);
  assert.equal(crashes(fast), 0);
  openPhysics.destroy();

  // Full throttle into the end of aisle 2's south rack, 3 m ahead.
  const world = freshSampleStampedeWorld(1000);
  world.players.push(
    newStampedePlayer('me', 'You', 0, 'red', 'cart-red', 'driver'),
  );
  const cart = world.carts[0];
  cart.x = -9;
  cart.z = 22;
  load(cart, ['paper_towels', 'kibble_50lb', 'mega_soda']);
  const physics = new SampleStampedePhysics(world);
  world.players[0].input = { ...world.players[0].input, throttle: 1, z: 1 };
  const events: StampedeEvent[] = [];
  for (let frame = 0; frame < 60; frame++)
    advanceSampleStampedeWorld(world, physics, 1 / 60, events);
  assert.equal(crashes(events), 1, 'one crash, however long it pushes on');
  assert.equal(cart.items.length, 2);
  assert.ok(world.groundItems.some((it) => it.kind === 'mega_soda'));
  physics.destroy();
});

void test('the bot rider aims at a listed item beside the cart and leaves a teddy', () => {
  const world = soloWorld();
  const cart = world.carts[0];
  const physics = new SampleStampedePhysics(world);

  const right = offHeading(cart, -Math.PI / 2, 2.5);
  physics.spawnGroundItem('giant_teddy', right.x, 0.5, right.z, false);
  const quiet: StampedeEvent[] = [];
  advanceSampleStampedeWorld(world, physics, 1 / 60, quiet);
  assert.equal(redSwings(quiet), 0, 'a teddy is not on the list');

  const left = offHeading(cart, Math.PI / 2, 2.5);
  physics.spawnGroundItem('paper_towels', left.x, 0.5, left.z, false);
  const events: StampedeEvent[] = [];
  advanceSampleStampedeWorld(world, physics, 1 / 60, events);
  assert.equal(redSwings(events), 1);
  assert.ok(Math.abs(cart.grabberAngle - Math.PI / 2) < 0.2, 'aimed left');
  assert.deepEqual(
    cart.items.map((it) => it.kind),
    ['paper_towels'],
  );
  physics.destroy();
});

void test('the kiosks take turns, so pizza bagels come out too', () => {
  const world = freshSampleStampedeWorld(1000);
  const physics = new SampleStampedePhysics(world);
  const served: string[] = [];
  for (let round = 0; round < 3; round++) {
    for (const kiosk of world.kiosks) kiosk.active = false;
    world.nextSampleFrenzyTime = world.clock;
    advanceSampleStampedeWorld(world, physics, 1 / 60, []);
    served.push(world.kiosks.find((k) => k.active)!.sampleKind);
  }
  assert.deepEqual(served, [
    'sample_pizza_bagel',
    'sample_taquito',
    'sample_pizza_bagel',
  ]);
  assert.ok(world.groundItems.some((it) => it.kind === 'sample_pizza_bagel'));
  physics.destroy();
});

void test('a finished list is followed by one the kiosks can fill', () => {
  const world = freshSampleStampedeWorld(1000);
  const cart = world.carts[0];
  load(
    cart,
    cart.manifest.targetItems.map((t) => t.kind),
  );
  cart.x = world.exitGauntlet.x;
  cart.z = world.exitGauntlet.z;
  const physics = new SampleStampedePhysics(world);
  const events: StampedeEvent[] = [];
  advanceSampleStampedeWorld(world, physics, 1 / 60, events);
  assert.ok(events.some((e) => e.type === 'receipt_approved'));

  const served = new Set<ItemKind>(world.kiosks.map((k) => k.sampleKind));
  const samples = cart.manifest.targetItems.filter(
    (t) => ITEM_DEFS[t.kind].isSample,
  );
  assert.ok(samples.length > 0);
  for (const t of samples) assert.ok(served.has(t.kind), `${t.kind} is served`);
  physics.destroy();
});

void test('bots finish shopping lists, never check out a teddy and do not stall', () => {
  const world = freshSampleStampedeWorld(1000);
  world.players.push(
    newStampedePlayer('a', 'A', 0, 'red', 'cart-red', 'driver', true),
    newStampedePlayer('b', 'B', 1, 'red', 'cart-red', 'grabber', true),
    newStampedePlayer('c', 'C', 2, 'blue', 'cart-blue', 'driver', true),
    newStampedePlayer('d', 'D', 3, 'blue', 'cart-blue', 'grabber', true),
  );
  const physics = new SampleStampedePhysics(world);
  const events: StampedeEvent[] = [];
  // Longest run of frames each cart stood still away from the kiosks,
  // where waiting for samples is fair.
  const still = new Map<string, number>();
  const longest = new Map<string, number>();
  for (let frame = 0; frame < 60 * 120; frame++) {
    advanceSampleStampedeWorld(world, physics, 1 / 60, events);
    for (const c of world.carts) {
      const byKiosk = world.kiosks.some(
        (k) => Math.hypot(k.x - c.x, k.z - c.z) < 6,
      );
      const run =
        Math.hypot(c.vx, c.vz) < 0.5 && !byKiosk
          ? (still.get(c.id) ?? 0) + 1
          : 0;
      still.set(c.id, run);
      longest.set(c.id, Math.max(longest.get(c.id) ?? 0, run));
    }
  }

  assert.ok(
    world.teamScores.red > 0 && world.teamScores.blue > 0,
    `scores ${world.teamScores.red} / ${world.teamScores.blue}`,
  );
  assert.equal(events.filter((e) => e.type === 'receipt_rejected').length, 0);
  for (const [id, frames] of longest)
    assert.ok(frames < 60 * 10, `${id} stood still ${frames / 60} s`);
  physics.destroy();
});
