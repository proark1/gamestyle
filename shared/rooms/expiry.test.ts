import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_TTL_MS, resetRoomSweep, sweepExpiredRooms } from './expiry';
import type { Row, RoomStore } from './types';

function store(onPurge?: (before: number) => Promise<number>): RoomStore {
  return {
    async get() {
      return null as Row | null;
    },
    async insert() {
      return true;
    },
    async compareAndSwap() {
      return true;
    },
    ...(onPurge ? { purge: onPurge } : {}),
  };
}

void test('a sweep deletes only rooms past the time-to-live', async () => {
  resetRoomSweep();
  const seen: number[] = [];
  const now = 1_700_000_000_000;
  sweepExpiredRooms(
    store(async (before) => {
      seen.push(before);
      return 3;
    }),
    now,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(seen, [now - ROOM_TTL_MS]);
});

void test('sweeps are throttled so every request does not scan the table', async () => {
  resetRoomSweep();
  let calls = 0;
  const s = store(async () => (calls++, 0));
  const now = 1_700_000_000_000;
  for (let i = 0; i < 50; i++) sweepExpiredRooms(s, now + i * 1000);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1, 'one sweep covers the whole throttle window');
  sweepExpiredRooms(s, now + 11 * 60 * 1000);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2, 'the window reopens later');
});

void test('a store without purge is left alone', () => {
  resetRoomSweep();
  assert.doesNotThrow(() => sweepExpiredRooms(store(), Date.now()));
});

void test('a failing sweep never reaches the caller', async () => {
  resetRoomSweep();
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    sweepExpiredRooms(
      store(() => Promise.reject(new Error('database is locked'))),
      Date.now(),
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(errors.length, 1, 'the failure is logged, not thrown');
  } finally {
    console.error = original;
  }
});
