import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshReel,
  newAngler,
  reelAction,
  advanceReel,
  bank,
  removeAngler,
} from './simulation';
import {
  carriedCargo,
  HARBOR,
  distance,
  componentHome,
  FIRST_DELIVERY,
} from './campaign';
import { beginRecovery, workTarget } from './mission';
import { createEngine } from './peer';
import type { ReelWorld } from './types';
const emit = () => {};
function game(count = 1) {
  const w = freshReel(100000);
  for (let i = 0; i < count; i++)
    w.players.push(newAngler(String(i), `Crew ${i}`, i, w.clock));
  reelAction(w, '0', { type: 'start', mode: 'campaign' }, '0');
  return w;
}
function tick(w: ReelWorld, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds * 20); i++)
    advanceReel(w, w.clock + 50);
}
function work(w: ReelWorld, seconds = 2.2) {
  const p = w.players[0];
  p.input.work = false;
  tick(w, 0.1);
  p.input.work = true;
  tick(w, seconds);
  p.input.work = false;
  tick(w, 0.1);
}
function cargo(w: ReelWorld, n = 3) {
  for (let i = 0; i < n; i++) bank(w, 'perch', [w.players[0]], 'Crew', '');
}
function sail(w: ReelWorld, destination: 'fish' | 'home' | 'repair') {
  reelAction(w, '0', { type: 'sail', destination }, '0');
  for (let i = 0; i < 1200 && w.mission!.course; i++)
    advanceReel(w, w.clock + 50);
  assert.ok(
    distance(w.boat, HARBOR[destination]) < 1,
    'arrived at ' + destination,
  );
}
function walk(w: ReelWorld, x: number, z: number) {
  const p = w.players[0];
  for (let i = 0; i < 300 && Math.hypot(p.x - x, p.z - z) > 0.3; i++) {
    const d = Math.hypot(p.x - x, p.z - z);
    p.input.x = (x - p.x) / d;
    p.input.z = (z - p.z) / d;
    advanceReel(w, w.clock + 50);
  }
  p.input.x = p.input.z = 0;
}
void test('campaign starts with an eight-minute contract; catches are cargo, not delivered points', () => {
  const w = game();
  assert.equal(w.mode, 'campaign');
  assert.equal(w.goal, 3);
  assert.equal(w.mission!.delivered, 0);
  cargo(w);
  assert.equal(carriedCargo(w), 3);
  assert.equal(w.score, 0);
  assert.equal(w.phase, 'playing');
  work(w);
  assert.equal(w.phase, 'won');
  assert.equal(w.score, 3);
  assert.equal(carriedCargo(w), 0);
  tick(w, 1);
  assert.equal(w.mission!.delivered, 3);
  reelAction(w, '0', { type: 'restart' }, '0');
  assert.equal(w.mode, 'campaign');
  assert.equal(w.mission!.cargo.length, 0);
});
void test('a solo crew can sail, catch fish with normal inputs, repair, and deliver', () => {
  const w = game(),
    p = w.players[0];
  sail(w, 'fish');
  for (let catchIndex = 0; catchIndex < 3; catchIndex++) {
    const before = w.mission!.caught;
    for (
      let i = 0;
      i < 2200 && w.mission!.caught === before && w.phase === 'playing';
      i++
    ) {
      if (!p.line) {
        const f = w.fish.find((f) => !f.respawnAt && f.kind === 'perch')!;
        try {
          reelAction(w, p.id, { type: 'cast', x: f.x, z: f.z }, p.id);
        } catch {}
      }
      const fish = w.fish.find((f) => f.id === p.line?.target);
      p.input.brace = true;
      p.input.reel = !!p.line && !fish?.surge && p.line.tension < 0.85;
      advanceReel(w, w.clock + 50);
    }
    p.input.reel = false;
    p.input.brace = false;
    assert.equal(w.mission!.caught, before + 1, 'landed fish ' + catchIndex);
    if (catchIndex === 1) {
      sail(w, 'repair');
      tick(w, 5);
      work(w, 3.2);
      assert.equal(w.leak, null);
      sail(w, 'fish');
    }
  }
  sail(w, 'home');
  work(w);
  assert.equal(w.phase, 'won');
  assert.ok(w.clock - w.started < FIRST_DELIVERY.duration);
});
void test('unloading requires proximity, an uninterrupted hold, and ends once', () => {
  const w = game(2);
  cargo(w);
  Object.assign(w.boat, HARBOR.fish);
  work(w);
  assert.equal(w.score, 0);
  Object.assign(w.boat, HARBOR.home);
  work(w, 0.8);
  assert.equal(w.score, 0);
  w.players[0].input.work = true;
  w.players[1].input.work = true;
  tick(w, 2.2);
  assert.equal(w.score, 3);
  assert.equal(
    w.mission!.cargo.filter((c) => c.location === 'delivered').length,
    3,
  );
});
void test('full cargo is released, expiry fails, and invalid mode/course actions are rejected', () => {
  const w = game();
  cargo(w, 8);
  assert.equal(carriedCargo(w), 6);
  assert.equal(w.mission!.caught, 6);
  assert.throws(() =>
    reelAction(w, '0', { type: 'sail', destination: 'outside' } as never, '0'),
  );
  w.clock = w.started + FIRST_DELIVERY.duration - 50;
  advanceReel(w, w.clock + 50);
  assert.equal(w.phase, 'lost');
});
void test('sinking requires a real four-part rebuild, supports walking and solo relaunch', () => {
  const w = game();
  cargo(w);
  w.boat.flood = 0.999;
  w.leak = { x: 1, z: 1, at: w.clock - 11000, patch: 0, warned: true };
  tick(w, 0.1);
  assert.equal(w.boat.sunk, true);
  assert.equal(w.mission!.status, 'recovering');
  assert.equal(
    w.mission!.cargo.filter((c) => c.location === 'water').length,
    3,
  );
  tick(w, 12.2);
  const p = w.players[0];
  assert.equal(p.support, 'dock');
  assert.equal(w.boat.sunk, true);
  for (let i = 0; i < 4; i++) {
    const rack = componentHome(i);
    walk(w, rack.x, rack.z);
    work(w, 0.5);
    assert.equal(
      w.mission!.components[i].carrier,
      p.id,
      'picked up component ' + i,
    );
    walk(w, HARBOR.frame.x, HARBOR.frame.z);
    work(w);
    assert.equal(
      w.mission!.components[i].installed,
      true,
      'installed component ' + i,
    );
  }
  assert.equal(workTarget(w, p)?.id, 'launch');
  work(w);
  assert.equal(w.boat.sunk, false);
  assert.equal(w.mission!.raft, true);
  assert.equal(w.mission!.rebuilds, 1);
  assert.equal(p.support, 'boat');
  assert.equal(w.phase, 'playing');
});
void test('two crew cannot claim the same part; disconnect and lost material recover safely', () => {
  const w = game(2);
  w.boat.sunk = true;
  w.boat.sunkAt = w.clock;
  beginRecovery(w, emit);
  tick(w, 12.2);
  for (const p of w.players) {
    Object.assign(p, componentHome(0));
    p.input.work = true;
  }
  tick(w, 0.5);
  const item = w.mission!.components[0];
  assert.ok(item.carrier);
  const owner = item.carrier!;
  removeAngler(w, owner);
  assert.equal(item.carrier, null);
  tick(w, 10.2);
  assert.deepEqual({ x: item.x, z: item.z }, componentHome(0));
});
void test('deckhand can rebuild without a human completing every station', () => {
  const w = game();
  w.players[0].bot = true;
  w.boat.sunk = true;
  w.boat.sunkAt = w.clock;
  beginRecovery(w, emit);
  tick(w, 65);
  assert.equal(w.mission!.rebuilds, 1);
  assert.equal(w.boat.sunk, false);
});
void test('checkpoint restoration preserves mission work but clears held interactions', () => {
  const engine = createEngine(100000);
  const w = engine.world;
  w.players.push(newAngler('0', 'Crew', 0, w.clock));
  reelAction(w, '0', { type: 'start', mode: 'campaign' }, '0');
  cargo(w);
  w.mission!.holds['0'] = { target: 'unload', progress: 0.6 };
  w.players[0].input.work = true;
  const checkpoint = engine.checkpoint();
  const restored = createEngine(w.clock, checkpoint).world;
  assert.equal(restored.mission!.cargo.length, 3);
  assert.deepEqual(restored.mission!.holds, {});
  assert.equal(restored.players[0].input.work, undefined);
});

