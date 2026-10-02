import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotSender, SnapshotReceiver } from './snapshot-codec';
const snapshot = (version: number) => ({
  code: 'ABCDEF',
  host: 'a',
  version,
  world: { players: [{ id: 'a', x: version }], map: 'static'.repeat(300) },
});
void test('independent deltas tolerate loss and reordering without corrupting baselines', () => {
  const send = new SnapshotSender(),
    receive = new SnapshotReceiver();
  const first = send.encode(snapshot(1), 0);
  const second = send.encode(snapshot(2), 50),
    third = send.encode(snapshot(3), 100);
  assert.equal(receive.decode(second), null);
  receive.decode(first);
  assert.deepEqual(receive.decode(third), snapshot(3));
  assert.deepEqual(receive.decode(second), snapshot(2));
  assert.ok(JSON.stringify(third).length < JSON.stringify(first).length / 4);
  assert.equal(send.encode(snapshot(4), 2100).type, 'baseline');
  receive.reset();
  assert.equal(receive.decode(third), null);
});
void test('rejects unsafe patch paths', () => {
  const receiver = new SnapshotReceiver();
  receiver.decode({ type: 'baseline', snapshot: snapshot(1) });
  assert.equal(
    receiver.decode({
      type: 'snapshot-delta',
      base: 1,
      version: 2,
      changes: [[['__proto__', 'polluted'], true]],
    }),
    null,
  );
});
