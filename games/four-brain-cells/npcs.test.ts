import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addBrain,
  advanceBreakfast,
  breakfastAction,
  freshBreakfast,
  reconcileBreakfastNpcs,
} from './simulation';
import { cupPosition, handPosition, platePosition } from './geometry';
import { createEngine } from './peer';
import {
  BREWER,
  STOVE,
  ROUND_MS,
  idleInput,
  type BrainWorld,
  type Vec,
} from './types';
import { handlePeerRoom } from '../../shared/peer/coordinator';
import { sealCheckpoint } from '../../shared/peer/crypto';
import type { RoomStore, Row } from '../../shared/rooms/types';

const NOW = 100000;
function tick(w: BrainWorld, ms = 50) {
  for (let left = ms; left > 0; left -= 50)
    advanceBreakfast(w, w.clock + Math.min(50, left));
}
function setup(limb = 0) {
  const w = freshBreakfast(NOW);
  addBrain(w, 'human', 'You', 0);
  breakfastAction(w, 'human', { type: 'claim', limb }, 'human');
  breakfastAction(w, 'human', { type: 'fill-npcs' }, 'human');
  breakfastAction(w, 'human', { type: 'start' }, 'human');
  return w;
}
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const clamp = (n: number) => Math.max(-1, Math.min(1, n));

void test('local crew controls add exactly one NPC, fill remaining seats, remove NPCs and preserve a chosen human limb', () => {
  const w = freshBreakfast(NOW);
  addBrain(w, 'human', 'You', 0);
  breakfastAction(w, 'human', { type: 'claim', limb: 2 }, 'human');
  breakfastAction(w, 'human', { type: 'add-npc', slot: 2 }, 'human');
  assert.equal(w.players.length, 2);
  assert.equal(w.players.find((p) => p.bot)?.color, 2);
  assert.equal(w.players[0].limb, 2);
  assert.throws(
    () => breakfastAction(w, 'human', { type: 'add-npc', slot: 0 }, 'human'),
    /empty/,
  );
  breakfastAction(w, 'human', { type: 'fill-npcs' }, 'human');
  assert.equal(w.players.length, 4);
  assert.equal(new Set(w.players.map((p) => p.limb)).size, 4);
  assert.equal(new Set(w.players.map((p) => p.color)).size, 4);
  const bot = w.players.find((p) => p.bot)!;
  assert.throws(
    () => breakfastAction(w, bot.id, { type: 'fill-npcs' }, 'human'),
    /host/,
  );
  breakfastAction(w, 'human', { type: 'remove-npc', target: bot.id }, 'human');
  assert.equal(w.players.length, 3);
  breakfastAction(w, 'human', { type: 'start' }, 'human');
  assert.throws(
    () => breakfastAction(w, 'human', { type: 'fill-npcs' }, 'human'),
    /Finish/,
  );
  w.phase = 'lost';
  breakfastAction(w, 'human', { type: 'fill-npcs' }, 'human');
  breakfastAction(w, 'human', { type: 'restart' }, 'human');
  assert.equal(w.players.filter((p) => p.bot).length, 3);
  assert.equal(w.players[0].limb, 2);
});

for (const limb of [0, 1])
  void test(`a human on hand ${limb} finishes breakfast with three NPCs using normal reach, grab and use inputs`, () => {
    const w = setup(limb),
      p = w.players.find((p) => !p.bot)!;
    const u = w.utensils[limb];
    for (let i = 0; i < ROUND_MS / 50 && w.phase === 'playing'; i++) {
      p.input = idleInput();
      const done = limb === 0 ? w.pancakes === 3 : w.coffee >= 0.98;
      if (!done) {
        const h = handPosition(w, limb);
        const target =
          u.held === null
            ? u
            : limb === 0
              ? u.ready
                ? platePosition(w)
                : STOVE
              : u.fill < 0.01
                ? BREWER
                : { ...cupPosition(w), y: 2.25 };
        p.input = {
          ...idleInput(),
          x: clamp((target.x - h.x) * 3),
          z: clamp((target.z - h.z) * 3),
          lift: clamp((target.y - h.y) * 3),
          steady: true,
        };
        if (u.held === null && dist(h, u) < 0.9)
          breakfastAction(w, p.id, { type: 'grab' }, p.id);
        else if (u.held === limb && dist(h, target) < 0.6) p.input.use = true;
      }
      tick(w);
    }
    assert.equal(
      w.phase,
      'won',
      JSON.stringify({
        robot: w.robot,
        utensils: w.utensils,
        pancakes: w.pancakes,
        coffee: w.coffee,
      }),
    );
    assert.ok(w.clock - w.started < ROUND_MS);
    assert.equal(w.falls, 0);
    assert.ok(
      w.players.filter((p) => p.bot && p.limb > 1).every((p) => p.steps > 0),
    );
  });

