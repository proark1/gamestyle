import assert from 'node:assert/strict';
import test from 'node:test';
import { derivedSeed, nextRandom, shuffleSeeded } from './random';
void test('seeded random sequences and shuffles are reproducible', () => {
  let left = 421337,
    right = 421337;
  for (let index = 0; index < 32; index++) {
    const a = nextRandom(left),
      b = nextRandom(right);
    assert.deepEqual(a, b);
    left = a.state;
    right = b.state;
  }
  assert.deepEqual(
    shuffleSeeded(99, ['a', 'b', 'c', 'd']),
    shuffleSeeded(99, ['a', 'b', 'c', 'd']),
  );
  assert.notEqual(derivedSeed(10, 1, 2), derivedSeed(10, 2, 1));
});