void test('rebuilding then recovering and delivering the floating cargo finishes the same contract', () => {
  const w = game();
  cargo(w);
  w.boat.flood = 0.999;
  w.leak = { x: 1, z: 1, at: w.clock - 11000, patch: 0, warned: true };
  tick(w, 12.5);
  for (let i = 0; i < 4; i++) {
    const rack = componentHome(i);
    walk(w, rack.x, rack.z);
    work(w, 0.5);
    walk(w, HARBOR.frame.x, HARBOR.frame.z);
    work(w);
  }
  work(w);
  assert.equal(w.mission!.raft, true);
  assert.equal(w.leak, null);
  sail(w, 'home');
  for (let i = 0; i < 3; i++) {
    work(w, 1.2);
    work(w, 2.2);
  }
  assert.equal(w.phase, 'won');
  assert.equal(w.mission!.delivered, 3);
  assert.equal(w.mission!.lost, 0);
});
void test('switching back to classic discards campaign state and a final deadline unload can win', () => {
  const w = game();
  reelAction(w, '0', { type: 'restart', mode: 'classic' }, '0');
  assert.equal(w.mission, undefined);
  assert.equal(w.mode, 'classic');
  assert.equal(w.goal, 140);
  const last = game();
  cargo(last);
  last.mission!.lessonDone = true;
  last.clock = last.started + FIRST_DELIVERY.duration - 50;
  last.players[0].input.work = true;
  last.mission!.holds['0'] = { target: 'unload', progress: 0.98 };
  advanceReel(last, last.clock + 50);
  assert.equal(last.phase, 'won');
  assert.equal(last.clock - last.started, FIRST_DELIVERY.duration);
});
