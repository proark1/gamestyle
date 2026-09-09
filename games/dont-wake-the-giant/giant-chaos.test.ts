import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceGiant,
  freshGiant,
  giantAction,
  giantHint,
  giantPlayer,
  heldItem,
  removeGiantPlayer,
} from './simulation';
import { handoffTarget } from './handoff';
import { platforms, wakePose } from './level';
import type { GiantWorld, ItemKind } from './types';
import { createPeerEngine } from '../../platform/peer/engine';

const NOW = 100000;
function world(kind: ItemKind = 'cup') {
  const w = freshGiant(NOW);
  w.players = [giantPlayer('a', 'Ada', 0, NOW), giantPlayer('b', 'Bo', 1, NOW)];
  giantAction(w, 'a', { type: 'start' }, 'a');
  w.items = [w.items.find((i) => i.kind === kind)!];
  Object.assign(w.items[0], { heldBy: 'a', support: null });
  return w;
}
function advance(w: GiantWorld, ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 20) {
    w.players.forEach((p) => (p.seen = w.clock));
    advanceGiant(w, w.clock + Math.min(20, ms - elapsed));
  }
}
function fall(height: number, kind?: ItemKind, crouch = false, pillow = false) {
  const w = world(kind);
  if (!kind) w.items = [];
  Object.assign(w.players[0], {
    x: -11,
    y: height,
    z: -6,
    grounded: false,
    support: null,
  });
  w.players[0].input.crouch = crouch;
  if (pillow) {
    const pad = freshGiant(NOW).items.find((i) => i.kind === 'pillow')!;
    Object.assign(pad, { x: -11, y: 0.12, z: -6 });
    w.items.push(pad);
  }
  advance(w, 1100);
  return w;
}
function ledge(w: GiantWorld) {
  Object.assign(w.players[0], {
    x: -2.6,
    y: 2.6,
    z: -5,
    support: 'bed',
    grounded: true,
  });
  Object.assign(w.players[1], {
    x: -3.6,
    y: 0,
    z: -5,
    support: 'floor',
    grounded: true,
  });
}

void test('higher landings are louder and bulky metal loot adds a substantial penalty', () => {
  const low = fall(1),
    high = fall(3),
    loaded = fall(3, 'cup');
  assert.ok(high.wakefulness > low.wakefulness * 3);
  assert.ok(loaded.wakefulness > high.wakefulness * 1.8);
  assert.ok(
    loaded.events.some(
      (e) => e.kind === 'noise' && e.text.includes('Pass it down'),
    ),
  );
  assert.equal(heldItem(loaded, 'a')?.kind, 'cup');
});

void test('crouching reduces loaded impacts and a pillow prevents a dazed fall', () => {
  const hard = fall(6, 'crown'),
    crouch = fall(6, 'crown', true),
    soft = fall(6, 'crown', false, true);
  assert.ok(crouch.wakefulness < hard.wakefulness);
  assert.ok(
    crouch.wakefulness > 20,
    'crouching must not erase a loaded high fall',
  );
  assert.ok(soft.wakefulness < hard.wakefulness / 4);
  assert.ok(hard.players[0].downUntil > hard.clock);
  assert.equal(soft.players[0].downUntil, 0);
  assert.equal(heldItem(soft, 'a')?.kind, 'crown');
});

void test('placed objects are quiet; an object dropped over a ledge crashes harder with height', () => {
  const dropFrom = (height: number) => {
    const w = world();
    Object.assign(w.players[0], { x: -11, y: height, z: -6, angle: 0 });
    giantAction(w, 'a', { type: 'drop' }, 'a');
    advance(w, 1000);
    return w;
  };
  const placed = dropFrom(0),
    low = dropFrom(0.7),
    high = dropFrom(5);
  assert.equal(placed.wakefulness, 0);
  assert.ok(low.wakefulness > 3);
  assert.ok(high.wakefulness > low.wakefulness * 4);
  assert.equal(high.items[0].support, 'floor');
});

void test('dropping in midair preserves the fall momentum through serialized state', () => {
  let w = world();
  Object.assign(w.players[0], {
    x: -11,
    y: 1,
    z: -6,
    grounded: false,
    support: null,
    velocity: { x: 1, y: -13, z: 0 },
  });
  giantAction(w, 'a', { type: 'drop' }, 'a');
  assert.equal(w.items[0].velocity.y, -13);
  w = JSON.parse(JSON.stringify(w));
  advance(w, 300);
  assert.ok(
    w.events.some(
      (e) => e.kind === 'noise' && e.text.includes('CRASH') && e.strength > 40,
    ),
    JSON.stringify(w.events),
  );
  assert.ok(
    w.events.every((e) => Number.isSafeInteger(e.id)),
    'noise events must retain their own serial IDs',
  );
  assert.equal(new Set(w.events.map((e) => e.id)).size, w.events.length);
});