for (const limb of [2, 3])
  void test(`a human on foot ${limb} drives breakfast while NPC hands cook and the partner foot follows`, () => {
    const w = setup(limb),
      p = w.players.find((p) => !p.bot)!;
    for (let i = 0; i < ROUND_MS / 50 && w.phase === 'playing'; i++) {
      const pan = w.utensils[0],
        jug = w.utensils[1];
      const target =
        w.pancakes < 3
          ? pan.ready
            ? { x: w.table.x - 2.25, z: w.table.z }
            : { x: -3.5, z: -2.6 }
          : jug.held === null || jug.fill < 0.01
            ? { x: -3.5, z: 1.2 }
            : { x: w.table.x - 1.65, z: w.table.z + 1.55 };
      const dx = target.x - w.robot.x,
        dz = target.z - w.robot.z,
        d = Math.hypot(dx, dz);
      p.input = {
        ...idleInput(),
        x: d > 0.2 ? dx / Math.max(1, d) : 0,
        z: d > 0.2 ? dz / Math.max(1, d) : 0,
        steady: true,
      };
      tick(w);
    }
    assert.equal(
      w.phase,
      'won',
      JSON.stringify({
        robot: w.robot,
        utensils: w.utensils,
        pancakes: w.pancakes,
        coffee: w.coffee,
      }),
    );
    assert.equal(w.falls, 0);
    assert.equal(
      w.players.find((p) => p.bot && p.limb < 2 && p.served > 0)?.served,
      3,
    );
  });

void test('one NPC foot obeys the human foot, never changes human input, and stops with its teammate', () => {
  const w = freshBreakfast(NOW);
  addBrain(w, 'human', 'You', 2);
  breakfastAction(w, 'human', { type: 'add-npc', slot: 3 }, 'human');
  breakfastAction(w, 'human', { type: 'start' }, 'human');
  const p = w.players.find((p) => !p.bot)!;
  p.input = { ...idleInput(), x: 1, z: 0.3, steady: true, seq: 8 };
  const input = structuredClone(p.input);
  tick(w, 1500);
  assert.deepEqual(p.input, input);
  assert.equal(w.players[1].input.x, 1);
  assert.ok(w.robot.x > -2.6);
  p.input = idleInput();
  tick(w);
  assert.deepEqual(w.players[1].input, idleInput());
});

void test('NPC roster recovery frees departed human limbs, rejects impersonation and preserves grips and cooked food', () => {
  const members = [0, 1, 2, 3].map((color) => ({
    id: `p${color}`,
    name: `Player ${color}`,
    color,
    order: color,
    instance: `tab${color}`,
    seen: NOW,
  }));
  const engine = createEngine(NOW);
  engine.reconcile(members);
  const slots = [1, 2, 3].map((color) => ({
    id: `npc-${color}`,
    name: `NPC ${color}`,
    color,
  }));
  engine.reconcile([members[0]], { revision: 2, slots });
  assert.equal(engine.world.players.length, 4);
  assert.deepEqual(
    engine.world.limbs.map((l) => l.owner),
    ['p0', 'npc-1', 'npc-2', 'npc-3'],
  );
  engine.execute('p0', 'start', { type: 'start' }, 'p0');
  const bot = engine.world.players.find((p) => p.bot && p.limb === 1)!;
  engine.input(bot.id, { x: 1, z: 1, use: true }, 999);
  assert.deepEqual(bot.input, idleInput());
  assert.ok(engine.execute(bot.id, 'forged', { type: 'grab' }, 'p0').error);
  assert.ok(
    engine.execute('p0', 'wrong-channel', { type: 'fill-npcs' }, 'p0').error,
  );
  Object.assign(engine.world.limbs[1], { held: 'pan' });
  Object.assign(engine.world.utensils[0], { held: 1, ready: true, fill: 1 });
  const restored = createEngine(NOW + 90000, engine.checkpoint());
  restored.reconcile([members[0]], { revision: 1, slots: [] });
  assert.equal(restored.world.players.filter((p) => p.bot).length, 3);
  assert.equal(restored.world.utensils[0].ready, true);
  assert.equal(restored.world.limbs[1].held, 'pan');
  assert.equal(restored.checkpoint().rosterRevision, 2);
  for (let i = 0; i < 20; i++) restored.advance(50);
  assert.ok(
    restored.world.players
      .filter((p) => p.bot && p.limb > 1)
      .some((p) => p.steps > 0),
  );
  // A removed NPC makes its actual limb available even after the human switched limbs.
  reconcileBreakfastNpcs(restored.world, slots.slice(1));
  restored.reconcile([members[0], members[1]], {
    revision: 3,
    slots: slots.slice(1),
  });
  assert.equal(new Set(restored.world.players.map((p) => p.limb)).size, 4);
});

