import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioBufferCache } from './buffer-cache';
void test('decoded-byte budget evicts least recently used audio and oversized music', async () => {
  const cache = new AudioBufferCache<{
    length: number;
    numberOfChannels: number;
  }>(32, 5);
  cache.set('a', Promise.resolve({ length: 4, numberOfChannels: 1 }));
  cache.set('b', Promise.resolve({ length: 4, numberOfChannels: 1 }));
  await Promise.resolve();
  void cache.get('a');
  cache.set('c', Promise.resolve({ length: 4, numberOfChannels: 1 }));
  await Promise.resolve();
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.bytes, 32);
  cache.set('music', Promise.resolve({ length: 100, numberOfChannels: 2 }));
  await Promise.resolve();
  assert.ok(cache.bytes <= 32);
  assert.equal(cache.get('music'), undefined);
});
void test('late decodes cannot repopulate a cleared cache', async () => {
  let finish!: (v: { length: number; numberOfChannels: number }) => void;
  const cache = new AudioBufferCache<{
    length: number;
    numberOfChannels: number;
  }>();
  cache.set(
    'pending',
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  cache.clear();
  finish({ length: 100, numberOfChannels: 2 });
  await Promise.resolve();
  assert.equal(cache.size, 0);
});
