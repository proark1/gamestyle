import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestWakeLock, releaseWakeLock } from './wake-lock';

void test('wake lock requests are deduplicated and late grants are released after leaving a game', async () => {
  const names = ['window', 'navigator'] as const;
  const saved = names.map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
  );
  type Sentinel = {
    released: boolean;
    release: () => Promise<void>;
    addEventListener: (type: 'release', listener: () => void) => void;
  };
  const grants: ((sentinel: Sentinel) => void)[] = [];
  let acquired = 0;
  const sentinel = () => {
    const value: Sentinel = {
      released: false,
      release: () => {
        value.released = true;
        return Promise.resolve();
      },
      addEventListener: () => {},
    };
    return value;
  };
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {},
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        wakeLock: {
          request: () => {
            acquired++;
            return new Promise<Sentinel>((resolve) => grants.push(resolve));
          },
        },
      },
    });

    const first = requestWakeLock();
    const duplicate = requestWakeLock();
    assert.equal(acquired, 1);
    await releaseWakeLock();

    const reopened = requestWakeLock();
    assert.equal(acquired, 2);
    const current = sentinel();
    grants[1](current);
    assert.equal(await reopened, true);

    const stale = sentinel();
    grants[0](stale);
    assert.deepEqual(await Promise.all([first, duplicate]), [false, false]);
    assert.equal(stale.released, true);
    assert.equal(current.released, false);
    assert.equal(await requestWakeLock(), true);
    assert.equal(acquired, 2);
    await releaseWakeLock();
    assert.equal(current.released, true);
  } finally {
    await releaseWakeLock();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
