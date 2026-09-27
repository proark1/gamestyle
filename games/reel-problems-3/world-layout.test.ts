import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOAT_DECK_HEIGHT,
  DOCK_HEIGHT,
  HARBOR_LAYOUT,
  NICO_EYE_HEIGHT,
  SHORE_HEIGHT,
  localSurfaceHeight,
} from './world-layout';

void test('the shared character defines one human-scale first-person height', () => {
  assert.equal(NICO_EYE_HEIGHT, 1.56);
  assert.equal(localSurfaceHeight('fishing', 0, 0), BOAT_DECK_HEIGHT);
  assert.equal(localSurfaceHeight('preparing', 6, 0), DOCK_HEIGHT);
  assert.equal(localSurfaceHeight('preparing', 9.4, 0), SHORE_HEIGHT);
});

void test('the harbor keeps the bell clear of the tower and the gangway open', () => {
  const bellToTower = Math.hypot(
    HARBOR_LAYOUT.bell.x - HARBOR_LAYOUT.tower.x,
    HARBOR_LAYOUT.bell.z - HARBOR_LAYOUT.tower.z,
  );
  assert.ok(
    bellToTower > HARBOR_LAYOUT.tower.radius + HARBOR_LAYOUT.bell.width / 2,
  );
  assert.ok(HARBOR_LAYOUT.gangway.x < HARBOR_LAYOUT.bell.x - 1);
});
