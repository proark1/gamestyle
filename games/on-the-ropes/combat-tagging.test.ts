import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshWorld,
  startMatch,
  stepWorld,
  boxingAction,
  tagReason,
} from './simulation';
import { CORNERS, idleInput, type World } from './types';
import { PUNCHES } from './combat';
import { createEngine } from './peer';
import { BoxingControls } from './controls';
import { rulesVersion } from '../../shared/peer/protocol';

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
  const [a, , b] = w.players;
  a.x = -0.5;
  b.x = 0.5;
  a.z = b.z = 0;
  a.heading = Math.PI / 2;
  b.heading = -Math.PI / 2;
  return [a, b];
}

void test('one-tap call brings either NPC home from across the ring and swaps the actual roles', () => {
  for (const team of ['red', 'blue'] as const) {
    for (const pressure of [false, true]) {
      const w = match();
      const npc = w.players.find((p) => p.team === team && p.active)!;
      const human = w.players.find((p) => p.team === team && !p.active)!;
      const foe = w.players.find((p) => p.team !== team && p.active)!;
      npc.bot = true;
      foe.bot = pressure;
      npc.x = -CORNERS[team].x * 0.65;
      npc.z = -CORNERS[team].z * 0.65;
      human.z += 1.2; // Reserve also needs to return to the actual handoff spot.
      human.input.tag = true;
      stepWorld(w);
      human.input.tag = false;
      assert.equal(human.tagRequested, true);
      for (let n = 0; n < 900 && human.tags === 0; n++) stepWorld(w);
      assert.ok(
        human.tags > 0,
        `${team}, pressure=${pressure}: NPC did not complete a voluntary tag`,
      );
      assert.equal(human.active, true);
      assert.equal(npc.active, false);
      assert.ok(human.tagTransition > 0);
      assert.ok(Math.abs(npc.x) > 5.5);
      assert.ok(Math.abs(human.x) < 5.5);
      assert.equal(human.tagRequested, false);
      assert.equal(
        w.players.filter((p) => p.active && p.team === team).length,
        1,
      );
      ticks(w, 40);
      assert.equal(human.tagTransition, 0);
      assert.equal(npc.tagTransition, 0);
      assert.equal(npc.attack, 0);
      assert.equal(npc.charge, 0);
    }
  }
});

void test('call-back cancels an NPC charge instead of throwing it during retreat', () => {
  const w = match(),
    [npc, human] = w.players;
  npc.bot = true;
  npc.charge = 0.8;
  npc.botHold = 0.6;
  human.input.tag = true;
  stepWorld(w);
  human.input.tag = false;
  assert.equal(npc.charge, 0);
  assert.equal(npc.punches, 0);
  ticks(w, 240);
  assert.equal(human.active, true);
});

void test('request survives cooldown, a second tap cancels it, and holding never repeatedly toggles', () => {
  const w = match(),
    [npc, human] = w.players;
  npc.bot = true;
  w.teams.red.tagCooldown = 3;
  human.input.tag = true;
  ticks(w, 90);
  assert.equal(human.tagRequested, true);
  assert.equal(human.active, false);
  human.input.tag = false;
  stepWorld(w);
  human.input.tag = true;
  stepWorld(w);
  human.input.tag = false;
  assert.equal(human.tagRequested, false);
  ticks(w, 130);
  assert.equal(human.active, false);
  human.input.tag = true;
  stepWorld(w);
  human.input.tag = false;
  ticks(w, 300);
  assert.equal(human.active, true);
});

void test('focus loss cancels a pending request and a fast keyboard/pointer tap is latched', () => {
  const w = match(),
    human = w.players[1];
  human.input.tag = true;
  stepWorld(w);
  human.input = { ...idleInput(), cancel: true };
  stepWorld(w);
  assert.equal(human.tagRequested, false);
  for (const source of ['key', 'pointer']) {
    const c = new BoxingControls();
    if (source === 'key') {
      c.key('KeyE', true);
      c.key('KeyE', false);
    } else {
      c.patch({ tag: true });
      c.patch({ tag: false });
    }
    assert.equal(c.read().tag, true);
    c.clear();
    assert.equal(c.read().tag, false);
  }
});

