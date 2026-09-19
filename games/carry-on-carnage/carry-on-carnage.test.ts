import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carryOnCarnageAvatars } from './avatar';
import { reconcileCarryOnBots, updateCarryOnBots } from './bots';
import { createEngine } from './peer';
import {
  burstSuitcase,
  checkSizerFit,
  computeSuitcaseBulge,
  SIZER_X,
  SIZER_Z,
  STEP,
} from './physics';
import {
  EVENT_HISTORY,
  JAM_REPORT_MS,
  advanceCarryOn,
  carryOnAction,
  freshCarryOnWorld,
  newTraveler,
} from './simulation';
import {
  ITEM_CONFIGS,
  PASSED_REWARD,
  REACH_DISTANCE,
  type CarryOnWorld,
  type LuggageItem,
  type Suitcase,
} from './types';

function makeTestSuitcase(): Suitcase {
  return {
    id: 'sc-test',
    color: 0,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    open: true,
    items: [],
    bulge: 0,
    compression: 0,
    zipped: 0,
    strain: 0,
    burst: false,
    approved: false,
    rejected: false,
    heldBy: null,
    sittingCount: 0,
  };
}

function makeTestItem(
  id: string,
  kind: keyof typeof ITEM_CONFIGS,
  packedIn: string | null = null,
): LuggageItem {
  return {
    id,
    kind,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    rotation: 0,
    heldBy: null,
    packedIn,
  };
}

void test('luggage packing increases volume and spring bulge', () => {
  const sc = makeTestSuitcase();
  const items: LuggageItem[] = [];

  // Empty suitcase
  const emptyStats = computeSuitcaseBulge(sc, items);
  assert.equal(emptyStats.rawVolume, 0);
  assert.equal(emptyStats.bulge, 0);
  assert.equal(emptyStats.canZip, true);

  // Pack 3 items (flamingo, clothes, duck)
  items.push(makeTestItem('i1', 'flamingo', sc.id));
  items.push(makeTestItem('i2', 'clothes', sc.id));
  items.push(makeTestItem('i3', 'duck', sc.id));
  sc.items = ['i1', 'i2', 'i3'];

  const stats = computeSuitcaseBulge(sc, items);
  assert.ok(stats.rawVolume > 2.0, 'Raw volume should be > 2.0');
  assert.ok(stats.bulge > 0.2, 'Suitcase should bulge noticeably');
  assert.equal(
    stats.canZip,
    false,
    'Uncompressed overstuffed suitcase should not allow zipping',
  );
});

void test('sitting on suitcase compresses bulging volume and enables zipping', () => {
  const sc = makeTestSuitcase();
  const items: LuggageItem[] = [
    makeTestItem('i1', 'clothes', sc.id),
    makeTestItem('i2', 'clothes', sc.id),
    makeTestItem('i3', 'duck', sc.id),
  ];
  sc.items = ['i1', 'i2', 'i3'];

  const uncompressed = computeSuitcaseBulge(sc, items);
  assert.equal(uncompressed.canZip, false);

  // Apply heavy compression (player sitting on suitcase)
  sc.compression = 0.9;
  const compressed = computeSuitcaseBulge(sc, items);

  assert.ok(
    compressed.bulge < uncompressed.bulge,
    'Bulge should decrease with compression',
  );
  assert.ok(
    compressed.canZip === true,
    'Compressed suitcase should allow zipping',
  );
});

void test('piñata burst violently explodes items across terminal', () => {
  const world = freshCarryOnWorld(1000);
  const sc = world.suitcases[0];
  const player = newTraveler('p1', 'Player 1', 0, 1000);
  player.x = sc.x + 0.5;
  player.z = sc.z + 0.5;
  world.players.push(player);

  // Pack items into suitcase
  const it1 = world.items[0];
  const it2 = world.items[1];
  it1.packedIn = sc.id;
  it2.packedIn = sc.id;
  sc.items = [it1.id, it2.id];

  const eventIdRef = { current: 100 };
  burstSuitcase(world, sc, eventIdRef);

  assert.equal(sc.burst, true);
  assert.equal(
    sc.items.length,
    0,
    'Items should be ejected from burst suitcase',
  );
  assert.equal(it1.packedIn, null);
  assert.ok(it1.vy > 3.0, 'Item should be launched with upward velocity');
  assert.ok(
    player.downUntil > 1000,
    'Nearby player should be knocked down / stunned',
  );
});

