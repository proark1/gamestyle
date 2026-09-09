import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Mesh, MeshStandardMaterial, BoxGeometry, Group, Vector3 } from 'three';
import {
  createSightGeometry,
  updateSightGeometry,
  FarmFlashlight,
} from './flashlight';
import { farmerSees } from './visibility';

void test('moving flashlight reuses its GPU buffer and every boundary ray obeys server occlusion', () => {
  const geometry = createSightGeometry();
  const attribute = geometry.getAttribute('position');
  const buffer = attribute.array;
  const w = {
    mode: 'human' as const,
    practice: false,
    farmer: { x: -6, z: -1, angle: Math.PI },
  };
  for (let i = 0; i < 500; i++) {
    w.farmer.angle = Math.PI + Math.sin(i * 0.03) * 0.5;
    w.farmer.x = -6 + Math.sin(i * 0.01) * 0.5;
    updateSightGeometry(geometry, w);
    assert.equal(geometry.getAttribute('position'), attribute);
    assert.equal(attribute.array, buffer);
    for (let v = 1; v < geometry.drawRange.count; v += 3) {
      const point = { x: attribute.getX(v), z: attribute.getZ(v) };
      // Float32 vertex rounding at a hay corner is within 0.1 mm.
      const toward = {
        x: point.x + (w.farmer.x - point.x) * 0.0001,
        z: point.z + (w.farmer.z - point.z) * 0.0001,
      };
      assert.ok(
        farmerSees(w, toward),
        JSON.stringify({ i, point, farmer: w.farmer }),
      );
    }
  }
  assert.ok(!farmerSees(w, { x: -6, z: -6 }));
  geometry.dispose();
});

void test('all lit materials share one moving light without replacing material programs per frame', () => {
  const group = new Group();
  const material = new MeshStandardMaterial();
  group.add(new Mesh(new BoxGeometry(), material));
  const light = new FarmFlashlight();
  light.bind(group);
  const key = material.customProgramCacheKey();
  const version = material.version;
  for (let i = 0; i < 500; i++)
    light.update({ x: i * 0.01, z: 2, angle: i * 0.01 }, true);
  assert.equal(material.customProgramCacheKey(), key);
  assert.equal(material.version, version);
  assert.ok(light.position.value instanceof Vector3);
  assert.equal(light.night.value, 1);
  light.update({ x: 0, z: 0, angle: 0 }, false);
  assert.equal(light.night.value, 0);
  material.dispose();
});
