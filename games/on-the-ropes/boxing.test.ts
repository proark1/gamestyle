import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshWorld,
  startMatch,
  stepWorld,
  advanceWorld,
  tagReason,
  boxingAction,
} from './simulation';
import { CORNERS, cleanInput, idleInput, type World } from './types';
import { createEngine } from './peer';
import { BoxingControls } from './controls';

function match() {
  const w = freshWorld(1000);
  startMatch(w);
  w.phase = 'playing';
  for (const p of w.players) p.bot = false;
  return w;
}
function ticks(w: World, n: number) {
  for (let i = 0; i < n; i++) stepWorld(w);
}
function faceOff(w: World) {
  const a = w.players[0],
    b = w.players[2];
  a.x = -0.5;
  b.x = 0.5;
  a.z = b.z = 0;
  a.heading = Math.PI / 2;
  b.heading = -Math.PI / 2;
  return [a, b];
}
void test('input rejects NaN, infinities and coercions, and normalizes diagonals', () => {
  assert.deepEqual(
    cleanInput({ x: NaN, z: Infinity, punch: 'true' }),
    idleInput(),
  );
  assert.ok(
    Math.abs(
      Math.hypot(cleanInput({ x: 1, z: 1 }).x, cleanInput({ x: 1, z: 1 }).z) -
        1,
    ) < 1e-9,
  );
});

void test('cancelling a charged punch or corner assist never fires it', () => {
  const w = match(),
    a = w.players[0],
    reserve = w.players[1];
  Object.assign(a, CORNERS.red);
  a.charge = 0.8;
  reserve.assistCharge = 1.2;
  a.input.cancel = reserve.input.cancel = true;
  stepWorld(w);
  assert.equal(a.punches, 0);
  assert.equal(w.teams.red.ropeCooldown, 0);
  const controls = new BoxingControls();
  controls.key('Space', true);
  controls.clear();
  assert.equal(controls.read().punch, false);
  controls.key('ShiftLeft', true);
  controls.patch({ guard: true });
  controls.patch({ guard: false });
  assert.equal(controls.read().guard, true);
});

void test('corner player can call their bot partner back for a tag', () => {
  const w = match();
  w.players[0].bot = true;
  w.players[1].input.tag = true;
  ticks(w, 240);
  assert.equal(w.players[1].active, true);
});
void test('high refresh rates preserve the same fight clock as 60 Hz', () => {
  for (const hz of [30, 60, 120, 144]) {
    const w = match();
    for (let i = 0; i < hz * 3; i++) advanceWorld(w, w.clock + 1000 / hz);
    assert.ok(Math.abs(w.time - 177) < 0.02, `${hz} Hz: ${w.time}`);
  }
});
void test('tap punch lands once, charges use stamina and misses do not damage', () => {
  const w = match(),
    [a, b] = faceOff(w);
  a.input.punch = true;
  ticks(w, 8);
  a.input.punch = false;
  ticks(w, 30);
  assert.equal(a.punches, 1);
  assert.ok(b.balance >= 12);
  assert.ok(a.stamina < 100);
  b.x = 4;
  b.z = 3;
  const balance = b.balance;
  a.input.punch = true;
  ticks(w, 40);
  a.input.punch = false;
  ticks(w, 25);
  assert.ok(b.balance <= balance);
  assert.ok(w.events.some((e) => e.kind === 'miss'));
});
void test('front guard reduces balance damage; grounded and reserve players cannot be punched', () => {
  const w = match(),
    [a, b] = faceOff(w);
  b.input.guard = true;
  a.input.punch = true;
  ticks(w, 5);
  a.input.punch = false;
  ticks(w, 12);
  assert.ok(b.balance < 5);
  assert.ok(w.events.some((e) => e.kind === 'block'));
  const reserve = w.players[3];
  reserve.x = a.x;
  reserve.z = a.z;
  assert.equal(reserve.balance, 0);
  b.down = true;
  b.balance = 0;
  ticks(w, 30);
  a.input.punch = true;
  ticks(w, 5);
  a.input.punch = false;
  ticks(w, 12);
  assert.equal(b.balance, 0);
});
void test('tag needs both players, own corner, standing, disengagement and cooldown', () => {
  const w = match(),
    a = w.players[0],
    r = w.players[1];
  Object.assign(a, CORNERS.red);
  a.input.tag = true;
  assert.equal(tagReason(w, a), 'partner');
  r.input.tag = true;
  assert.equal(tagReason(w, a), 'ready');
  a.lastHit = w.clock;
  assert.equal(tagReason(w, a), 'fighting');
  a.lastHit = -10000;
  a.down = true;
  assert.equal(tagReason(w, a), 'recovering');
  a.down = false;
  ticks(w, 28);
  assert.equal(a.active, false);
  assert.equal(r.active, true);
  assert.ok(w.teams.red.tagCooldown > 7);
  assert.equal(tagReason(w, r), 'recovering');
  ticks(w, 40);
  assert.equal(tagReason(w, r), 'cooldown');
  assert.equal(w.players.filter((p) => p.active).length, 2);
});
void test('a hit cancels an almost completed tag', () => {
  const w = match(),
    [a, b] = faceOff(w),
    r = w.players[1];
  Object.assign(a, CORNERS.red);
  b.x = a.x + 1;
  b.z = a.z;
  b.heading = -Math.PI / 2;
  a.input.tag = r.input.tag = true;
  w.teams.red.tagProgress = 0.43;
  b.attack = 0.25;
  b.struck = false;
  stepWorld(w);
  assert.equal(a.active, true);
  assert.equal(w.teams.red.tagProgress, 0);
  assert.ok(a.balance > 0);
});

