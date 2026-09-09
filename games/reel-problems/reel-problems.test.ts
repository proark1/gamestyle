import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshReel,
  newAngler,
  reelAction,
  advanceReel,
  anglerPosition,
  segmentsCross,
  removeAngler,
  hookedAnglers,
  hullGap,
} from './simulation';
import { createEngine } from './peer';
import {
  BITE_COOLDOWN,
  CATCHES,
  CLIMB_MS,
  DOWNED_MS,
  DOWNED_PENALTY,
  GRAB_REACH,
  NET_REACH,
  ROUND_MS,
  landingPose,
  landingScale,
  type CatchKind,
  type ReelWorld,
} from './types';

function game(count = 1) {
  const w = freshReel(100000);
  for (let i = 0; i < count; i++)
    w.players.push(newAngler(String(i), `Angler ${i}`, i, w.clock));
  reelAction(w, '0', { type: 'start' }, '0');
  return w;
}
function tick(w: ReelWorld, seconds: number) {
  for (let i = 0; i < seconds * 20; i++) advanceReel(w, w.clock + 50);
}
function catchFish(kind: CatchKind) {
  const w = game(),
    p = w.players[0];
  const fish = w.fish.find((f) => f.kind === kind)!;
  w.fish = [fish];
  fish.x = 9;
  fish.z = 2;
  reelAction(w, p.id, { type: 'cast', x: fish.x, z: fish.z }, p.id);
  for (let i = 0; i < 1800 && !w.haul[kind]; i++) {
    p.input.brace = true;
    p.input.reel = !!p.line && !fish.surge && p.line.tension < 0.92;
    advanceReel(w, w.clock + 50);
  }
  return w;
}
for (const kind of Object.keys(CATCHES) as CatchKind[]) {
  void test(`A patient angler can land ${kind} by easing off during surges`, () => {
    const w = catchFish(kind);
    assert.equal(
      w.haul[kind],
      1,
      JSON.stringify({
        events: w.events,
        fish: w.fish,
        line: w.players[0].line,
      }),
    );
    assert.equal(w.score, CATCHES[kind].value);
    assert.equal(w.players[0].line, null);
    if (kind === 'tire' || kind === 'magnet' || kind === 'boot')
      assert.equal(w.gear[kind], true);
  });
}
void test('A catch reeled right up to the boat stays in the water, never on the deck', () => {
  for (const kind of Object.keys(CATCHES) as CatchKind[]) {
    const w = game(),
      p = w.players[0],
      fish = w.fish.find((f) => f.kind === kind)!;
    w.fish = [fish];
    fish.x = 6;
    fish.z = 1;
    reelAction(w, p.id, { type: 'cast', x: fish.x, z: fish.z }, p.id);
    // E held from the cast to the finish: the old reel dragged the fish through
    // the hull and left it hopping inside the live well.
    let closest = Infinity;
    for (let i = 0; i < 900 && p.line && !w.haul[kind]; i++) {
      p.input.reel = true;
      p.input.brace = true;
      advanceReel(w, w.clock + 50);
      closest = Math.min(closest, hullGap(w, fish));
      assert.ok(
        closest >= 0,
        `${kind} entered the hull (${closest.toFixed(2)}m)`,
      );
    }
    // It must still come within netting reach, or a beaten fish could never land.
    assert.ok(closest < NET_REACH, `${kind} never came alongside`);
  }
});
void test('A landed catch arcs out of the lake and finishes in the live well', () => {
  // Boat-local metres, from models.ts: rail top 1.03, well rim 1.41, water 1.12.
  const well = { x: 0, y: 1.12, z: 0 };
  for (const from of [
    { x: 3.6, y: -0.03, z: 0 }, // alongside, at the water line
    { x: -3.4, y: 1.05, z: 2.9 }, // off the quarter, mid-surge
    { x: 0, y: 0, z: -5.2 }, // straight off the bow
  ]) {
    const start = landingPose(0, from, well),
      end = landingPose(1, from, well);
    assert.deepEqual(start, from, 'starts where the fish was fought');
    assert.ok(
      Math.hypot(end.x - well.x, end.z - well.z) < 1e-9,
      'ends over the well',
    );
    assert.ok(
      end.y < 1.41 && Math.abs(end.y - (well.y - 0.1)) < 1e-9,
      `ends on the well water line, not above the rim (${end.y})`,
    );
    let peak = -Infinity;
    for (let i = 0; i <= 200; i++)
      peak = Math.max(peak, landingPose(i / 200, from, well).y);
    assert.ok(peak > 1.41 + 0.2, `clears the well rim (peak ${peak})`);
    assert.ok(peak > from.y + 0.5, 'visibly leaves the water');
  }
  // Shrinks only at the end, and enough that the biggest catch fits the hatch.
  const monster = CATCHES.monster.size;
  assert.equal(landingScale(0, monster), monster);
  assert.equal(landingScale(0.6, monster), monster);
  assert.ok(landingScale(1, monster) < monster * 0.5);
});
function overboard(count = 1) {
  const w = game(count),
    p = w.players[0];
  w.fish = [];
  w.wildlife = [];
  p.swimming = true;
  p.overboardAt = w.clock;
  p.x = w.boat.x + 11;
  p.z = w.boat.z;
  return { w, p };
}
void test('A swimmer catches the hull and needs five held seconds to climb aboard', () => {
  const { w, p } = overboard();
  p.input.x = -1;
  tick(w, 1);
  assert.equal(p.clinging, false, 'open water offers nothing to hold');
  tick(w, 2.5);
  assert.equal(p.clinging, true, 'reaching the hull is enough to catch hold');
  assert.ok(hullGap(w, p) < GRAB_REACH);
  // Hanging on costs nothing, and the climb only moves while E is held.
  p.input.x = 0;
  tick(w, 1);
  assert.equal(p.climb, 0);
  assert.equal(p.swimming, true);
  p.input.reel = true;
  tick(w, 3);
  assert.equal(p.swimming, true, 'three seconds is not a climb');
  assert.ok(
    Math.abs(p.climb - 3000 / CLIMB_MS) < 0.05,
    `partway up the side (${p.climb})`,
  );
  tick(w, 2.1);
  assert.equal(p.swimming, false);
  assert.equal(p.clinging, false);
  assert.ok(w.events.some((e) => e.text.includes('climbed back aboard')));
});
void test('A shark hunts the swimmer, not the hull, and two bites put them under', () => {
  const { w, p } = overboard();
  const shark = freshReel(w.clock).wildlife.find((v) => v.kind === 'shark')!;
  w.wildlife = [shark];
  p.clinging = true;
  p.climb = 0.8;
  p.x = w.boat.x + 3;
  shark.activeUntil = w.clock + 30_000;
  shark.hitAt = 0;
  shark.x = p.x + 1;
  shark.z = p.z;
  tick(w, 0.2);
  assert.ok(
    w.events.some((e) => e.kind === 'chomp'),
    'the bite is announced',
  );
  assert.ok(p.health < 1 && p.health > 0, `bitten once (${p.health})`);
  assert.equal(p.clinging, false, 'the bite tears you off the hull');
  assert.equal(p.climb, 0, 'and costs every second you had banked');
  tick(w, BITE_COOLDOWN / 1000 + 0.6);
  assert.equal(p.health, 0);
  assert.ok(p.downedUntil > w.clock, 'pulled under until the crew reacts');
  w.score = 40;
  tick(w, DOWNED_MS / 1000 + 0.3);
  assert.equal(p.swimming, false, 'the crew always gets a downed angler out');
  assert.equal(w.score, 40 - DOWNED_PENALTY, 'and the boat pays for the delay');
  assert.equal(p.health, 1);
});
void test('A bitten angler who swims straight back still beats the shark aboard', () => {
  // The balance the bite cooldown exists for: react and you make it by a hair,
  // dawdle and the lake takes you. Retuning either number must keep both true.
  const attempt = (react: boolean) => {
    const { w, p } = overboard();
    const shark = freshReel(w.clock).wildlife.find((v) => v.kind === 'shark')!;
    w.wildlife = [shark];
    p.x = w.boat.x + 3.6;
    shark.activeUntil = w.clock + 40_000;
    shark.hitAt = 0;
    shark.x = p.x + 1.2;
    shark.z = p.z;
    for (let i = 0; i < 200 && p.swimming; i++) {
      if (react) {
        const d = Math.max(0.1, Math.hypot(w.boat.x - p.x, w.boat.z - p.z));
        p.input.x = (w.boat.x - p.x) / d;
        p.input.z = (w.boat.z - p.z) / d;
        p.input.reel = true;
      }
      advanceReel(w, w.clock + 50);
    }
    return { w, p, seconds: (w.clock - p.overboardAt) / 1000 };
  };
  const quick = attempt(true);
  // The safety rope also ends a swim, so insist on the climb itself.
  assert.ok(
    quick.w.events.some((e) => e.text.includes('climbed back aboard')),
    `got up the side under his own power (${quick.seconds}s)`,
  );
  assert.ok(
    !quick.w.events.some((e) => e.text.includes('went under')),
    'one bite, not two',
  );
  const slow = attempt(false);
  assert.ok(
    slow.w.events.some((e) => e.text.includes('went under')),
    'floating there costs you the second bite',
  );
});
void test('A jellyfish sting shocks a climbing angler off the hull', () => {
  const { w, p } = overboard();
  const jelly = freshReel(w.clock).wildlife.find(
    (v) => v.kind === 'jellyfish',
  )!;
  w.wildlife = [jelly];
  p.clinging = true;
  p.climb = 0.9;
  p.x = w.boat.x + 3;
  jelly.activeUntil = w.clock + 30_000;
  jelly.hitAt = 0;
  jelly.x = p.x;
  jelly.z = p.z;
  tick(w, 0.1);
  assert.ok(w.events.some((e) => e.kind === 'sting'));
  assert.ok(p.health < 1 && p.health > 0.5, 'a sting wears you down, no more');
  assert.equal(p.clinging, false);
  assert.equal(p.climb, 0);
  assert.ok(p.stunUntil > w.clock);
  // Drift the jellyfish off so this measures the shock, not a second sting.
  jelly.x = w.boat.x + 25;
  p.x = w.boat.x + 3;
  p.input.reel = true;
  tick(w, 0.5);
  assert.equal(p.clinging, false, 'shocked hands cannot take hold');
  tick(w, 1.5);
  assert.equal(p.clinging, true, 'the shock passes and the hull is there');
});
void test('Weather rocks the deck without sweeping a braced angler overboard', () => {
  const storm = (brace: boolean) => {
    const w = game();
    w.fish = [];
    w.wildlife = [];
    w.weather.kind = 'storm';
    w.weather.since = w.clock - 5000;
    w.weather.until = w.clock + 500_000;
    w.weather.direction = Math.PI / 2;
    // A storm without thunder is just wind; the waves are what throw people.
    w.weather.nextThunderAt = w.clock + 500;
    w.players[0].recoveredAt = w.clock - 3000;
    w.players[0].input.brace = brace;
    tick(w, 60);
    return w;
  };
  const braced = storm(true),
    loose = storm(false);
  assert.equal(braced.players[0].splashes, 0, 'bracing answers a whole storm');
  assert.ok(
    Math.abs(braced.boat.roll) > 0.05,
    'the deck still moves under you',
  );
  assert.ok(
    loose.players[0].splashes > 0,
    'riding out thunder unbraced still costs you',
  );
  // A plain gust is weather, not a hazard: it must never clear the deck.
  const windy = game();
  windy.fish = [];
  windy.wildlife = [];
  windy.weather.kind = 'wind';
  windy.weather.since = windy.clock - 5000;
  windy.weather.until = windy.clock + 500_000;
  windy.weather.direction = Math.PI / 2;
  windy.players[0].recoveredAt = windy.clock - 3000;
  tick(windy, 60);
  assert.equal(
    windy.players[0].splashes,
    0,
    'a gust alone leaves the crew put',
  );
  assert.ok(
    Math.abs(windy.boat.x) > 3,
    'while still pushing the boat downwind',
  );
});
void test('Crew weight rolls the boat and outriggers reduce the lean', () => {
  const plain = game(4),
    equipped = game(4);
  for (const w of [plain, equipped]) {
    w.fish = [];
    for (const p of w.players) {
      p.x = 2;
      p.z = 0;
    }
  }
  equipped.gear.tire = true;
  tick(plain, 1);
  tick(equipped, 1);
  assert.ok(Math.abs(plain.boat.roll) > 0.3);
  assert.ok(Math.abs(equipped.boat.roll) < Math.abs(plain.boat.roll) * 0.65);
});
void test('A hooked monster physically drags the boat and careless reeling can snap a line', () => {
  const w = game(),
    p = w.players[0],
    fish = w.fish.find((f) => f.kind === 'monster')!;
  w.fish = [fish];
  fish.x = 14;
  fish.z = 0;
  reelAction(w, p.id, { type: 'cast', x: 14, z: 0 }, p.id);
  p.input.reel = true;
  p.input.brace = true;
  tick(w, 30);
  assert.ok(Math.hypot(w.boat.x, w.boat.z) > 1.5);
  assert.ok(w.events.some((e) => e.kind === 'snap'));
});
void test('Crossing lines knot and can be cleared or cut without stranding the fish', () => {
  const w = game(2);
  w.fish = [];
  w.players[0].x = -2;
  w.players[0].z = 0;
  w.players[1].x = 2;
  w.players[1].z = 0;
  reelAction(w, '0', { type: 'cast', x: 9, z: -9 }, '0');
  reelAction(w, '1', { type: 'cast', x: -9, z: -9 }, '0');
  tick(w, 2);
  assert.ok(w.players.every((p) => p.line?.tangled));
  reelAction(w, '0', { type: 'untangle' }, '0');
  assert.ok(w.players.every((p) => !p.line?.tangled));
  tick(w, 0.3);
  reelAction(w, '0', { type: 'cut' }, '0');
  assert.equal(w.players[0].line, null);
  assert.equal(
    segmentsCross(
      { x: 0, z: 0 },
      { x: 5, z: 5 },
      { x: 0, z: 5 },
      { x: 5, z: 0 },
    ),
    true,
  );
});
void test('Hooks can rescue swimming teammates and ordinary boarding is proximity-limited', () => {
  const w = game(2),
    friend = w.players[1];
  friend.swimming = true;
  friend.x = 10;
  friend.z = 0;
  friend.overboardAt = w.clock;
  assert.throws(() => reelAction(w, '1', { type: 'rescue' }, '0'), /closer/);
  reelAction(w, '0', { type: 'cast', x: 10, z: 0 }, '0');
  assert.equal(w.players[0].line?.kind, 'player');
  w.players[0].input.reel = true;
  w.players[0].input.brace = true;
  tick(w, 9);
  assert.equal(friend.swimming, false);
  assert.equal(w.players[0].line, null);
  assert.ok(
    Math.hypot(
      anglerPosition(w, friend).x - w.boat.x,
      anglerPosition(w, friend).z - w.boat.z,
    ) < 4,
  );
});
void test('Overboard players always recover and restarting clears progress', () => {
  const w = game();
  w.players[0].swimming = true;
  w.players[0].x = 35;
  w.players[0].overboardAt = w.clock;
  tick(w, 12.1);
  assert.equal(w.players[0].swimming, false);
  w.score = 500;
  w.gear.tire = true;
  reelAction(w, '0', { type: 'restart' }, '0');
  assert.equal(w.score, 0);
  assert.equal(w.gear.tire, false);
  assert.equal(w.players.length, 1);
});
void test('Tournament ends at five minutes with a score-based result and time is frame-rate independent', () => {
  const w = game();
  w.fish = [];
  w.wildlife = [];
  w.score = w.goal;
  tick(w, ROUND_MS / 1000 - 0.05);
  assert.equal(w.phase, 'playing');
  tick(w, 0.05);
  assert.equal(w.phase, 'won');
  const loss = game();
  loss.fish = [];
  loss.wildlife = [];
  tick(loss, ROUND_MS / 1000);
  assert.equal(loss.phase, 'lost');
  const fine = game(),
    coarse = game();
  for (let i = 0; i < 300; i++) advanceReel(fine, fine.clock + 10);
  tick(coarse, 3);
  assert.equal(fine.clock, coarse.clock);
  assert.ok(Math.abs(fine.boat.x - coarse.boat.x) < 0.02);
});
void test('Invalid casts and non-captain starts are rejected; leaving releases a hooked fish', () => {
  const w = game(2);
  assert.throws(() => reelAction(w, '1', { type: 'restart' }, '0'), /captain/);
  assert.throws(
    () => reelAction(w, '0', { type: 'cast', x: Infinity, z: 1 }, '0'),
    /Aim/,
  );
  tick(w, 0.3);
  assert.throws(
    () => reelAction(w, '0', { type: 'cast', x: 100, z: 1 }, '0'),
    /24/,
  );
  tick(w, 0.3);
  reelAction(w, '0', { type: 'cast', x: w.fish[0].x, z: w.fish[0].z }, '0');
  tick(w, 0.7);
  assert.ok(
    w.fish.some((f) => hookedAnglers(w, f.id).some((p) => p.id === '0')),
  );
  removeAngler(w, '0');
  assert.ok(
    w.fish.every((f) => hookedAnglers(w, f.id).every((p) => p.id !== '0')),
  );
});
void test('Host checkpoints retain catches, fish and boat dynamics and clear held controls', () => {
  const members = [0, 1, 2, 3].map((i) => ({
    id: String(i),
    name: `Angler ${i}`,
    color: i,
    order: i,
    instance: `tab-${i}`,
    seen: 100000,
  }));
  const engine = createEngine(100000);
  engine.reconcile(members);
  assert.deepEqual(engine.execute('0', 'start-1', { type: 'start' }, '0'), {});
  engine.input('1', { x: 1, z: 0, reel: true, brace: true }, 1);
  engine.advance(50);
  engine.world.score = 99;
  engine.world.gear.magnet = true;
  const checkpoint = engine.checkpoint(),
    replacement = createEngine(900000, checkpoint);
  assert.equal(replacement.world.score, 99);
  assert.equal(replacement.world.gear.magnet, true);
  assert.equal(replacement.world.players[1].input.reel, false);
  assert.equal(replacement.world.players[1].input.x, 0);
  replacement.reconcile(members.slice(1));
  assert.equal(replacement.world.players.length, 3);
  assert.deepEqual(
    replacement.execute('0', 'start-1', { type: 'start' }, '1'),
    {},
  );
  assert.equal(replacement.world.score, 99);
  assert.deepEqual(replacement.world.fish, engine.world.fish);
});
