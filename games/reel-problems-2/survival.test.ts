import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshReel, newAngler, reelAction, advanceReel } from './simulation';
import { surging } from './survival';
import { beginRecovery, workTarget } from './mission';
import { materialPoint, recoveryPoint, roundDuration } from './campaign';
import { createEngine } from './peer';
import type { ReelWorld } from './types';
function game(count = 1) {
  const w = freshReel(100000);
  for (let i = 0; i < count; i++)
    w.players.push(newAngler(String(i), `Crew ${i}`, i, w.clock));
  reelAction(
    w,
    '0',
    { type: 'start', mode: 'campaign', contract: 'last-boat-home' },
    '0',
  );
  return w;
}
function tick(w: ReelWorld, seconds: number, driver?: () => void) {
  for (let i = 0; i < Math.ceil(seconds * 20) && w.phase === 'playing'; i++) {
    driver?.();
    advanceReel(w, w.clock + 50);
  }
}
function hold(w: ReelWorld, seconds = 2.2) {
  w.players[0].input.work = false;
  tick(w, 0.1);
  w.players[0].input.work = true;
  tick(w, seconds);
  w.players[0].input.work = false;
  tick(w, 0.1);
}
function fight(w: ReelWorld) {
  tick(w, 60, () => {
    const a = w.mission!.survival!,
      p = w.players[0];
    p.input.reel = !surging(w);
    p.input.brace = surging(w);
    p.input.x = w.boat.x < 7 ? 1 : 0;
    p.input.work = !!workTarget(w, p) && !w.mission!.latched.includes(p.id);
    if (a.stage !== 'fight') p.input.reel = false;
  });
}
void test('Last Boat Home starts immediately with a giant and four-minute deadline; legacy mission stays compatible', () => {
  const w = game();
  assert.equal(w.mission?.survival?.stage, 'fight');
  assert.equal(roundDuration(w), 240000);
  assert.equal(w.boat.z, 2);
  reelAction(w, '0', { type: 'restart' }, '0');
  assert.equal(w.mission?.id, 'last-boat-home');
  assert.equal(w.mission?.survival?.giant, 0);
  reelAction(w, '0', { type: 'restart', mode: 'classic' }, '0');
  assert.equal(w.mission, undefined);
});
void test('solo can fight, steer, brace, repair and escape with normal inputs', () => {
  const w = game();
  fight(w);
  assert.ok(w.mission!.survival!.caught);
  if (w.mission!.survival!.stage === 'choice')
    reelAction(w, '0', { type: 'sail', destination: 'home' }, '0');
  tick(w, 100, () => {
    const a = w.mission!.survival!,
      p = w.players[0];
    p.input.reel = !a.warned;
    p.input.brace = a.warned;
    p.input.x = Math.abs(w.boat.x) > 0.5 ? -Math.sign(w.boat.x) : 0;
    p.input.work = !!workTarget(w, p) && !w.mission!.latched.includes(p.id);
  });
  assert.equal(w.phase, 'won');
  assert.equal(w.mission!.delivered, 1);
  assert.equal(w.sinks, 0);
});
void test('reeling through surges is costly, while releasing protects the hull', () => {
  const a = game(),
    b = game();
  a.boat.x = b.boat.x = 8;
  tick(a, 8, () => {
    a.players[0].input.reel = true;
  });
  tick(b, 8, () => {
    b.players[0].input.reel = !surging(b);
    b.players[0].input.brace = surging(b);
  });
  assert.ok(a.boat.flood > b.boat.flood);
  assert.ok(a.mission!.survival!.giant < b.mission!.survival!.giant);
});
function voyage(w: ReelWorld, risk = false) {
  w.mission!.survival!.stage = 'choice';
  reelAction(
    w,
    '0',
    { type: 'sail', destination: risk ? 'fish' : 'home' },
    '0',
  );
}
void test('route choice is shared and locks; a late request cannot restart encounters', () => {
  const w = game(2);
  voyage(w, true);
  tick(w, 3);
  const since = w.mission!.survival!.since;
  reelAction(w, '1', { type: 'sail', destination: 'home' }, '0');
  assert.equal(w.mission!.survival!.route, 'risk');
  assert.equal(w.mission!.survival!.since, since);
});
void test('warned waves reward bracing; exposed crew spill cargo and need rescue', () => {
  const w = game(2);
  voyage(w);
  w.mission!.cargo.push({
    id: 'test',
    kind: 'monster',
    location: 'boat',
    x: 0,
    z: 0,
    until: 0,
  });
  w.mission!.survival!.waves = 1;
  w.mission!.survival!.waveAt = w.clock + 1000;
  tick(w, 1.2);
  assert.ok(w.players.some((p) => p.swimming));
  assert.ok(w.mission!.cargo.some((c) => c.location === 'water'));
  const p = w.players.find((p) => !p.swimming)!;
  assert.match(workTarget(w, p)!.id, /crew:/);
  p.input.work = true;
  tick(w, 1.2);
  assert.equal(w.players.filter((p) => p.swimming).length, 0);
  assert.equal(w.mission!.survival!.rescues, 1);
});
void test('a braced crew passes three waves without spilling cargo', () => {
  const w = game();
  voyage(w);
  w.players[0].input.brace = true;
  tick(w, 43);
  assert.equal(w.mission!.survival!.waves, 3);
  assert.equal(w.mission!.survival!.hits, 0);
  assert.equal(w.boat.flood, 0);
});
void test('wreck assembly stays at the sinking location and launches there', () => {
  const w = game();
  voyage(w);
  w.boat.x = -7;
  w.boat.z = 12;
  w.boat.sunk = true;
  beginRecovery(w, () => {});
  tick(w, 4.2);
  assert.equal(w.players[0].support, 'dock');
  assert.deepEqual(w.mission!.survival!.wreck, { x: -7, z: 12 });
  for (let i = 0; i < 4; i++) {
    Object.assign(w.players[0], materialPoint(w, i));
    hold(w, 0.5);
    assert.equal(w.mission!.components[i].carrier, '0');
    Object.assign(w.players[0], recoveryPoint(w, 'frame'));
    hold(w, 1.2);
    assert.ok(w.mission!.components[i].installed);
  }
  hold(w, 2.2);
  assert.equal(w.mission!.raft, true);
  assert.equal(w.boat.sunk, false);
  assert.ok(Math.abs(w.boat.x + 7) < 1);
});
void test('gate cannot finish with a friend overboard and deadline fails once', () => {
  const w = game(2);
  voyage(w);
  w.mission!.survival!.stage = 'escape';
  w.mission!.survival!.progress = 1;
  w.boat.x = 0;
  w.boat.z = 33.4;
  w.players[1].swimming = true;
  w.players[1].x = 7;
  w.players[1].z = 33.4;
  assert.match(workTarget(w, w.players[0])!.id, /crew:/);
  w.clock = w.started + 239950;
  tick(w, 0.1);
  assert.equal(w.phase, 'lost');
  assert.equal(w.mission!.status, 'failed');
});
void test('survival state survives host checkpoint restore, but held controls do not', () => {
  const e = createEngine(100000);
  const w = e.world;
  w.players.push(newAngler('0', 'Crew', 0, w.clock));
  reelAction(
    w,
    '0',
    { type: 'start', mode: 'campaign', contract: 'last-boat-home' },
    '0',
  );
  voyage(w, true);
  w.mission!.survival!.rescues = 2;
  const restored = createEngine(w.clock, e.checkpoint());
  assert.equal(restored.world.mission!.survival!.route, 'risk');
  assert.equal(restored.world.mission!.survival!.rescues, 2);
  assert.equal(restored.world.players[0].input.work, undefined);
});
void test('holding brace forever cannot carry the crew home; rowing makes progress', () => {
  const idle = game(),
    rowing = game();
  voyage(idle);
  voyage(rowing);
  idle.players[0].input.brace = true;
  rowing.players[0].input.reel = true;
  tick(idle, 8);
  tick(rowing, 8);
  assert.ok(
    rowing.mission!.survival!.progress > idle.mission!.survival!.progress * 4,
  );
});
