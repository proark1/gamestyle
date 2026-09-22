import { GAME_IDS } from '../shared/games/identity.ts';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import {
  SnapshotSender,
  SnapshotReceiver,
  snapshotJson,
} from '../shared/peer/snapshot-codec.ts';
import assert from 'node:assert/strict';
const members = Array.from({ length: 4 }, (_, order) => ({
  id: `player-${order}`,
  name: `Player ${order}`,
  color: order,
  order,
  instance: `browser-${order}`,
  seen: 1000,
}));
const results = [];
for (const game of GAME_IDS.filter((g) => existsSync(`games/${g}/peer.ts`))) {
  const { createEngine } = await import(`../games/${game}/peer.ts`);
  const engine = createEngine(1000);
  engine.reconcile(members);
  engine.execute(
    members[0].id,
    'start',
    {
      type: ['zorb-clash', 'sample-stampede'].includes(game)
        ? 'ready'
        : 'start',
    },
    members[0].id,
  );
  const senders = members.slice(1).map(() => new SnapshotSender()),
    receivers = senders.map(() => new SnapshotReceiver());
  let full = 0,
    encoded = 0,
    cpu = 0;
  for (let frame = 0; frame < 200; frame++) {
    for (const m of members)
      engine.input(
        m.id,
        { x: Math.sin(frame / 15), z: Math.cos(frame / 15) },
        frame,
      );
    engine.advance(50);
    for (let peer = 0; peer < 3; peer++) {
      const snap = engine.snapshot(
        'ABCDEF',
        members[0].id,
        members[peer + 1].id,
        1,
      );
      full += Buffer.byteLength(
        JSON.stringify({ type: 'snapshot', epoch: 1, snapshot: snap }),
      );
      const start = performance.now(),
        packet = senders[peer].encode(snap, frame * 50),
        wire = JSON.stringify({ ...packet, epoch: 1 });
      cpu += performance.now() - start;
      encoded += Buffer.byteLength(wire);
      assert.deepEqual(
        receivers[peer].decode(JSON.parse(wire)),
        JSON.parse(snapshotJson(snap)),
      );
    }
  }
  results.push({
    game,
    fullKBps: +(full / 10000).toFixed(1),
    encodedKBps: +(encoded / 10000).toFixed(1),
    savedPercent: Math.round((1 - encoded / full) * 100),
    codecMsPerHostTick: +(cpu / 200).toFixed(2),
  });
}
mkdirSync('.tmp/improvements', { recursive: true });
writeFileSync(
  '.tmp/improvements/bandwidth.json',
  JSON.stringify(results, null, 2),
);
console.table(results);
assert.ok(
  results.every((r) => r.encodedKBps <= r.fullKBps * 1.02),
  'encoding must stay within the full-state budget',
);
