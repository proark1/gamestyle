import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSiege,
  banner,
  freshSiege,
  hydrateSiege,
  newCrew,
  removeCrew,
  siegeAction,
  siegeSnapshot,
  winders,
} from './simulation';
import { buildCastle } from './castle';
import { createEngine } from './peer';
import { siegeCatalog } from './audio';
import {
  BANNER_DOWN,
  CRANK,
  LEVER,
  PILE,
  MAX_TURN,
  RELIEF_MS,
  ROUND_MS,
  SLING,
  TREBUCHET,
  rangeFor,
  type AmmoKind,
  type SiegeWorld,
} from './types';

function game(count = 1) {
  const w = freshSiege(100000);
  for (let i = 0; i < count; i++)
    w.players.push(newCrew(String(i), `Crew ${i}`, i, w.clock));
  siegeAction(w, '0', { type: 'start' }, '0');
  return w;
}
function tick(w: SiegeWorld, ms: number, frame = 50) {
  const end = w.clock + ms;
  while (w.clock < end - 1e-6) advanceSiege(w, Math.min(end, w.clock + frame));
}
function put(w: SiegeWorld, id: string, spot: { x: number; z: number }) {
  const p = w.players.find((c) => c.id === id)!;
  p.x = spot.x;
  p.z = spot.z;
  p.y = 0;
  return p;
}
/** Winds to a target counterweight travel using the real held-action path. */
function windTo(w: SiegeWorld, target: number, id = '0') {
  put(w, id, CRANK);
  siegeAction(w, id, { type: 'wind' }, '0');
  for (let i = 0; i < 800 && w.wind < target; i++) tick(w, 50);
  siegeAction(w, id, { type: 'stopWind' }, '0');
  return w.wind;
}
function fire(w: SiegeWorld, kind: AmmoKind, wind: number, id = '0', turn = 0) {
  windTo(w, wind, id);
  w.turn = turn; // These tests choose their aim rather than use the opening drift.
  const p = put(w, id, PILE);
  p.carrying = kind;
  put(w, id, SLING);
  siegeAction(w, id, { type: 'grab' }, '0');
  put(w, id, LEVER);
  siegeAction(w, id, { type: 'loose' }, '0');
  return w.shots.at(-1)!;
}

void test('the castle is a loose stack with a banner on top', () => {
  const blocks = buildCastle();
  assert.ok(blocks.length > 50, 'the keep needs enough masonry to collapse');
  const flag = blocks.filter((b) => b.part === 'banner');
  assert.equal(flag.length, 1);
  assert.ok(flag[0].y > 8, 'the banner starts well above the win height');
  assert.ok(blocks.some((b) => b.part === 'gate'));
  assert.ok(new Set(blocks.map((b) => b.id)).size === blocks.length);
});

void test('a fresh siege starts in the lobby and only the captain calls it', () => {
  const w = freshSiege(1000);
  w.players.push(newCrew('0', 'Captain', 0, w.clock));
  w.players.push(newCrew('1', 'Crew', 1, w.clock));
  assert.equal(w.phase, 'lobby');
  assert.throws(() => siegeAction(w, '1', { type: 'start' }, '0'), /captain/i);
  siegeAction(w, '0', { type: 'start' }, '0');
  assert.equal(w.phase, 'playing');
  assert.equal(w.crewSize, 2);
  assert.equal(w.totalBlocks, w.blocks.length);
});

void test('the winch needs hands on it and more hands wind faster', () => {
  const solo = game(1);
  const alone = windTo(solo, 1);
  assert.ok(alone > 0.99, 'one crewmate can still fully wind, given time');

  const one = game(1);
  put(one, '0', CRANK);
  siegeAction(one, '0', { type: 'wind' }, '0');
  tick(one, 3000);
  const pair = game(2);
  for (const id of ['0', '1']) {
    put(pair, id, CRANK);
    siegeAction(pair, id, { type: 'wind' }, '0');
  }
  assert.equal(winders(pair), 2);
  tick(pair, 3000);
  assert.ok(
    pair.wind > one.wind + 0.05,
    `two winders should out-wind one (${pair.wind} vs ${one.wind})`,
  );
});

