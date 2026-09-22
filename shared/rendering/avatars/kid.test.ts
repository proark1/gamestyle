import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { ITEMS } from '../../wardrobe/catalog';
import { LOOK_GROUP } from '../cosmetics/dress';
import { ITEM_MODELS } from '../cosmetics/items';
import { KIT, SEAT_KITS, TEAM, WARDROBE_COLOURS, seatKit } from '../palette';
import { HEAD_Y, HIP, SKULL, TROUSER_HEM } from './hoop-kid';
import { PLAYER_KID, liveKid, playerKid, type KidId } from './kid';

/** Players are Nico; Lola is dressed the same way, ready to be played later. */
const KIDS: KidId[] = ['lola', 'nico'];

function bounds(objects: T.Object3D[]) {
  const box = new T.Box3();
  for (const object of objects) box.union(new T.Box3().setFromObject(object));
  return box;
}

function lookGroups(root: T.Object3D) {
  const groups: T.Object3D[] = [];
  root.traverse((object) => {
    if (object.name === LOOK_GROUP) groups.push(object);
  });
  return groups;
}

function meshes(root: T.Object3D) {
  const found: T.Mesh[] = [];
  root.traverse((object) => {
    if ((object as T.Mesh).isMesh) found.push(object as T.Mesh);
  });
  return found;
}

const hex = (mesh: T.Mesh) =>
  `#${(mesh.material as T.MeshStandardMaterial).color.getHexString()}`;

/** The top of the bare skull, in the kid's own space. */
const SCALP = HEAD_Y + SKULL.centre[1] + SKULL.radii[1];

void test('every kid wears every wardrobe item where it belongs', () => {
  for (const character of KIDS)
    for (const item of ITEMS) {
      const name = `${character} in the ${item.id}`;
      const { model, worn } = playerKid(
        character,
        { jersey: KIT.red },
        { [item.slot]: item.id },
      );
      model.updateMatrixWorld(true);
      assert.equal(worn[item.slot], true, `${name} fills the ${item.slot}`);
      const groups = lookGroups(model);
      assert.ok(
        groups.some((group) => meshes(group).length > 0),
        `${name} shows it`,
      );
      const box = bounds(groups);
      assert.ok(
        box.min.x > -0.8 &&
          box.max.x < 0.8 &&
          box.min.z > -0.8 &&
          box.max.z < 0.9,
        `${name} stays close to the body`,
      );
      // Roller skates sink a little into the floor, as on the worker.
      assert.ok(box.min.y > -0.05 && box.max.y < 2.3, `${name} stays upright`);
      if (item.slot === 'hat')
        assert.ok(
          box.min.y < SCALP + (character === 'nico' ? 0.08 : 0) &&
            box.max.y > SCALP,
          `${name} sits over the head`,
        );
      if (item.slot === 'face' || item.slot === 'beard')
        assert.ok(
          box.min.y > 0.7 && box.max.z > 0.25,
          `${name} is on the front of the head`,
        );
      if (item.slot === 'top')
        assert.ok(box.min.y < 0.9 && box.max.y > 0.6, `${name} is on the body`);
      if (item.slot === 'legs')
        assert.ok(box.min.y < 0.35, `${name} reaches down the legs`);
      // Rain boots add only a band round the ankle; the rest is the colour.
      if (item.slot === 'shoes')
        assert.ok(
          box.min.y < 0.25 && box.max.y < 0.5,
          `${name} is on the feet`,
        );
    }
});

void test('every hat leaves Nico’s front curls visible, including the party cone', () => {
  const shades = new Set(['#3f261b', '#4d2f21', '#5b3928']);
  for (const item of ITEMS.filter((item) => item.slot === 'hat')) {
    const { model } = playerKid('nico', { jersey: KIT.red }, { hat: item.id });
    model.updateMatrixWorld(true);
    let visible = 0;
    // Cast from the viewer towards the forehead. A curl counts only if it is
    // the first surface hit, so hair hidden inside the skull/hat cannot pass.
    for (const x of [-0.18, -0.12, -0.06, 0, 0.06, 0.12, 0.18]) {
      for (const y of [0.45, 0.48, 0.51]) {
        const ray = new T.Raycaster(
          new T.Vector3(x, HEAD_Y + y, 2),
          new T.Vector3(0, 0, -1),
        );
        const hit = ray.intersectObject(model, true)[0];
        if (hit && shades.has(hex(hit.object as T.Mesh))) visible++;
      }
    }
    assert.ok(
      visible >= 6,
      `${item.id} preserves a visible fringe (${visible}/21 samples)`,
    );
  }
});

