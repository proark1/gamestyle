import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aimPreviewRevision,
  classifyPointerGesture,
} from './input-presentation';
import { freshWorld } from './simulation';

void test('pointer gestures only become shots near a playable ball', () => {
  const base = {
    pointer: { x: 120, y: 100 },
    ball: { x: 100, y: 100 },
    canShoot: true,
    pointerType: 'mouse',
    pointerCount: 1,
  };
  assert.equal(classifyPointerGesture(base), 'shot');
  assert.equal(
    classifyPointerGesture({ ...base, pointer: { x: 170, y: 100 } }),
    'orbit',
  );
  assert.equal(classifyPointerGesture({ ...base, canShoot: false }), 'orbit');
  assert.equal(classifyPointerGesture({ ...base, pointerCount: 2 }), 'orbit');
});

void test('touch receives a larger shot target than mouse', () => {
  const input = {
    pointer: { x: 156, y: 100 },
    ball: { x: 100, y: 100 },
    canShoot: true,
    pointerCount: 1,
  };
  assert.equal(
    classifyPointerGesture({ ...input, pointerType: 'mouse' }),
    'orbit',
  );
  assert.equal(
    classifyPointerGesture({ ...input, pointerType: 'touch' }),
    'shot',
  );
});

void test('aim preview revision changes after accepted shots and hole changes', () => {
  const world = freshWorld(0);
  const player = world.players[0];
  const initial = aimPreviewRevision(world, player.id);
  player.aim += 1;
  assert.equal(aimPreviewRevision(world, player.id), initial);
  player.holeStrokes++;
  assert.notEqual(aimPreviewRevision(world, player.id), initial);
  const afterShot = aimPreviewRevision(world, player.id);
  world.hole++;
  assert.notEqual(aimPreviewRevision(world, player.id), afterShot);
});
