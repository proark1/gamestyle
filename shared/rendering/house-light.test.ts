import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { addHouseLight, SKY } from './house-light';

const hex = (colour: T.Color) => `#${colour.getHexString()}`;

void test('the house light sets one sky for background and fog and adds a warm sun over a sage bounce', () => {
  const scene = new T.Scene();
  const { hemisphere, sun } = addHouseLight(scene, {
    sky: SKY.site,
    fog: { near: 40, far: 90 },
  });
  assert.equal(hex(scene.background as T.Color), SKY.site);
  const fog = scene.fog as T.Fog;
  assert.equal(hex(fog.color), SKY.site);
  assert.deepEqual([fog.near, fog.far], [40, 90]);
  assert.ok(
    scene.children.includes(hemisphere) && scene.children.includes(sun),
  );
  assert.equal(hex(hemisphere.color), '#fff2d4');
  assert.equal(hex(hemisphere.groundColor), '#7fa497');
  assert.equal(hex(sun.color), '#fff1d2');
  assert.ok(sun.castShadow, 'the sun casts shadows');
});

void test('a game can go without fog and defaults to the coast sky', () => {
  const scene = new T.Scene();
  addHouseLight(scene, { fog: false });
  assert.equal(scene.fog, null);
  assert.equal(hex(scene.background as T.Color), SKY.coast);
});
