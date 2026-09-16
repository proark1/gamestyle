import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carryOnCarnageAvatars } from './avatar';
import { createEngine } from './peer';
import { burstSuitcase, checkSizerFit, computeSuitcaseBulge } from './physics';
import { advanceCarryOn, freshCarryOnWorld, newTraveler } from './simulation';
import { ITEM_CONFIGS, type LuggageItem, type Suitcase } from './types';

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
