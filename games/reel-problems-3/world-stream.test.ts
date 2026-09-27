import assert from 'node:assert/strict';
import test from 'node:test';
import { cellAt, updateStream } from './world-stream';
import { freshWorld } from './simulation';

void test('streamed cells are deterministic and bounded around the boat', () => {
  assert.deepEqual(cellAt(44, 2, -3), cellAt(44, 2, -3));
  assert.notDeepEqual(cellAt(44, 2, -3), cellAt(44, 3, -2));
  const world = freshWorld(100);
  updateStream(world);
  assert.equal(world.cells.length, 9);
  world.boat.x = 100;
  updateStream(world);
  assert.equal(world.cells.length, 9);
  assert.ok(world.cells.some((cell) => cell.x === 2));
});
