import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Texture } from 'three';
import { KeyedModels } from './keyed-models';
import { disposeObject } from './dispose-object';

void test('repeated snapshots reuse meshes and removal releases owned GPU resources once', () => {
  const parent = new Group();
  let made = 0,
    geometries = 0,
    materials = 0,
    textures = 0;
  const models = new KeyedModels<{ id: string; x: number }, Mesh>(
    parent,
    () => {
      made++;
      const geometry = new BoxGeometry();
      const map = new Texture();
      const material = new MeshBasicMaterial({ map });
      geometry.addEventListener('dispose', () => geometries++);
      material.addEventListener('dispose', () => materials++);
      map.addEventListener('dispose', () => textures++);
      return new Mesh(geometry, material);
    },
  );
  for (let x = 0; x < 600; x++)
    models.sync([{ id: 'item', x }], (m, i) => {
      m.position.x = i.x;
    });
  assert.equal(made, 1);
  assert.equal(parent.children[0].position.x, 599);
  models.sync([], () => {});
  assert.deepEqual([geometries, materials, textures], [1, 1, 1]);
  assert.equal(parent.children.length, 0);
});

void test('subtree cleanup deduplicates owned resources and preserves shared assets', () => {
  const root = new Group();
  const geometry = new BoxGeometry(),
    material = new MeshBasicMaterial();
  let released = 0;
  geometry.userData.shared = true;
  geometry.addEventListener('dispose', () => {
    throw new Error('shared geometry released');
  });
  material.addEventListener('dispose', () => released++);
  root.add(new Mesh(geometry, material), new Mesh(geometry, material));
  disposeObject(root);
  assert.equal(released, 1);
});