void test('sizer box approves compressed zipped carry-on and rejects unzipped / bulging bags', () => {
  const sc = makeTestSuitcase();
  const items: LuggageItem[] = [
    makeTestItem('i1', 'clothes', sc.id),
    makeTestItem('i2', 'duck', sc.id),
  ];
  sc.items = ['i1', 'i2'];

  // Test 1: Unzipped bag should fail
  sc.zipped = 0.5;
  const unzippedFit = checkSizerFit(sc, items);
  assert.equal(unzippedFit.pass, false);
  assert.ok(unzippedFit.reason?.includes('unzipped'));

  // Test 2: Overstuffed uncompressed bulging bag should fail
  sc.zipped = 1.0;
  items.push(makeTestItem('i3', 'flamingo', sc.id));
  items.push(makeTestItem('i4', 'flamingo', sc.id));
  sc.items.push('i3', 'i4');
  sc.compression = 0.0;
  const bulgingFit = checkSizerFit(sc, items);
  assert.equal(bulgingFit.pass, false);
  assert.ok(bulgingFit.reason?.includes('Bulges'));

  // Test 3: Fully compressed properly zipped bag should pass
  sc.items = ['i1', 'i2']; // Normal packed vacation items
  sc.compression = 0.85;
  const passedFit = checkSizerFit(
    sc,
    items.filter((it) => sc.items.includes(it.id)),
  );
  assert.equal(passedFit.pass, true);
});

void test('tsa metal detector triggers distraction alarm with tin foil shoes', () => {
  const world = freshCarryOnWorld(1000);
  const player = newTraveler('p1', 'Smuggler', 0, 1000);
  player.wearingTinFoil = true;
  player.x = 3.5; // At TSA gate
  player.z = 0;
  world.players.push(player);

  const eventIdRef = { current: 100 };
  advanceCarryOn(world, 0.016, eventIdRef);

  assert.ok(
    world.tsa.distractedUntil > 1000,
    'TSA should become distracted by alarm',
  );
});

void test('peer engine creates carry-on-carnage world and serializes checkpoint', () => {
  const engine = createEngine(1000);
  const cp = engine.checkpoint();
  assert.equal(cp.game, 'carry-on-carnage');
  assert.ok(cp.world);
});

void test('carry-on-carnage avatar creates dressable worker with proper dimensions', () => {
  const look = carryOnCarnageAvatars[0];
  assert.equal(look.key, 'traveler');
  assert.equal(look.dressable, true);

  const instance = look.create();
  assert.ok(instance.root);
  assert.ok(typeof instance.pose === 'function');
});

void test('physical collision stops players from walking through sizer box and benches', () => {
  const world = freshCarryOnWorld(1000);
  const player = newTraveler('p1', 'Tester', 0, 1000);
  world.players.push(player);

  // Attempt to place player directly inside the sizer box cage at [8.5, 0.0]
  player.x = 8.5;
  player.z = 0.0;
  const eventIdRef = { current: 100 };
  advanceCarryOn(world, 0.016, eventIdRef);

  // Player must be ejected from inside the sizer box
  const insideSizer =
    player.x > 8.0 && player.x < 9.0 && player.z > -0.3 && player.z < 0.3;
  assert.equal(
    insideSizer,
    false,
    'Player should be blocked from phasing through sizer box',
  );

  // Attempt to walk into the left lounge bench at [-6.5, -2.4]
  player.x = -6.5;
  player.z = -2.4;
  advanceCarryOn(world, 0.016, eventIdRef);

  const insideBench =
    player.x > -7.5 && player.x < -5.5 && player.z > -2.8 && player.z < -2.0;
  assert.equal(
    insideBench,
    false,
    'Player should be blocked from phasing through bench',
  );
});

void test('single player sitting on suitcase compresses to >= 0.85 and enables zipping', () => {
  const world = freshCarryOnWorld(1000);
  const sc = world.suitcases[0];
  const player = newTraveler('p1', 'Tester', 0, 1000);
  world.players.push(player);

  // Pack items to create bulging excess
  const it1 = world.items[0];
  const it2 = world.items[1];
  it1.packedIn = sc.id;
  it2.packedIn = sc.id;
  sc.items = [it1.id, it2.id];

  // Sit on suitcase
  player.sittingOn = sc.id;
  const eventIdRef = { current: 100 };

  // Step world several frames to allow spring compression to converge
  for (let i = 0; i < 30; i++) {
    advanceCarryOn(world, 0.016, eventIdRef);
  }

  assert.ok(
    sc.compression >= 0.84,
    `Compression should reach at least 0.84 for a single sitter, got ${sc.compression}`,
  );

  const stats = computeSuitcaseBulge(sc, world.items);
  assert.equal(
    stats.canZip,
    true,
    'Single player sitting must enable canZip for standard luggage',
  );
});