class Memory implements RoomStore {
  rows = new Map<string, Row>();
  async get(code: string) {
    return this.rows.get(code) ?? null;
  }
  async insert(row: Row) {
    if (this.rows.has(row.code)) return false;
    this.rows.set(row.code, row);
    return true;
  }
  async compareAndSwap(row: Row, version: number) {
    if (this.rows.get(row.code)?.version !== version) return false;
    this.rows.set(row.code, row);
    return true;
  }
}
void test('network NPC seats enforce authority, capacity, replay, round locks and checkpoint roster revisions', async () => {
  const store = new Memory();
  const created = await handlePeerRoom(
    store,
    { game: 'four-brain-cells', op: 'create' },
    NOW,
  );
  const session = created.session!;
  const call = (op: string, extra: object = {}) =>
    handlePeerRoom(
      store,
      { ...session, instance: 'host-tab', epoch: 1, op, ...extra },
      NOW,
    );
  await call('hello');
  const guest = await handlePeerRoom(
    store,
    { game: 'four-brain-cells', op: 'join', code: session.code },
    NOW,
  );
  await handlePeerRoom(
    store,
    { ...guest.session, instance: 'guest-tab', op: 'hello' },
    NOW,
  );
  await assert.rejects(
    handlePeerRoom(
      store,
      {
        ...guest.session,
        instance: 'guest-tab',
        epoch: 1,
        op: 'npc',
        requestId: 'forbidden',
        action: { type: 'fill-npcs' },
      },
      NOW,
    ),
    /leader/,
  );
  await assert.rejects(
    call('npc', {
      action: { type: 'add-npc', slot: 0 },
      requestId: 'occupied',
    }),
    /empty/,
  );
  const added = await call('npc', {
    action: { type: 'add-npc', slot: 3 },
    requestId: 'add',
  });
  assert.equal(added.view.npcs!.slots[0].color, 3);
  const filled = await call('npc', {
    action: { type: 'fill-npcs' },
    requestId: 'fill',
  });
  assert.equal(filled.view.members.length + filled.view.npcs!.slots.length, 4);
  const replay = await call('npc', {
    action: { type: 'fill-npcs' },
    requestId: 'fill',
  });
  assert.deepEqual(replay.view.npcs, filled.view.npcs);
  await assert.rejects(
    handlePeerRoom(
      store,
      { game: 'four-brain-cells', op: 'join', code: session.code },
      NOW,
    ),
    /four players/,
  );
  const npc = filled.view.npcs!.slots[0];
  await assert.rejects(call('poll', { id: npc.id }), /expired|session/i);
  await call('npc', {
    action: { type: 'remove-npc', target: npc.id },
    requestId: 'remove',
  });
  await assert.rejects(
    call('npc', {
      action: { type: 'remove-npc', target: npc.id },
      requestId: 'stale',
    }),
    /already left/,
  );
  const results = await Promise.allSettled([
    call('npc', { action: { type: 'fill-npcs' }, requestId: 'refill' }),
    handlePeerRoom(
      store,
      { game: 'four-brain-cells', op: 'join', code: session.code },
      NOW,
    ),
  ]);
  assert.equal(results[0].status, 'fulfilled');
  const before = (await call('poll')).view;
  const occupants = [...before.members, ...before.npcs!.slots];
  assert.equal(occupants.length, 4);
  assert.equal(new Set(occupants.map((p) => p.color)).size, 4);
  const checkpoint = await sealCheckpoint(
    {},
    before.key!,
    `four-brain-cells:${session.code}`,
    1,
    50,
  );
  await call('lock');
  await assert.rejects(
    call('checkpoint', {
      checkpoint,
      open: true,
      rosterRevision: before.npcs!.revision,
    }),
    /crew changed/,
  );
  await assert.rejects(
    call('npc', { action: { type: 'fill-npcs' }, requestId: 'during' }),
    /Finish this breakfast/,
  );
  await call('leave');
  const successor = await handlePeerRoom(
    store,
    { ...guest.session, instance: 'guest-tab', op: 'poll' },
    NOW,
  );
  assert.equal(successor.view.host, guest.session!.id);
  assert.ok(successor.view.npcs!.slots.length > 0);
  assert.equal(
    successor.view.members.some((p) => p.id.startsWith('npc-')),
    false,
  );
});