void test('a legs item gives the kid long trousers in its colour', () => {
  for (const character of KIDS) {
    const trousers = ITEM_MODELS['denim-overalls'].overalls!;
    const { model } = playerKid(
      character,
      { jersey: KIT.blue },
      { legs: 'denim-overalls' },
    );
    model.updateMatrixWorld(true);
    const leg = meshes(model.userData.legL as T.Object3D).filter(
      (mesh) => hex(mesh) === trousers,
    );
    assert.ok(leg.length > 0, `${character} wears the trousers`);
    assert.ok(
      bounds(leg).min.y < HIP[1] + TROUSER_HEM + 0.01,
      `${character}'s trousers reach the high-tops`,
    );
  }
});

void test('a hat covers the crown of each kid, and the kit stays the jersey', () => {
  const hair = new Set(['#55311f', '#673d28', '#3f261b', '#4d2f21', '#5b3928']);
  for (const character of KIDS) {
    const { model } = playerKid(
      character,
      { jersey: KIT.green },
      { hat: 'bobble-beanie' },
    );
    model.updateMatrixWorld(true);
    const head = model.userData.head as T.Object3D;
    const hairTop = bounds(
      meshes(head).filter(
        (mesh) =>
          hair.has(hex(mesh)) && !lookGroups(head).includes(mesh.parent!),
      ),
    ).max.y;
    const hatTop = bounds(lookGroups(head)).max.y;
    assert.ok(hairTop < hatTop, `${character}'s hair stays under the hat`);
    assert.ok(
      meshes(model.userData.body as T.Object3D).some(
        (mesh) => hex(mesh) === KIT.green,
      ),
      `${character} wears the green kit`,
    );
  }
});

void test('a kid draws in few meshes, even fully dressed', () => {
  for (const character of KIDS) {
    const bare = playerKid(character, { jersey: KIT.red }).model;
    assert.ok(meshes(bare).length <= 40, `${character} bare`);
    const dressed = playerKid(
      character,
      { jersey: KIT.red },
      {
        hat: 'top-hat',
        top: 'bow-tie',
        legs: 'plaid-trousers',
        shoes: 'golden-kicks',
        face: 'round-glasses',
        beard: 'big-moustache',
      },
    ).model;
    assert.ok(meshes(dressed).length <= 60, `${character} dressed`);
  }
});

void test('liveKid blinks and swings hair but leaves the limbs to the game', () => {
  const model = playerKid('lola', { jersey: KIT.yellow }).model;
  const rig = model.userData as Record<string, T.Object3D>;
  rig.armL.rotation.x = -1.2;
  rig.legR.rotation.x = 0.4;
  liveKid(model, 3.2, true);
  assert.equal(rig.armL.rotation.x, -1.2);
  assert.equal(rig.legR.rotation.x, 0.4);
  const eyes = rig.eyes as unknown as T.Object3D[];
  assert.ok(
    eyes.every((eye) => eye.scale.y < 1),
    'blinks',
  );
  const [pigtail] = rig.swinging as unknown as T.Object3D[];
  assert.notEqual(pigtail.rotation.z, 0, 'the pigtails swing');
});

void test('four seats wear four kits, and teams keep red and blue', () => {
  assert.equal(new Set(SEAT_KITS).size, 4);
  assert.equal(KIT.red, TEAM.red);
  assert.equal(KIT.blue, TEAM.blue);
  assert.deepEqual([0, 1, 2, 3].map(seatKit), [...SEAT_KITS]);
  assert.equal(seatKit(4), seatKit(0));
  for (const colour of SEAT_KITS) assert.ok(WARDROBE_COLOURS.includes(colour));
});

void test('every player is the boy, and each kid says which it is', () => {
  assert.equal(PLAYER_KID, 'nico');
  for (const kid of KIDS)
    assert.equal(playerKid(kid, { jersey: KIT.red }).model.userData.kid, kid);
});
