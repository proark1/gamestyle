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
  CATCHES,
  NET_REACH,
  ROUND_MS,
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
  w.score = w.goal;
  tick(w, ROUND_MS / 1000 - 0.05);
  assert.equal(w.phase, 'playing');
  tick(w, 0.05);
  assert.equal(w.phase, 'won');
  const loss = game();
  loss.fish = [];
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
