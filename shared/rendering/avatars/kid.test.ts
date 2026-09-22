import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { ITEMS } from '../../wardrobe/catalog';
import { LOOK_GROUP } from '../cosmetics/dress';
import { ITEM_MODELS } from '../cosmetics/items';
import { KID_ITEMS } from '../cosmetics/kid-items';
import { dressKid } from '../cosmetics/fit-kid';
import { nico } from './nico';
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

void test('shoe soles have a rounded footprint and golden kicks replace overlapping surfaces', () => {
  const model = nico();
  const leg = model.userData.legL as T.Object3D;
  const sole = leg.getObjectByName('shoe-sole')!;
  model.updateMatrixWorld(true);
  const centre = sole.getWorldPosition(new T.Vector3());
  const ray = new T.Raycaster(
    centre.clone().add(new T.Vector3(0.08, 1, 0.14)),
    new T.Vector3(0, -1, 0),
  );
  assert.equal(
    ray.intersectObject(sole).length,
    0,
    'no rectangular toe corner',
  );
  ray.ray.origin.copy(centre).add(new T.Vector3(0, 1, 0.14));
  assert.ok(
    ray.intersectObject(sole).length > 0,
    'rounded toe still has a sole',
  );
  dressKid(model, KIT.red, { shoes: 'golden-kicks' });
  for (const limb of [
    model.userData.legL,
    model.userData.legR,
  ] as T.Object3D[]) {
    assert.equal(
      limb.getObjectByName('shoe-sole'),
      undefined,
      'old sole removed',
    );
    assert.equal(
      limb.getObjectByName('shoe-collar'),
      undefined,
      'old collar removed',
    );
  }
});

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
          box.min.y > (item.slot === 'beard' ? 0.55 : 0.9) && box.max.z > 0.25,
          `${name} is on the front of the head`,
        );
      if (item.slot === 'top')
        assert.ok(box.min.y < 1.0 && box.max.y > 0.6, `${name} is on the body`);
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
      // The skipper's visor sits lower; sample its fringe below that visor.
      for (const y of item.id === 'skipper-cap'
        ? [0.42, 0.43, 0.44]
        : [0.45, 0.48, 0.51]) {
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

void test('the Viking shell covers hair above its rim from every direction', () => {
  const { model } = playerKid(
    'nico',
    { jersey: KIT.red },
    { hat: 'viking-helmet' },
  );
  model.updateMatrixWorld(true);
  const hair = new Set(['#3f261b', '#4d2f21', '#5b3928', '#2f1c14']);
  for (const y of [0.55, 0.58, 0.61, 0.64])
    for (let i = 0; i < 48; i++) {
      const angle = (i / 48) * Math.PI * 2;
      const direction = new T.Vector3(Math.sin(angle), 0, Math.cos(angle));
      const origin = direction
        .clone()
        .multiplyScalar(2)
        .setY(HEAD_Y + y);
      const hit = new T.Raycaster(origin, direction.negate()).intersectObject(
        model,
        true,
      )[0];
      assert.ok(
        hit && !hair.has(hex(hit.object as T.Mesh)),
        `shell covers hair at ${y}, angle ${i}`,
      );
    }
});

void test('the badge sash stays in front of the jersey on both sides', () => {
  const { model } = playerKid(
    'nico',
    { jersey: KIT.red },
    { top: 'badge-sash' },
  );
  model.updateMatrixWorld(true);
  for (const side of [-1, 1])
    for (const x of [-0.15, -0.1, 0, 0.1, 0.18]) {
      const y = HIP[1] + (0.88 - 0.54) * 0.64 - x;
      const hit = new T.Raycaster(
        new T.Vector3(x, y, side * 2),
        new T.Vector3(0, 0, -side),
      ).intersectObject(model, true)[0];
      assert.equal(
        hex(hit.object as T.Mesh),
        '#3f6fb5',
        `sash visible at ${x} on side ${side}`,
      );
    }
});

void test('the snorkel tube is visible beside and above the head', () => {
  const { model } = playerKid(
    'nico',
    { jersey: KIT.red },
    { face: 'snorkel-mask' },
  );
  model.updateMatrixWorld(true);
  for (const y of [0.4, 0.6, 0.72]) {
    const hit = new T.Raycaster(
      new T.Vector3(0.38, HEAD_Y + y, 2),
      new T.Vector3(0, 0, -1),
    ).intersectObject(model, true)[0];
    assert.ok(hit, `tube exists at ${y}`);
    assert.equal(hex(hit.object as T.Mesh), '#f2d14b');
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
void test('the kid’s own models are for items that exist, in the same slot', () => {
  for (const id of Object.keys(KID_ITEMS)) {
    const item = ITEMS.find((entry) => entry.id === id);
    assert.ok(item, `${id} is a real item`);
    assert.ok(ITEM_MODELS[id], `${id} still has a worker model for the shop`);
  }
  // The clothes a player sees most are worth modelling for him.
  for (const slot of ['top', 'legs', 'shoes'] as const)
    for (const item of ITEMS.filter((entry) => entry.slot === slot))
      assert.ok(KID_ITEMS[item.id], `${item.id} has a model made for the kid`);
});