void test('a tall metal drop crosses the wake threshold, warns, then makes the giant stand', () => {
  const w = world();
  w.wakefulness = 35;
  Object.assign(w.items[0], { x: -11, y: 6, z: -6, heldBy: null });
  advance(w, 900);
  assert.equal(w.pending?.kind, 'wake');
  assert.equal(w.phase, 'playing');
  advance(w, 8200);
  assert.equal(w.phase, 'escape');
  assert.equal(wakePose(w).stand, 1);
});

void test('a quiet handoff reaches a teammate one bed-height below without falling or making noise', () => {
  let w = world();
  ledge(w);
  assert.equal(handoffTarget(w, w.players[0])?.id, 'b');
  assert.match(giantHint(w, 'a'), /Pass quietly to Bo below/);
  giantAction(w, 'a', { type: 'interact' }, 'a');
  w = JSON.parse(JSON.stringify(w));
  advance(w, 500);
  assert.equal(heldItem(w, 'a'), undefined);
  assert.equal(heldItem(w, 'b')?.kind, 'cup');
  assert.equal(w.items[0].support, null);
  assert.equal(w.wakefulness, 0);
  assert.ok(w.events.some((e) => e.text.includes('quietly passed')));
  // The teammate can carry it away; the giver can descend empty-handed.
  removeGiantPlayer(w, 'b');
  assert.equal(w.items[0].heldBy, null);
});

void test('passing before descending is quieter than jumping down holding the same cup', () => {
  const direct = fall(2.6, 'cup'),
    passed = world();
  ledge(passed);
  giantAction(passed, 'a', { type: 'pass' }, 'a');
  Object.assign(passed.players[0], {
    x: -11,
    z: -6,
    grounded: false,
    support: null,
  });
  advance(passed, 1100);
  assert.ok(direct.wakefulness > passed.wakefulness * 1.8);
});

void test('handoffs reject airborne, dazed, occupied, departed, distant and unreachable receivers', () => {
  const cases = [
    (w: GiantWorld) => (w.players[1].grounded = false),
    (w: GiantWorld) => (w.players[1].downUntil = NOW + 1000),
    (w: GiantWorld) => (w.players[1].escaped = true),
    (w: GiantWorld) => (w.players[1].caught = true),
    (w: GiantWorld) => (w.players[1].seen = NOW - 1300),
    (w: GiantWorld) => (w.players[1].x -= 2),
    (w: GiantWorld) => (w.players[1].y -= 1),
    (w: GiantWorld) => (w.players[0].grounded = false),
    (w: GiantWorld) => {
      const other = freshGiant(NOW).items[0];
      other.heldBy = 'b';
      w.items.push(other);
    },
    // Within reach but the mattress lies between their hands.
    (w: GiantWorld) => {
      w.players[0].x = -1.2;
      w.players[1].x = -3;
    },
  ];
  for (const mutate of cases) {
    const w = world();
    ledge(w);
    mutate(w);
    assert.equal(handoffTarget(w, w.players[0]), undefined);
    assert.throws(
      () => giantAction(w, 'a', { type: 'pass' }, 'a'),
      /steady footing/,
    );
    assert.equal(w.items[0].heldBy, 'a');
  }
});

void test('the peer host accepts handoffs and preserves replay protection across a recovery checkpoint', () => {
  const engine = createPeerEngine('dont-wake-the-giant', NOW);
  engine.world = world();
  ledge(engine.world as GiantWorld);
  assert.deepEqual(
    engine.execute('a', 'quiet-pass', { type: 'pass' }, 'a'),
    {},
  );
  const recovered = createPeerEngine(
    'dont-wake-the-giant',
    NOW,
    engine.checkpoint(),
  );
  assert.deepEqual(
    recovered.execute('a', 'quiet-pass', { type: 'pass' }, 'b'),
    {},
  );
  const w = recovered.world as GiantWorld;
  assert.equal(heldItem(w, 'b')?.kind, 'cup');
  assert.equal(w.wakefulness, 0);
  assert.equal(
    w.events.filter((e) => e.text.includes('quietly passed')).length,
    1,
  );
});

void test('a chain of handoffs follows the real book ledges and preserves item ownership', () => {
  const w = world('crown');
  w.players.push(giantPlayer('c', 'Cy', 2, NOW));
  for (const [i, support, x, z] of [
    [0, 'book-two', -6.2, 4.8],
    [1, 'book-one', -7, 4.9],
    [2, 'floor', -8, 4.2],
  ] as const) {
    const surface = platforms(w).find((p) => p.id === support)!;
    Object.assign(w.players[i], {
      x,
      y: surface.y,
      z,
      support,
      grounded: true,
    });
  }
  giantAction(w, 'a', { type: 'pass' }, 'a');
  // Prefer the next teammate below over passing straight back to the upper giver.
  giantAction(w, 'b', { type: 'pass' }, 'a');
  assert.equal(heldItem(w, 'c')?.kind, 'crown');
  assert.equal(w.items.length, 1);
  assert.equal(w.wakefulness, 0);
});