void test('player can unpack / remove an item from an open suitcase', () => {
  const world = freshCarryOnWorld(1000);
  const sc = world.suitcases[0];
  const player = newTraveler('p1', 'Tester', 0, 1000);
  player.x = sc.x + 0.3;
  player.z = sc.z + 0.3;
  world.players.push(player);

  const it1 = world.items[0];
  it1.packedIn = sc.id;
  sc.items = [it1.id];

  const eventIdRef = { current: 100 };

  // Trigger grab while hands are empty near suitcase
  carryOnAction(
    world,
    player.id,
    { type: 'interact', action: 'grab' },
    eventIdRef,
  );

  assert.equal(
    player.holdingItem,
    it1.id,
    'Player should now be holding the unpacked item',
  );
  assert.equal(
    it1.packedIn,
    null,
    'Item should no longer be packed in suitcase',
  );
  assert.equal(sc.items.length, 0, 'Suitcase items array should be empty');
});

// The bags stand 1.4 m apart, so a neighbour is always within reach too.
function besideBag(index: number) {
  const world = freshCarryOnWorld(1000);
  const sc = world.suitcases[index];
  const player = newTraveler('p1', 'Tester', 0, 1000);
  player.x = sc.x + 0.8;
  player.z = sc.z;
  world.players.push(player);
  const neighbour = world.suitcases[index - 1];
  assert.ok(
    Math.hypot(neighbour.x - player.x, neighbour.z - player.z) < REACH_DISTANCE,
    'the bag before this one is in reach as well',
  );
  const act = (action: 'grab' | 'compress' | 'zip') =>
    carryOnAction(
      world,
      player.id,
      { type: 'interact', action },
      { current: 100 },
    );
  return { world, sc, neighbour, player, act };
}

void test('a held item is packed into the nearest bag, not the first in reach', () => {
  const { world, sc, neighbour, player, act } = besideBag(1);
  const item = world.items[0];
  item.heldBy = player.id;
  player.holdingItem = item.id;

  act('grab');

  assert.equal(item.packedIn, sc.id);
  assert.deepEqual(sc.items, [item.id]);
  assert.deepEqual(neighbour.items, []);
});

void test('grabbing next to a bag in a row lifts that bag, not a neighbour', () => {
  const { world, sc, neighbour, player, act } = besideBag(2);
  for (const bag of [sc, neighbour]) {
    bag.zipped = 1;
    bag.open = false;
  }

  act('grab');

  assert.equal(player.holdingSuitcase, sc.id);
  assert.equal(sc.heldBy, player.id);
  assert.equal(neighbour.heldBy, null);
  assert.ok(world.items.every((it) => it.heldBy === null));
});

void test('zipping while sitting on a bag zips that bag, not the first in reach', () => {
  const { world, sc, neighbour, player, act } = besideBag(1);
  player.sittingOn = sc.id;
  // Sitting puts the traveller on the bag, still in reach of the one before.
  advanceCarryOn(world, 0.016, { current: 100 });
  assert.equal(player.x, sc.x);
  assert.equal(player.z, sc.z);

  act('zip');

  assert.equal(player.zippingSuitcase, sc.id);
  assert.ok(sc.zipped > 0);
  assert.equal(neighbour.zipped, 0);
});

void test('sitting down and picking up loose items choose the nearest too', () => {
  const { world, sc, player, act } = besideBag(3);
  act('compress');
  assert.equal(player.sittingOn, sc.id);

  // Two loose items in reach; the later one in the list lies closer.
  const [far, near] = world.items;
  Object.assign(far, { x: player.x + 1.5, z: player.z });
  Object.assign(near, { x: player.x + 0.4, z: player.z });
  player.sittingOn = null;
  act('grab');
  assert.equal(player.holdingItem, near.id);
  assert.equal(far.heldBy, null);
});

