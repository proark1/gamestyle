import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DurableBatch } from './durable-batch';
void test('coalesces saves but never acknowledges actions absent from an in-flight checkpoint', async () => {
  let state = 1;
  const captures: number[] = [],
    releases: (() => void)[] = [];
  const queue = new DurableBatch(async () => {
    captures.push(state);
    await new Promise<void>((resolve) => releases.push(resolve));
  });
  const first = queue.request(),
    same = queue.request();
  await Promise.resolve();
  state = 2;
  let secondAcked = false;
  const second = queue.request().then(() => {
    secondAcked = true;
  });
  assert.deepEqual(captures, [1]);
  releases.shift()!();
  await first;
  await same;
  assert.equal(secondAcked, false);
  assert.deepEqual(captures, [1, 2]);
  releases.shift()!();
  await second;
});

void test('failed persistence rejects its receipts and allows the next batch to retry', async () => {
  let attempts = 0;
  const queue = new DurableBatch(async () => {
    if (++attempts === 1) throw new Error('checkpoint unavailable');
  });
  await assert.rejects(queue.request(), /checkpoint unavailable/);
  await queue.request();
  assert.equal(attempts, 2);
});