void test('winding only counts while standing at the crank', () => {
  const w = game(1);
  const p = put(w, '0', CRANK);
  siegeAction(w, '0', { type: 'wind' }, '0');
  tick(w, 1500);
  const wound = w.wind;
  assert.ok(wound > 0);
  p.x = TREBUCHET.x + 14;
  p.z = TREBUCHET.z + 14;
  tick(w, 3000);
  assert.equal(
    w.wind,
    wound,
    'a crewmate who is not at the crank winds nothing',
  );
  assert.throws(
    () => siegeAction(w, '0', { type: 'wind' }, '0'),
    /winch handles/i,
  );
});

void test('loading requires a fetched payload and the sling', () => {
  const w = game(1);
  assert.throws(
    () => siegeAction(w, '0', { type: 'load' }, '0'),
    /supply pile/i,
  );
  put(w, '0', SLING);
  assert.throws(
    () => siegeAction(w, '0', { type: 'grab' }, '0'),
    /supply pile/i,
  );
  put(w, '0', PILE);
  siegeAction(w, '0', { type: 'grab' }, '0');
  assert.ok(w.players[0].carrying, 'the pile hands over a payload');
  put(w, '0', SLING);
  siegeAction(w, '0', { type: 'grab' }, '0');
  assert.ok(w.loaded, 'the same key loads the sling when standing at it');
  assert.equal(w.players[0].carrying, null);
  assert.equal(w.players[0].loaded, 1);
});

void test('loosing needs the lever, a payload and a wound counterweight', () => {
  const w = game(1);
  put(w, '0', PILE);
  siegeAction(w, '0', { type: 'grab' }, '0');
  put(w, '0', SLING);
  siegeAction(w, '0', { type: 'grab' }, '0');
  assert.throws(() => siegeAction(w, '0', { type: 'loose' }, '0'), /lever/i);
  put(w, '0', LEVER);
  assert.throws(() => siegeAction(w, '0', { type: 'loose' }, '0'), /Wind the/i);
  windTo(w, 0.6);
  put(w, '0', LEVER);
  siegeAction(w, '0', { type: 'loose' }, '0');
  assert.equal(w.shots.length, 1);
  assert.equal(w.loaded, null);
  assert.equal(w.wind, 0, 'the counterweight is spent');
  assert.equal(w.volleys, 1);
});

void test('the counterweight sets the range, and the readout matches the flight', () => {
  for (const wind of [0.25, 0.55, 0.9]) {
    const w = game(1);
    const shot = fire(w, 'boulder', wind);
    const launched = w.wind === 0 ? shot : shot;
    const startZ = launched.z;
    tick(w, 6000);
    const landed = w.shots.find((s) => s.id === shot.id);
    const restZ = landed ? landed.z : -999;
    const flown = startZ - restZ;
    const predicted = rangeFor(wind);
    assert.ok(
      Math.abs(flown - predicted) < predicted * 0.45,
      `wind ${wind}: flew ${flown.toFixed(1)}m, aiming ring promised ${predicted.toFixed(1)}m`,
    );
  }
});

void test('more wind throws further', () => {
  // Swung fully aside so both shots land on open ground and the castle cannot
  // stop the heavier one short of where its power would have carried it.
  const reach = (wind: number) => {
    const w = game(1);
    w.nextPot = w.clock + 10_000_000;
    const shot = fire(w, 'boulder', wind, '0', MAX_TURN);
    const launchX = shot.x;
    const launchZ = shot.z;
    let furthest = 0;
    for (let i = 0; i < 140; i++) {
      tick(w, 50);
      const live = w.shots.find((s) => s.id === shot.id);
      if (live)
        furthest = Math.max(
          furthest,
          Math.hypot(live.x - launchX, live.z - launchZ),
        );
    }
    return furthest;
  };
  const short = reach(0.2);
  const long = reach(0.95);
  assert.ok(
    long > short + 8,
    `full wind ${long} should outrange light ${short}`,
  );
});

void test('a boulder into the wall loosens masonry', () => {
  const w = game(1);
  assert.equal(w.rubble, 0);
  fire(w, 'boulder', 0.45);
  tick(w, 7000);
  assert.ok(w.rubble > 0, 'the curtain wall records rubble after a solid hit');
  assert.ok(w.events.some((e) => e.kind === 'impact'));
});

void test('a fire pot lights timber and burns the course away', () => {
  const w = game(1);
  const before = w.blocks.length;
  fire(w, 'firepot', 0.45);
  tick(w, 4000);
  assert.ok(
    w.blocks.some((b) => b.burning > w.clock),
    'the pot sets nearby stones alight',
  );
  tick(w, 14000);
  assert.ok(w.blocks.length < before, 'burnt blocks are removed from the wall');
  assert.ok(w.rubble > 0);
});