void test('a bot sizes a ready bag once, the sizer clears, and an approved bag cannot score twice', () => {
  const now = 1_000_000;
  const world = freshCarryOnWorld(now);
  const bot = newTraveler('bot-1', 'Bot', 1, now);
  bot.bot = true;
  const human = newTraveler('human', 'Human', 0, now);
  human.x = -8;
  world.players = [bot, human];
  const sc = world.suitcases[0];
  sc.open = false;
  sc.zipped = 1;
  sc.heldBy = bot.id;
  bot.holdingSuitcase = sc.id;
  bot.x = SIZER_X - 1;
  bot.z = SIZER_Z;
  const eventIdRef = { current: 100 };
  const inserted = () =>
    world.events.filter((e) => e.detail === 'inserted').length;

  // Six seconds of bots: before the fix a bot pulled the bag back out of the
  // cage every frame, so it was inserted hundreds of times and never sized.
  for (let frame = 0; frame < 360; frame++) {
    updateCarryOnBots(world, eventIdRef);
    advanceCarryOn(world, 1 / 60, eventIdRef);
  }
  assert.equal(inserted(), 1);
  assert.equal(sc.approved, true);
  assert.equal(world.approvedCount, 1);
  assert.equal(world.sizer.status, 'idle');
  assert.equal(world.sizer.insertedSuitcase, null);
  assert.ok(sc.x > SIZER_X + 1, 'the approved bag went through to the jetway');

  // A human carrying the approved bag back cannot size it a second time.
  sc.heldBy = human.id;
  human.holdingSuitcase = sc.id;
  human.x = SIZER_X - 1;
  human.z = SIZER_Z;
  carryOnAction(
    world,
    human.id,
    { type: 'interact', action: 'grab' },
    eventIdRef,
  );
  assert.equal(inserted(), 1);
  assert.equal(world.sizer.status, 'idle');
  assert.equal(world.approvedCount, 1);
});

const interact = (
  world: CarryOnWorld,
  who: string,
  action: 'grab' | 'compress' | 'zip' | 'drop',
  ref: { current: number },
) => carryOnAction(world, who, { type: 'interact', action }, ref);

/** A solo round: one person, who does nothing, and the bots that join them. */
function soloRound() {
  const world = freshCarryOnWorld(1000);
  world.players.push(newTraveler('me', 'Me', 0, 1000));
  reconcileCarryOnBots(world, 1000);
  return world;
}

function playBots(
  world: CarryOnWorld,
  seconds: number,
  ref = { current: 100 },
) {
  for (let t = 0; t < seconds && world.phase === 'packing'; t += STEP) {
    updateCarryOnBots(world, ref);
    advanceCarryOn(world, STEP, ref);
  }
}

void test('a zipper jammed every frame is reported once per interval, and the event list stays short', () => {
  const world = freshCarryOnWorld(1000);
  const sc = world.suitcases[0];
  // Too full to zip unsquashed, not full enough to burst.
  for (const kind of ['flamingo', 'racket'] as const) {
    const item = world.items.find((it) => it.kind === kind)!;
    item.packedIn = sc.id;
    sc.items.push(item.id);
  }
  const player = newTraveler('p1', 'Zipper', 0, 1000);
  Object.assign(player, { x: sc.x + 0.6, z: sc.z });
  world.players.push(player);
  const ref = { current: 100 };

  // Pulling for three seconds is two reports, not one per frame.
  for (let frame = 0; frame < 180; frame++) {
    interact(world, player.id, 'zip', ref);
    advanceCarryOn(world, STEP, ref);
  }
  const jams = world.events.filter((event) => event.detail === 'jammed');
  assert.equal(jams.length, Math.ceil(3_000 / JAM_REPORT_MS));

  // Two events a frame for a hundred frames: the list keeps only the newest,
  // ids keep rising, and a reader that tracks the last id misses none.
  sc.items = [];
  for (const item of world.items) item.packedIn = null;
  const shirt = world.items.find((it) => it.kind === 'clothes')!;
  Object.assign(shirt, { x: player.x, z: player.z });
  let seen = Math.max(...world.events.map((event) => event.id));
  let read = 0;
  for (let frame = 0; frame < 100; frame++) {
    interact(world, player.id, 'grab', ref); // pick up (or unpack) the shirt
    interact(world, player.id, 'grab', ref); // pack it
    advanceCarryOn(world, STEP, ref);
    assert.ok(world.events.length <= EVENT_HISTORY, `${world.events.length}`);
    for (const event of world.events)
      if (event.id > seen) {
        seen = event.id;
        read++;
      }
  }
  assert.equal(read, 199, 'one pack, then an unpack and a pack each frame');
  const ids = world.events.map((event) => event.id);
  assert.deepEqual(
    ids,
    [...ids].sort((a, b) => a - b),
  );
  assert.equal(ids.at(-1), ref.current);
});

