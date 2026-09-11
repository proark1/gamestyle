import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { placeAvatar } from './stage';

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} is not ${expected}`);

void test('a placed avatar rests on the floor, keeps its own turning point and ignores name tags', () => {
  const body = new T.Mesh(new T.BoxGeometry(0.6, 1.8, 0.4));
  body.position.set(0.5, 1.2, -0.2);
  const hat = new T.Mesh(new T.BoxGeometry(0.2, 0.2, 0.2));
  hat.position.set(0.5, 2.2, -0.2);
  hat.visible = false;
  const tag = new T.Sprite();
  tag.position.y = 3;
  let posed = -1;
  const placed = placeAvatar({
    key: 'test',
    label: 'Test',
    create: () => {
      const root = new T.Group();
      root.add(body, hat, tag);
      return {
        root,
        pose: (time) => {
          posed = time;
        },
      };
    },
  });
  assert.equal(posed, 0, 'measured in its first idle pose');
  assert.equal(tag.visible, false, 'name tags are hidden');
  assert.equal(placed.measure.meshes, 1, 'hidden meshes are not counted');
  close(placed.measure.height, 1.8);
  close(placed.measure.width, 0.6);

  placed.holder.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(body);
  close(bounds.min.y, 0);
  close((bounds.min.x + bounds.max.x) / 2, 0.5);
  close((bounds.min.z + bounds.max.z) / 2, -0.2);
});

void test('an avatar with nothing visible measures as empty instead of infinite', () => {
  const placed = placeAvatar({
    key: 'empty',
    label: 'Empty',
    create: () => ({ root: new T.Group() }),
  });
  assert.deepEqual(placed.measure, { height: 0, width: 0, meshes: 0 });
});
