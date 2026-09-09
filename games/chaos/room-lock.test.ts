import test from 'node:test';
import assert from 'node:assert/strict';
import { withRoomLock } from './room-lock';
void test('site writes are ordered; an unrelated site never waits for that site', async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const order: string[] = [];
  const first = withRoomLock('A', async () => {
    order.push('first');
    await held;
    order.push('finished');
  });
  const second = withRoomLock('A', async () => {
    order.push('second');
  });
  await withRoomLock('B', async () => {
    order.push('other');
  });
  assert.deepEqual(order, ['first', 'other']);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first', 'other', 'finished', 'second']);
});
void test('a rejected action releases its site for the next request', async () => {
  const failed = withRoomLock('A', async () => {
    throw new Error('invalid');
  });
  const next = withRoomLock('A', async () => 42);
  await assert.rejects(failed, /invalid/);
  assert.equal(await next, 42);
});