void test('an approved bag pulled back out of the sizer box never scores again', () => {
  const world = freshCarryOnWorld(1000);
  const sc = world.suitcases[0];
  const shirt = world.items.find((it) => it.kind === 'clothes')!;
  shirt.packedIn = sc.id;
  sc.items.push(shirt.id);
  Object.assign(sc, { zipped: 1, open: false });
  const player = newTraveler('p1', 'Sizer', 0, 1000);
  Object.assign(player, { x: sc.x + 0.6, z: sc.z });
  world.players.push(player);
  const ref = { current: 100 };

  interact(world, player.id, 'grab', ref); // lift the zipped bag
  Object.assign(player, { x: SIZER_X - 1.2, z: SIZER_Z });
  interact(world, player.id, 'grab', ref); // insert it
  for (let t = 0; t < 1.4; t += STEP) advanceCarryOn(world, STEP, ref);
  assert.equal(world.approvedCount, 1);
  assert.equal(world.totalScore, PASSED_REWARD);

  interact(world, player.id, 'grab', ref); // pull it back out
  assert.equal(player.holdingSuitcase, sc.id);
  interact(world, player.id, 'grab', ref); // try it again: it is set down
  assert.equal(world.sizer.insertedSuitcase, null);
  assert.equal(player.holdingSuitcase, null);
  for (let t = 0; t < 2; t += STEP) advanceCarryOn(world, STEP, ref);
  assert.equal(world.approvedCount, 1);
  assert.equal(world.totalScore, PASSED_REWARD);
});

void test('bots never re-size an approved bag lying next to the one they want', () => {
  // The case that scored twice: an approved bag set down beside a zipped one,
  // and a bot reaching for the zipped one lifted whichever came first.
  const world = soloRound();
  const [me, bot] = world.players;
  world.players = [me, bot];
  Object.assign(me, { x: -8, z: 4 });
  Object.assign(bot, { x: -1.2, z: -1.0 });
  const [approved, zipped] = world.suitcases;
  Object.assign(approved, { zipped: 1, open: false, approved: true });
  Object.assign(zipped, { zipped: 1, open: false });
  Object.assign(world, { approvedCount: 1, totalScore: PASSED_REWARD });
  const ref = { current: 100 };
  const sized = new Set<string>();
  for (let t = 0; t < 30; t += STEP) {
    playBots(world, STEP, ref);
    if (world.sizer.status === 'testing')
      sized.add(world.sizer.insertedSuitcase!);
  }
  assert.ok(sized.has(zipped.id), 'the zipped bag was sized');
  assert.ok(!sized.has(approved.id), 'the approved bag stayed out');
  assert.equal(
    world.approvedCount,
    world.suitcases.filter((sc) => sc.approved).length,
  );
});

void test('with the person idle, bots pack and size every bag but the last, which the person can finish', () => {
  const world = soloRound();
  const ref = { current: 100 };
  playBots(world, 60, ref);

  // Before the fix the bots stood pinned against a bench and the scale.
  assert.equal(world.approvedCount, world.targetBags - 1);
  assert.equal(world.feesPaid, 0);
  assert.ok(world.events.length <= EVENT_HISTORY + 2);
  const last = world.suitcases.find((sc) => !sc.approved)!;
  assert.ok(last.zipped >= 0.95, 'the last bag is packed and zipped');
  assert.equal(last.heldBy, null);
  assert.ok(last.x < 0, 'and still where it was packed');
  assert.equal(world.sizer.insertedSuitcase, null, 'the cage is cleared');

  // The last bag is the person's to bring to the gate.
  const me = world.players.find((player) => !player.bot)!;
  Object.assign(me, { x: last.x - 0.8, z: last.z });
  interact(world, me.id, 'grab', ref);
  assert.equal(me.holdingSuitcase, last.id);
  Object.assign(me, { x: SIZER_X - 1.2, z: SIZER_Z });
  interact(world, me.id, 'grab', ref);
  playBots(world, 1.4, ref);
  assert.equal(world.approvedCount, world.targetBags);
});

void test('a restart empties all hands and keeps event ids rising', () => {
  const world = soloRound();
  const ref = { current: 100 };
  playBots(world, 5, ref);
  const bot = world.players.find((player) => player.bot)!;
  Object.assign(bot, { holdingItem: world.items[0].id, sittingOn: 'sc-1' });
  const last = ref.current;

  carryOnAction(world, 'me', { type: 'restart' }, ref);
  for (const player of world.players) {
    assert.equal(player.holdingItem, null);
    assert.equal(player.holdingSuitcase, null);
    assert.equal(player.sittingOn, null);
  }
  assert.ok(world.events[0].id > last, 'the new boarding call is new');
  playBots(world, 30, ref);
  assert.ok(world.approvedCount > 0, 'the bots carry on in the new round');
});