void test('the hive clears the battlements and stops the clay pots', () => {
  const w = game(1);
  const shot = fire(w, 'beehive', 0.5);
  shot.z = -12;
  tick(w, 6000);
  assert.ok(w.beesUntil > w.clock, 'bees keep the defenders off the wall');
  const potted = w.pots.length;
  tick(w, 9000);
  assert.equal(w.pots.length, potted, 'no new pots while the bees are working');
});

void test('riding is exclusive and the rider cannot also carry', () => {
  const w = game(2);
  put(w, '0', PILE);
  siegeAction(w, '0', { type: 'grab' }, '0');
  put(w, '0', SLING);
  assert.throws(() => siegeAction(w, '0', { type: 'ride' }, '0'), /Drop it/i);
  put(w, '1', SLING);
  siegeAction(w, '1', { type: 'ride' }, '0');
  assert.equal(w.rider, '1');
  const other = put(w, '0', SLING);
  other.carrying = null;
  assert.throws(() => siegeAction(w, '0', { type: 'ride' }, '0'), /braver/i);
  siegeAction(w, '1', { type: 'ride' }, '0');
  assert.equal(w.rider, '', 'a second press climbs back out');
});

void test('a launched crewmate flies, lands and is flattened', () => {
  const w = game(2);
  windTo(w, 0.8, '0');
  put(w, '1', SLING);
  siegeAction(w, '1', { type: 'ride' }, '0');
  put(w, '0', LEVER);
  siegeAction(w, '0', { type: 'loose' }, '0');
  const rider = w.players.find((p) => p.id === '1')!;
  assert.ok(rider.flying, 'the volunteer is airborne');
  assert.equal(rider.launches, 1);
  assert.throws(() => siegeAction(w, '1', { type: 'grab' }, '0'), /airborne/i);
  for (let i = 0; i < 200 && rider.flying; i++) tick(w, 50);
  assert.equal(rider.flying, false, 'the flight ends on its own');
  assert.ok(rider.z < SLING.z - 10, 'they travelled a long way from the sling');
  assert.ok(
    rider.stunnedUntil > w.clock,
    'landing hurts, right when they land',
  );
  tick(w, 4000);
  assert.ok(
    rider.stunnedUntil <= w.clock,
    'and they get up again shortly after',
  );
});

void test('a flattened crewmate can be hauled up by a friend', () => {
  const w = game(2);
  const down = w.players.find((p) => p.id === '1')!;
  down.stunnedUntil = w.clock + 5000;
  down.x = 0;
  down.z = TREBUCHET.z;
  put(w, '0', { x: 1, z: TREBUCHET.z });
  assert.throws(
    () => siegeAction(w, '1', { type: 'grab' }, '0'),
    /flat on your back/i,
  );
  siegeAction(w, '0', { type: 'help' }, '0');
  assert.ok(down.stunnedUntil <= w.clock, 'the friend is back on their feet');
});

void test('bringing the banner down wins the siege', () => {
  const w = game(1);
  const flag = banner(w)!;
  flag.y = BANNER_DOWN - 0.5;
  flag.sleeping = false;
  tick(w, 200);
  assert.equal(w.phase, 'won');
  assert.ok(w.bannerDown);
  assert.ok(w.events.some((e) => e.kind === 'banner'));
  assert.throws(
    () => siegeAction(w, '0', { type: 'grab' }, '0'),
    /Wait for the captain/i,
  );
});

void test('dawn ends an unfinished siege, with a warning first', () => {
  const w = game(1);
  tick(w, ROUND_MS - RELIEF_MS + 100, 500);
  assert.equal(w.phase, 'relief');
  assert.ok(w.events.some((e) => e.text.includes('relief column')));
  tick(w, RELIEF_MS + 200, 500);
  assert.equal(w.phase, 'lost');
  assert.ok(w.events.some((e) => e.kind === 'finish'));
});

void test('the last crewmate leaving ends the siege', () => {
  const w = game(2);
  removeCrew(w, '0');
  assert.equal(w.phase, 'playing');
  removeCrew(w, '1');
  assert.equal(w.phase, 'lost');
});