void test('tag transit clears queued attacks and assists, locks position, and prevents hits until entry finishes', () => {
  const w = match(),
    [a, r, b] = w.players;
  Object.assign(a, CORNERS.red);
  a.input.tag = true;
  r.tagRequested = true;
  r.assistCharge = 1.3;
  r.input.assist = true;
  ticks(w, 28);
  assert.equal(r.active, true);
  assert.equal(r.assistCharge, 0);
  r.input.punch = true;
  r.input.x = 1;
  b.active = true;
  b.x = r.x + 0.8;
  b.z = r.z;
  b.heading = -Math.PI / 2;
  b.attack = 0.25;
  b.struck = false;
  const x = r.x,
    balance = r.balance;
  ticks(w, 15);
  assert.equal(r.x, x);
  assert.equal(r.balance, balance);
  assert.equal(r.attack, 0);
  assert.equal(w.teams.red.ropeCooldown, 0);
  assert.equal(tagReason(w, r), 'recovering');
  ticks(w, 30);
  assert.equal(r.tagTransition, 0);
  assert.ok(r.x > x);
});

void test('active human tags out to NPC and can call back again after cooldown', () => {
  const w = match(),
    [human, npc] = w.players;
  npc.bot = true;
  Object.assign(human, CORNERS.red);
  human.input.tag = true;
  ticks(w, 28);
  assert.equal(human.active, false);
  assert.equal(npc.active, true);
  ticks(w, 45);
  assert.equal(
    human.tagRequested,
    false,
    'held key must not call straight back',
  );
  human.input.tag = false;
  stepWorld(w);
  human.input.tag = true;
  stepWorld(w);
  human.input.tag = false;
  assert.equal(human.tagRequested, true);
  ticks(w, 550);
  assert.equal(human.active, true);
  assert.equal(npc.active, false);
  assert.equal(human.tags, 2);
});

void test('human partners must accept the call at their corner; no forced mid-ring swap', () => {
  const w = match(),
    [a, r] = w.players;
  r.input.tag = true;
  stepWorld(w);
  r.input.tag = false;
  ticks(w, 120);
  assert.equal(a.active, true);
  assert.equal(r.active, false);
  Object.assign(a, CORNERS.red);
  ticks(w, 40);
  assert.equal(a.active, true);
  a.input.tag = true;
  ticks(w, 28);
  assert.equal(r.active, true);
});

void test('jab-cross rhythm, recovery and a guarded feint have distinct outcomes', () => {
  const w = match(),
    [a, b] = faceOff(w);
  a.input.punch = true;
  ticks(w, 5);
  a.input.punch = false;
  ticks(w, 34);
  assert.equal(a.combo, 1);
  assert.ok(b.balance >= PUNCHES.jab.damage);
  faceOff(w);
  a.input.punch = true;
  ticks(w, 5);
  a.input.punch = false;
  stepWorld(w);
  assert.equal(a.combo, 2);
  assert.equal(a.attack, PUNCHES.cross.duration - 1 / 60);
  ticks(w, 45);
  assert.ok(b.balance >= PUNCHES.jab.damage + PUNCHES.cross.damage);
  a.input.punch = true;
  ticks(w, 35);
  a.input.guard = true;
  stepWorld(w);
  a.input.punch = false;
  stepWorld(w);
  assert.equal(a.charge, 0);
  assert.equal(a.punches, 2);
});

void test('a timed parry opens one counter while a held guard spends stamina', () => {
  const w = match(),
    [a, b] = faceOff(w);
  a.attack = 0.27;
  a.struck = false;
  b.input.guard = true;
  stepWorld(w);
  assert.equal(b.balance, 0);
  assert.ok(b.counter > 0);
  assert.ok(a.stagger > 0);
  assert.ok(w.events.some((e) => e.kind === 'parry'));
  b.input.guard = false;
  b.input.punch = true;
  ticks(w, 4);
  b.input.punch = false;
  ticks(w, 12);
  assert.ok(a.balance > PUNCHES.jab.damage);
  assert.ok(w.events.some((e) => e.kind === 'counter'));
  assert.equal(b.counter, 0);
  const other = match(),
    [c, d] = faceOff(other);
  d.input.guard = true;
  ticks(other, 15);
  c.attack = 0.27;
  c.struck = false;
  stepWorld(other);
  assert.ok(d.balance > 0 && d.balance < 4);
  assert.equal(d.counter, 0);
});

