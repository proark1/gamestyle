import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPeerEngine } from '../../platform/peer/engine';
import type { Member } from './types';
import type { World } from '../../games/stack-or-sink/types';
import type { FarmSnapshot, FarmWorld } from '../../games/act-natural/types';
import type { DeliveryWorld } from '../../games/uphill-delivery/types';
import type { GiantWorld } from '../../games/dont-wake-the-giant/types';
const members: Member[] = ['a', 'b', 'c', 'd'].map((id, i) => ({
  id,
  name: id,
  order: i,
  color: i,
  instance: `tab-${i}`,
  seen: 100000,
}));

for (const game of [
  'stack-or-sink',
  'act-natural',
  'uphill-delivery',
  'dont-wake-the-giant',
] as const) {
  void test(`${game}: peer checkpoint restores simulation time and progress, releases old inputs and deduplicates committed actions`, () => {
    const engine = createPeerEngine(game, 100000);
    engine.reconcile(members);
    assert.deepEqual(engine.execute('a', 'start', { type: 'start' }, 'a'), {});
    engine.input(
      'b',
      { x: 1, z: 0, jump: false, crouch: false, graze: false, seq: 1 },
      1,
    );
    for (let i = 0; i < 4; i++) engine.advance(50);
    if (game === 'stack-or-sink') (engine.world as World).bestHeight = 5;
    if (game === 'act-natural') (engine.world as FarmWorld).keysDelivered = 1;
    if (game === 'uphill-delivery')
      (engine.world as DeliveryWorld).bestHeight = 7;
    if (game === 'dont-wake-the-giant')
      (engine.world as GiantWorld).banked = 35;
    const checkpoint = engine.checkpoint();
    const replacement = createPeerEngine(game, 999999, checkpoint);
    assert.equal(
      replacement.world.clock,
      checkpoint.world.clock,
      'Recovery must not fast-forward game timers by the outage duration',
    );
    assert.equal(replacement.world.started, checkpoint.world.started);
    assert.equal(
      replacement.world.players[1].input.x,
      0,
      'Do not replay held controls after handover',
    );
    replacement.reconcile(members.slice(1));
    assert.deepEqual(
      replacement.world.players.map((p) => p.id),
      ['b', 'c', 'd'],
    );
    assert.deepEqual(
      replacement.execute('a', 'start', { type: 'start' }, 'b'),
      {},
    );
    assert.equal(
      replacement.world.started,
      checkpoint.world.started,
      'An acknowledged start action must not execute twice',
    );
    if (game === 'stack-or-sink')
      assert.equal((replacement.world as World).bestHeight, 5);
    if (game === 'act-natural') {
      assert.equal((replacement.world as FarmWorld).keysDelivered, 1);
      assert.equal((replacement.world as FarmWorld).farmerId, 'b');
      assert.equal(replacement.world.phase, 'playing');
    }
    if (game === 'uphill-delivery')
      assert.equal((replacement.world as DeliveryWorld).bestHeight, 7);
    if (game === 'dont-wake-the-giant')
      assert.equal((replacement.world as GiantWorld).banked, 35);
    replacement.advance(50);
    assert.equal(replacement.world.clock, checkpoint.world.clock + 50);
    assert.ok(
      replacement.snapshot('ABCDEF', 'b', 'c', 2).version >
        engine.snapshot('ABCDEF', 'a', 'c', 1).version,
    );
  });
  void test(`${game}: peer host rejects invalid inputs and unauthorized starts`, () => {
    const engine = createPeerEngine(game, 100000);
    engine.reconcile(members);
    assert.match(
      engine.execute('b', 'start', { type: 'start' }, 'a').error!,
      /host|captain|leader/,
    );
    assert.match(
      engine.execute('a', 'invalid', { type: 'invalid' }, 'a').error!,
      /Invalid/,
    );
    engine.input('b', { x: 1, z: 0, seq: 1 }, 10);
    engine.input('b', { x: 0, z: 0, seq: 2 }, 9);
    assert.equal(engine.world.players[1].input.x, 1);
    engine.input('b', { x: NaN, z: 0 }, 11);
    assert.equal(engine.world.players[1].input.x, 1);
    engine.input('missing', { x: 1, z: 0 }, 12);
    assert.equal(engine.world.players.length, 4);
    engine.reconcile(
      members.map((m) => (m.id === 'b' ? { ...m, instance: 'reloaded' } : m)),
    );
    engine.input('b', { x: 0, z: -1, seq: 0 }, 1);
    assert.equal(engine.world.players[1].input.z, -1);
  });
}
void test('Blend Business sends per-player views without checkpoint secrets or hidden cow ownership', () => {
  const engine = createPeerEngine('act-natural', 100000);
  engine.reconcile(members);
  engine.execute('a', 'start', { type: 'start' }, 'a');
  const farmer = engine.snapshot('ABCDEF', 'a', 'a', 1) as FarmSnapshot;
  const cow = engine.snapshot('ABCDEF', 'a', 'b', 1) as FarmSnapshot;
  assert.equal(farmer.you.cowId, null);
  assert.ok(cow.you.cowId);
  const json = JSON.stringify(farmer.world);
  for (const hidden of [
    'cowId',
    'farmerId',
    'seed',
    'aiSuspicion',
    'cowRoutines',
  ])
    assert.equal(json.includes(`"${hidden}"`), false, hidden);
  assert.ok(
    'farmerId' in engine.checkpoint().world,
    'Recovery still contains the authoritative hidden state',
  );
});
