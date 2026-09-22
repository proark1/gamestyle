import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { GAME_IDS } from '../games/identity';
import {
  SnapshotReceiver,
  SnapshotSender,
  snapshotJson,
} from './snapshot-codec';
import type { EngineFactory } from './engine';

for (const game of GAME_IDS.filter((g) => existsSync(`games/${g}/peer.ts`))) {
  void test(`${game}: detached views, party startup, delta reconstruction and incompatible recovery`, async () => {
    const { createEngine } = (await import(`../../games/${game}/peer.ts`)) as {
      createEngine: EngineFactory;
    };
    const members = Array.from({ length: 4 }, (_, order) => ({
      id: `p${order}`,
      name: `Player ${order}`,
      color: order,
      order,
      instance: `tab${order}`,
      seen: 1000,
    }));
    const engine = createEngine(1000);
    engine.configureParty();
    engine.reconcile(members);
    const action = engine.execute(
      'p0',
      'start-party',
      {
        type: ['zorb-clash', 'sample-stampede'].includes(game)
          ? 'ready'
          : 'start',
      },
      'p0',
    );
    assert.equal(action.error, undefined);
    engine.world.partyRoundStarted = true;
    const original = engine.snapshot('ABCDEF', 'p0', 'p1', 1);
    const saved = structuredClone(original);
    const sender = new SnapshotSender(),
      receiver = new SnapshotReceiver();
    assert.deepEqual(
      receiver.decode(sender.encode(original, 0)),
      JSON.parse(snapshotJson(original)),
    );
    for (let frame = 1; frame <= 45; frame++) {
      engine.advance(50);
      const snapshot = engine.snapshot('ABCDEF', 'p0', 'p1', 1);
      assert.equal(snapshot.partyRoundStarted, true);
      assert.deepEqual(
        receiver.decode(sender.encode(snapshot, frame * 50)),
        JSON.parse(snapshotJson(snapshot)),
      );
    }
    assert.deepEqual(
      original,
      saved,
      'snapshots must not retain live mutable game state',
    );
    const checkpoint = engine.checkpoint();
    assert.throws(
      () => createEngine(2000, { ...checkpoint, schema: 999 }),
      /checkpoint/,
    );
    assert.throws(
      () => createEngine(2000, { ...checkpoint, rules: 999 }),
      /checkpoint/,
    );
    assert.equal(createEngine(2000, checkpoint).world.partyRoundStarted, true);
  });
}