void test('a rematch resets the castle but keeps the crew', () => {
  const w = game(2);
  fire(w, 'boulder', 0.5);
  tick(w, 6000);
  const damaged = w.rubble;
  w.phase = 'lost';
  siegeAction(w, '0', { type: 'restart' }, '0');
  assert.equal(w.phase, 'playing');
  assert.equal(w.players.length, 2);
  assert.equal(w.rubble, 0);
  assert.equal(w.shots.length, 0);
  assert.ok(damaged >= 0);
  assert.ok(banner(w)!.y > 8, 'the banner is back up for the rematch');
});

void test('snapshots are inert clones safe to send to guests', () => {
  const w = game(2);
  const snapshot = siegeSnapshot(w, 'ABC234', '0', '1', 7);
  assert.equal(snapshot.code, 'ABC234');
  assert.equal(snapshot.host, '0');
  assert.equal(snapshot.version, 7);
  snapshot.world.wind = 0.9;
  assert.notEqual(
    w.wind,
    0.9,
    'mutating a snapshot cannot reach the live world',
  );
  hydrateSiege(snapshot.world);
  snapshot.world.blocks[0].y = -50;
  assert.notEqual(
    w.blocks.find((b) => b.id === snapshot.world.blocks[0].id)?.y,
    -50,
    'moving a snapshot block cannot reach the live castle',
  );
});

void test('the peer engine builds a siege world guests can join', () => {
  const engine = createEngine(100000);
  const snapshot = engine.snapshot('ABC234', '0', '0', 1);
  assert.equal(snapshot.world.phase, 'lobby');
  assert.ok(snapshot.world.totalBlocks > 50, 'the castle ships with the world');
  hydrateSiege(snapshot.world);
  assert.equal(
    snapshot.world.blocks.length,
    snapshot.world.totalBlocks,
    'a guest rebuilds the untouched masonry locally',
  );
});

void test('snapshots carry only moved masonry, and guests rebuild the rest', () => {
  const w = game(1);
  const quiet = siegeSnapshot(w, 'ABC234', '0', '0', 1);
  assert.equal(
    quiet.world.blocks.length,
    0,
    'an untouched castle sends nothing',
  );
  hydrateSiege(quiet.world);
  assert.equal(quiet.world.blocks.length, w.totalBlocks);
  for (const rebuilt of quiet.world.blocks) {
    const live = w.blocks.find((b) => b.id === rebuilt.id)!;
    assert.equal(rebuilt.x, live.x);
    assert.equal(rebuilt.y, live.y);
    assert.equal(rebuilt.part, live.part);
  }

  fire(w, 'boulder', 0.9);
  tick(w, 2500);
  const busy = siegeSnapshot(w, 'ABC234', '0', '0', 2);
  assert.ok(busy.world.blocks.length > 0, 'shaken stones are sent');
  assert.ok(
    busy.world.blocks.length < w.totalBlocks,
    'settled stones are still left out',
  );
  hydrateSiege(busy.world);
  assert.equal(busy.world.blocks.length, w.blocks.length);
  for (const b of w.blocks) {
    const seen = busy.world.blocks.find((o) => o.id === b.id)!;
    // Guests rebuild settled masonry from the baseline, so they are accurate
    // to the same epsilon the snapshot filter uses, not bit-for-bit.
    assert.ok(
      Math.abs(seen.y - b.y) < 0.02 &&
        Math.abs(seen.x - b.x) < 0.02 &&
        Math.abs(seen.z - b.z) < 0.02,
      `block ${b.id} arrived out of place`,
    );
  }
});

void test('burnt-away masonry stays gone for guests', () => {
  const w = game(1);
  fire(w, 'firepot', 0.45);
  tick(w, 18000);
  assert.ok(w.gone.length > 0, 'fire removed at least one block');
  const snapshot = siegeSnapshot(w, 'ABC234', '0', '0', 3);
  hydrateSiege(snapshot.world);
  assert.equal(snapshot.world.blocks.length, w.blocks.length);
  for (const id of w.gone)
    assert.ok(
      !snapshot.world.blocks.some((b) => b.id === id),
      `burnt block ${id} came back from the dead`,
    );
});

void test('the sound catalog covers every emitted event kind', () => {
  const ids = new Set(siegeCatalog.map((c) => c.id));
  for (const kind of [
    'start',
    'load',
    'loose',
    'impact',
    'rubble',
    'squash',
    'pot',
    'bees',
    'banner',
    'finish',
  ])
    assert.ok(ids.has(`event.${kind}`), `no cue for ${kind}`);
  assert.ok(ids.has('music.siege'));
  for (const cue of siegeCatalog) {
    assert.ok(cue.prompt.length > 20);
    assert.ok(cue.duration >= 0.5);
    assert.ok(cue.volume > 0 && cue.volume <= 1);
  }
});

