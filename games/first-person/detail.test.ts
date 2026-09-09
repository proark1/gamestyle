import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {
  makeBucket,
  makePickup,
  makeSandCrate,
  makeWorkerHand,
} from './detailed-props';
import { TRUCK } from './site-layout';
import type { Materials } from './world-view';
import type { HandGrip } from './worker-hand';

function materials() {
  const cache: Record<string, T.MeshStandardMaterial> = {};
  return new Proxy(cache, {
    get: (target, key: string) =>
      (target[key] ??= new T.MeshStandardMaterial()),
  }) as Materials;
}
function stats(group: T.Group) {
  let calls = 0,
    triangles = 0;
  group.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const geometry = o.geometry as T.BufferGeometry;
    calls++;
    triangles +=
      (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    for (const a of Object.values(geometry.attributes))
      for (const n of a.array)
        assert.ok(Number.isFinite(n), 'merged geometry must remain finite');
  });
  return { calls, triangles };
}
void test('detailed pickup remains inside its existing physical obstacle', () => {
  const b = new T.Box3().setFromObject(makePickup(materials()));
  assert.ok(b.min.x >= -TRUCK.w / 2 && b.max.x <= TRUCK.w / 2);
  assert.ok(b.min.z >= -TRUCK.d / 2 && b.max.z <= TRUCK.d / 2);
  assert.ok(b.min.y >= 0 && b.max.y <= TRUCK.h);
});
void test('empty, partial and full buckets expose the actual fill state below their rim', () => {
  const m = materials();
  const levels = (g: T.Group) => {
    const values: number[] = [];
    g.traverse((o) => {
      if (typeof o.userData.level === 'number') values.push(o.userData.level);
    });
    return values;
  };
  assert.deepEqual(levels(makeBucket(m, 'mortar', 0)), []);
  const half = levels(makeBucket(m, 'mortar', 0.5)),
    full = levels(makeBucket(m, 'mortar', 1));
  assert.equal(half.length, 1);
  assert.equal(full.length, 1);
  assert.ok(half[0] > 0.025 && half[0] < full[0] && full[0] < 0.266);
  assert.deepEqual(
    levels(makeBucket(m, 'mortar', 4)),
    full,
    'fill cannot protrude beyond the bucket',
  );
});
void test('high detail props fit the mobile geometry and draw-call budgets', () => {
  const m = materials();
  for (const [g, maxCalls, maxTriangles] of [
    [makePickup(m), 12, 35000],
    [makeWorkerHand(m), 5, 7000],
    [makeSandCrate(m), 6, 7000],
  ] as const) {
    const result = stats(g);
    assert.ok(result.calls <= maxCalls);
    assert.ok(result.triangles <= maxTriangles);
  }
});

void test('every hand pose has outward skin faces, including mirrored left hands', () => {
  const m = materials();
  for (const grip of ['handle', 'bucket', 'support'] as HandGrip[])
    for (const left of [false, true]) {
      const hand = makeWorkerHand(m, left, grip),
        result = stats(hand);
      assert.ok(result.calls <= 4 && result.triangles <= 6500);
      const skin = hand.children.find(
        (o) => o instanceof T.Mesh && o.material === m.skin,
      ) as T.Mesh<T.BufferGeometry>;
      const p = skin.geometry.getAttribute('position'),
        n = skin.geometry.getAttribute('normal');
      // Sample the broad back of the palm. Reversed winding makes it disappear through the wrist.
      let dorsalSamples = 0;
      for (let i = 0; i < p.count; i++)
        if (
          Math.abs(p.getX(i)) < 0.018 &&
          p.getZ(i) > 0.025 &&
          p.getZ(i) < 0.055 &&
          p.getY(i) > 0.012
        ) {
          assert.ok(n.getY(i) > 0.5, 'back of the hand must face outward');
          dorsalSamples++;
        }
      assert.ok(dorsalSamples > 10);
    }
});