void test('same-tick guard and dodge work regardless of player order', () => {
  for (const reverse of [false, true]) {
    for (const defense of ['guard', 'dodge'] as const) {
      const w = match(),
        [a, b] = faceOff(w);
      if (reverse) w.players.reverse();
      a.attack = 0.25;
      a.struck = false;
      b.input[defense] = true;
      stepWorld(w);
      assert.ok(b.balance < 5, `${defense}, reversed=${reverse}: ${b.balance}`);
    }
  }
});
void test('simultaneous winning knockdowns continue in bounded sudden death', () => {
  const w = match(),
    [a, b] = faceOff(w);
  w.teams.red.score = w.teams.blue.score = 2;
  a.balance = b.balance = 90;
  a.attack = b.attack = 0.25;
  a.struck = b.struck = false;
  stepWorld(w);
  assert.equal(w.teams.red.score, 3);
  assert.equal(w.teams.blue.score, 3);
  assert.equal(w.phase, 'stoppage');
  assert.equal(w.overtime, true);
  ticks(w, 241);
  assert.equal(w.players[1].active, true);
  assert.equal(w.players[3].active, true);
  ticks(w, 2701);
  assert.equal(w.phase, 'ended');
  assert.equal(w.winner, 'draw');
});
void test('three knockdowns finish the match once; a down boxer cannot tag out', () => {
  const w = match();
  w.teams.blue.score = 2;
  w.players[0].balance = 110;
  stepWorld(w);
  assert.equal(w.phase, 'ended');
  assert.equal(w.winner, 'blue');
  ticks(w, 100);
  assert.equal(w.teams.blue.score, 3);
});
void test('corner towel and rope assist are limited and cannot hit the opposing reserve', () => {
  const w = match(),
    a = w.players[0],
    r = w.players[1];
  Object.assign(a, CORNERS.red);
  a.stamina = 30;
  r.input.assist = true;
  ticks(w, 62);
  assert.ok(a.stamina > 55);
  assert.ok(w.teams.red.towelCooldown > 14);
  r.input.assist = false;
  stepWorld(w);
  assert.ok(w.teams.red.ropeCooldown > 11);
  assert.ok(Math.hypot(a.vx, a.vz) > 6);
});
void test('only host starts and team swaps are locked while boxing', () => {
  const w = freshWorld(1000);
  assert.throws(() =>
    boxingAction(w, w.players[0].id, { type: 'ready' }, false),
  );
  startMatch(w);
  assert.throws(() =>
    boxingAction(w, w.players[0].id, { type: 'switch_team' }, true),
  );
});
void test('peer recovery restores tags, attacks, timers and two active boxers', () => {
  const e = createEngine(1000);
  const members = Array.from({ length: 4 }, (_, i) => ({
    id: `p${i}`,
    name: `Player ${i}`,
    color: i,
    order: i,
    instance: `t${i}`,
    seen: 1000,
  }));
  e.reconcile(members);
  assert.equal(
    e.execute('p0', 'begin', { type: 'start' }, 'p0').error,
    undefined,
  );
  for (let i = 0; i < 65; i++) e.advance(50);
  e.world.teams.red.tagProgress = 0.3;
  e.world.players[0].attack = 0.2;
  const recovered = createEngine(8000, e.checkpoint());
  assert.deepEqual(recovered.world, e.world);
  for (let i = 0; i < 10; i++) {
    e.advance(50);
    recovered.advance(50);
  }
  assert.deepEqual(recovered.world, e.world);
  recovered.reconcile(members.slice(1));
  assert.equal(recovered.world.players.length, 4);
  assert.equal(recovered.world.players.filter((p) => p.active).length, 2);
  const view = recovered.snapshot('ABCDEF', 'p1', 'p1', 1);
  recovered.world.teams.red.score++;
  assert.notEqual(view.world.teams.red.score, recovered.world.teams.red.score);
});
void test('practice bots complete a finite match and produce punches', () => {
  const w = freshWorld(1000);
  startMatch(w);
  ticks(w, 16000);
  assert.equal(w.phase, 'ended');
  assert.ok(w.players.some((p) => p.punches > 5));
  assert.ok(w.teams.red.score + w.teams.blue.score > 0);
});