void test('the engine never opens pointed at the keep', () => {
  const swings = new Set<number>();
  for (let i = 0; i < 12; i++) {
    const w = game(1);
    assert.ok(
      Math.abs(w.turn) >= 0.16 && Math.abs(w.turn) <= MAX_TURN,
      `opening aim ${w.turn} should be off-centre but correctable`,
    );
    swings.add(Math.sign(w.turn));
  }
  assert.equal(
    swings.size,
    2,
    'the opening aim drifts to both sides over time',
  );
});

void test('the crew swings the aim by leaning on the frame', () => {
  const w = game(1);
  const p = put(w, '0', { x: TREBUCHET.x - 3, z: TREBUCHET.z });
  w.turn = 0;
  siegeAction(w, '0', { type: 'push' }, '0');
  assert.equal(p.pushing, 1, 'pushing from the left swings the throw right');
  tick(w, 1000);
  assert.ok(w.turn > 0, 'the frame actually came round');
  siegeAction(w, '0', { type: 'stopPush' }, '0');
  const held = w.turn;
  tick(w, 1000);
  assert.equal(w.turn, held, 'it stays where the crew left it');
  p.x = TREBUCHET.x;
  assert.throws(() => siegeAction(w, '0', { type: 'push' }, '0'), /one side/i);
  put(w, '0', { x: TREBUCHET.x - 20, z: TREBUCHET.z });
  assert.throws(() => siegeAction(w, '0', { type: 'push' }, '0'), /shoulder/i);
});

void test('the aim cannot be swung past its stops', () => {
  const w = game(1);
  w.nextPot = w.clock + 10_000_000;
  const p = put(w, '0', { x: TREBUCHET.x - 3, z: TREBUCHET.z });
  siegeAction(w, '0', { type: 'push' }, '0');
  tick(w, 20000);
  assert.ok(w.turn <= MAX_TURN + 1e-9 && w.turn >= -MAX_TURN - 1e-9);
  assert.ok(p.pushing !== 0);
});

void test('the arm rests by the wind and whips through a release', async () => {
  const { armAngle } = await import('./scene');
  const w = game(1);
  w.loosedAt = -100000;
  w.wind = 0;
  const relaxed = armAngle(w, w.clock);
  w.wind = 1;
  const wound = armAngle(w, w.clock);
  assert.ok(
    wound < relaxed,
    'winding drops the throwing end toward the loading spot',
  );
  // Through a release the arm sweeps past its resting angle and settles back.
  w.loosedAt = w.clock;
  const sweep = armAngle(w, w.clock + 300);
  assert.ok(sweep > relaxed, 'the release throws the arm well over the top');
  const settling = armAngle(w, w.clock + 900);
  assert.ok(
    settling < sweep && settling > wound,
    'and it falls back toward rest afterwards',
  );
  w.wind = 0; // the counterweight is spent by the release
  assert.ok(
    Math.abs(armAngle(w, w.clock + 5000) - relaxed) < 1e-9,
    'a spent engine sits at its resting angle again',
  );
});

void test('every crewmate starts within reach of the winch', () => {
  const w = freshSiege(1000);
  for (let i = 0; i < 4; i++)
    w.players.push(newCrew(String(i), `Crew ${i}`, i, w.clock));
  siegeAction(w, '0', { type: 'start' }, '0');
  for (const p of w.players) {
    assert.ok(
      Math.hypot(p.x - CRANK.x, p.z - CRANK.z) < 2.5,
      `${p.name} spawned out of reach of the crank`,
    );
    siegeAction(w, p.id, { type: 'wind' }, '0');
  }
  assert.equal(winders(w), 4, 'all four can put a shoulder to it at once');
  const alone = freshSiege(1000);
  alone.players.push(newCrew('0', 'Solo', 0, alone.clock));
  siegeAction(alone, '0', { type: 'start' }, '0');
  siegeAction(alone, '0', { type: 'wind' }, '0');
  advanceSiege(alone, alone.clock + 1000);
  advanceSiege(w, w.clock + 1000);
  assert.ok(w.wind > alone.wind, 'four shoulders beat one');
});