void test('heavy misses recover longer and exhausted guards break without negative stamina', () => {
  const w = match(),
    [a, b] = faceOff(w);
  b.x = 4;
  a.heavy = true;
  a.attack = PUNCHES.hook.duration;
  a.struck = false;
  ticks(w, 52);
  assert.ok(a.cooldown > 0.35);
  assert.ok(a.balance > 0);
  assert.equal(a.whiffed, true);
  const other = match(),
    [c, d] = faceOff(other);
  d.input.guard = true;
  d.guarding = true;
  d.guardAge = 1;
  d.stamina = 7;
  c.heavy = true;
  c.attack = 0.51;
  c.struck = false;
  stepWorld(other);
  assert.equal(d.stamina, 0);
  assert.equal(d.guarding, false);
  assert.ok(d.stagger >= 0.5);
  assert.ok(other.events.some((e) => e.kind === 'guard-break'));
});

void test('call-back and transit survive host checkpoints without duplicating the swap', () => {
  const e = createEngine(1000);
  e.reconcile([
    {
      id: 'human',
      name: 'Human',
      color: 0,
      order: 0,
      instance: 'one',
      seen: 1000,
    },
  ]);
  boxingAction(e.world, 'human', { type: 'switch_role' }, true);
  startMatch(e.world);
  e.world.phase = 'playing';
  const human = e.world.players.find((p) => p.id === 'human')!;
  human.input.tag = true;
  stepWorld(e.world);
  human.input.tag = false;
  const recovered = createEngine(1000, e.checkpoint());
  for (let i = 0; i < 250; i++) {
    stepWorld(e.world);
    stepWorld(recovered.world);
  }
  assert.deepEqual(recovered.world, e.world);
  assert.ok(human.tags > 0);
  assert.equal(human.active, true);
  const a = match();
  Object.assign(a.players[0], CORNERS.red);
  a.players[0].input.tag = true;
  a.players[1].tagRequested = true;
  ticks(a, 28);
  e.world.players = a.players;
  e.world.teams = a.teams;
  const mid = createEngine(1000, e.checkpoint());
  for (let i = 0; i < 60; i++) {
    stepWorld(e.world);
    stepWorld(mid.world);
  }
  assert.deepEqual(mid.world, e.world);
  assert.equal(mid.world.players[1].tags, 1);
});

void test('peer input packets carry a released one-tap request through to an NPC swap', () => {
  const engine = createEngine(1000);
  engine.reconcile([
    {
      id: 'caller',
      name: 'Caller',
      color: 0,
      order: 0,
      instance: 'tab',
      seen: 1000,
    },
  ]);
  assert.equal(
    engine.execute('caller', 'role', { type: 'switch_role' }, 'caller').error,
    undefined,
  );
  assert.equal(
    engine.execute('caller', 'start', { type: 'start' }, 'caller').error,
    undefined,
  );
  let order = 0;
  for (let i = 0; i < 62; i++) {
    engine.input('caller', idleInput(), ++order);
    engine.advance(50);
  }
  engine.input('caller', { ...idleInput(), tag: true }, ++order);
  engine.advance(50);
  const caller = engine.world.players.find((p) => p.id === 'caller')!;
  assert.equal(caller.tagRequested, true);
  for (let i = 0; i < 180 && caller.tags === 0; i++) {
    engine.input('caller', idleInput(), ++order);
    engine.advance(50);
  }
  assert.equal(caller.tags, 1);
  assert.equal(caller.active, true);
  const obsolete = { ...engine.checkpoint(), rules: 2 };
  assert.equal(rulesVersion('on-the-ropes'), 3);
  assert.throws(() => createEngine(1000, obsolete), /checkpoint/);
});
