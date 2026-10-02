import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceWorld,
  bouncePower,
  castleAction,
  freshWorld,
  jump,
  landingWave,
  pumpPosition,
  scorePoint,
  setInput,
  slap,
  snapshot,
  wallHeight,
} from './simulation';
import {
  ALLOCATION,
  COURT,
  MATCH_MS,
  PRESETS,
  TARGET,
  cleanInput,
  type World,
} from './types';
import { CastleControls } from './controls';
import { CASTLE_DEFAULT_AUDIO } from './catalog';
import { existsSync } from 'node:fs';

function playing() {
  const w = freshWorld(1000);
  castleAction(w, w.players[0].id, { type: 'start' }, true);
  w.phase = 'playing';
  for (const p of w.players) p.bot = false;
  Object.assign(w.ball, { x: 0, z: -4, y: 20, vx: 0, vy: 0, vz: 0 });
  return w;
}
function step(w: World, ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 20)
    advanceWorld(w, w.clock + Math.min(20, ms - elapsed));
}

void test('only the host starts and resetting clears scores and air', () => {
  const w = freshWorld(1000),
    id = w.players[0].id;
  assert.throws(() => castleAction(w, id, { type: 'start' }, false));
  castleAction(w, id, { type: 'start' }, true);
  assert.equal(w.phase, 'serve');
  step(w, 1850);
  assert.equal(w.phase, 'playing');
  w.scores.red = 5;
  w.air.red.pressure = 0.4;
  castleAction(w, id, { type: 'reset' }, true);
  assert.equal(w.scores.red, 0);
  assert.equal(w.air.red.pressure, 1);
});
void test('a grounded volley crosses the net and a double touch loses the point', () => {
  const w = playing(),
    p = w.players[0];
  Object.assign(w.ball, { x: p.x, y: p.y + 1.7, z: p.z, vy: 0 });
  slap(w, p);
  step(w, 20);
  assert.equal(p.hits, 1);
  assert.ok(w.ball.vz < 0);
  step(w, 680);
  assert.ok(w.ball.z < 0);
  assert.equal(w.phase, 'playing');
  Object.assign(w.ball, { x: p.x, y: p.y + 1.7, z: p.z, vx: 0, vy: 0, vz: 0 });
  slap(w, p);
  step(w, 20);
  assert.equal(w.message, 'double');
  assert.equal(w.scores.blue, 1);
});
void test('four team touches and ball out award the opposing team', () => {
  const w = playing(),
    p = w.players[0];
  Object.assign(w.ball, {
    x: p.x,
    z: p.z,
    y: p.y + 1,
    last: w.players[2].id,
    team: 'red',
    touches: 3,
  });
  slap(w, p);
  step(w, 20);
  assert.equal(w.message, 'four');
  assert.equal(w.scores.blue, 1);
  const out = playing();
  Object.assign(out.ball, { x: 7, y: 10, team: 'blue' });
  step(out, 20);
  assert.equal(out.scores.red, 1);
  assert.equal(out.message, 'out');
});
void test('ground contact scores once and seven points ends the match', () => {
  const w = playing();
  Object.assign(w.ball, { y: COURT.floor + COURT.radius + 0.01, z: 4, vy: -2 });
  step(w, 60);
  assert.equal(w.scores.blue, 1);
  step(w, 400);
  assert.equal(w.scores.blue, 1);
  w.phase = 'playing';
  w.scores.red = TARGET - 1;
  scorePoint(w, 'red', 'floor');
  assert.equal(w.phase, 'ended');
  assert.equal(w.winner, 'red');
});
void test('the match timer ends play with a draw or the leading team', () => {
  for (const score of [0, 2]) {
    const w = playing();
    w.scores.red = score;
    w.clock = w.started + MATCH_MS - 10;
    step(w, 20);
    assert.equal(w.phase, 'ended');
    assert.equal(w.winner, score ? 'red' : 'draw');
  }
});
void test('air allocations conserve a finite budget and change jump and wall strength', () => {
  for (const preset of PRESETS)
    assert.equal(
      Object.values(ALLOCATION[preset]).reduce((a, b) => a + b),
      1.5,
    );
  const w = playing(),
    id = w.players[0].id,
    jumpBefore = bouncePower(w, 'red'),
    wallBefore = wallHeight(w, 'red');
  castleAction(w, id, { type: 'air', preset: 'walls' }, false);
  step(w, 800);
  assert.ok(bouncePower(w, 'red') < jumpBefore);
  assert.ok(wallHeight(w, 'red') > wallBefore);
  assert.equal(w.air.blue.preset, 'floor');
  assert.throws(() =>
    castleAction(w, id, { type: 'air', preset: 'infinite' }, false),
  );
});
void test('landing waves launch nearby players; bracing softens the launch', () => {
  const launch = (brace: boolean) => {
    const w = playing(),
      source = w.players[0],
      target = w.players[2];
    source.x = 0;
    target.x = 2;
    target.z = source.z;
    target.input.brace = brace;
    landingWave(w, source, 12);
    step(w, 230);
    assert.equal(w.waves.length, 1);
    return target.vy;
  };
  const normal = launch(false),
    braced = launch(true);
  assert.ok(normal > 5);
  assert.ok(braced < normal * 0.3);
});
void test('jumping twice in midair cannot add height and braced landings emit no wave', () => {
  const w = playing(),
    p = w.players[0];
  jump(w, p);
  const vy = p.vy;
  jump(w, p);
  assert.equal(p.vy, vy);
  p.input.brace = true;
  step(w, 1450);
  assert.equal(w.nextWave, 0);
});
void test('only a nearby grounded player can refill their own team air', () => {
  const w = playing(),
    p = w.players[0];
  w.air.red.pressure = w.air.blue.pressure = 0.4;
  p.input.pump = true;
  step(w, 100);
  assert.ok(w.air.red.pressure < 0.4);
  Object.assign(p, pumpPosition('red'));
  step(w, 500);
  assert.ok(w.air.red.pressure > 0.5);
  assert.ok(w.air.blue.pressure < 0.4);
  assert.ok(p.pumped > 0);
});
void test('snapshots are detached and malformed input stays finite and normalized', () => {
  const w = playing();
  const s = snapshot(w, 'TEST', 'host', 'self', 1);
  s.world.air.red.pressure = 0;
  s.world.players[0].x = 99;
  assert.equal(w.air.red.pressure, 1);
  assert.notEqual(w.players[0].x, 99);
  assert.deepEqual(
    cleanInput({ x: NaN, z: Infinity, brace: 'true', pump: 1 }),
    { x: 0, z: 0, brace: false, pump: false },
  );
  setInput(w, w.players[0].id, { x: 8, z: -9 });
  assert.ok(Math.hypot(w.players[0].input.x, w.players[0].input.z) <= 1.0001);
});
void test('bots play volleys and the match completes without human input', () => {
  const w = freshWorld(1000);
  castleAction(w, w.players[0].id, { type: 'start' }, true);
  step(w, MATCH_MS + 100);
  assert.equal(w.phase, 'ended');
  assert.ok(w.bestRally >= 3, `Best rally was ${w.bestRally}`);
  assert.ok(w.players.reduce((n, p) => n + p.hits, 0) >= 6);
  assert.ok(w.players.some((p) => p.jumps > 0));
});
void test('shared touch/keyboard state clears on cancellation and sound assets exist', () => {
  const controls = new CastleControls();
  controls.key('KeyW', true);
  controls.patch({ x: 1, brace: true, pump: true });
  assert.ok(controls.read().z < 0);
  controls.clear();
  assert.deepEqual(controls.read(), { x: 0, z: 0, brace: false, pump: false });
  for (const cue of Object.values(CASTLE_DEFAULT_AUDIO))
    assert.ok(existsSync(`public${cue.url}`), cue.url);
});
