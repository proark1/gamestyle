import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { WORKER_HEAD_TOP, worker } from '../../../shared/rendering/worker';
import type { Look } from '../../../shared/wardrobe/look';
import { GAMES } from '../../analytics/catalog';
import { AVATAR_GAMES, DEFAULT_TEMPLATE, POTENTIAL_AVATARS } from './catalog';
import { placeAvatar } from './stage';

/** Name tags draw on canvases, which Node lacks: every drawing call is a no-op. */
function paperDocument() {
  const context = new Proxy({}, { get: () => () => undefined });
  return {
    createElement: () => ({ getContext: () => context }),
  } as unknown as Document;
}

function transforms(root: T.Object3D) {
  root.updateMatrixWorld(true);
  const values: number[] = [];
  root.traverse((object) => values.push(...object.matrixWorld.elements));
  return values;
}

/** The head, joints and limb parts a game on the shared worker must keep. */
function workerShape(model: T.Object3D) {
  const part = (mesh: T.Mesh) => {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    return [
      mesh.position.toArray(),
      mesh.geometry.boundingBox!.getSize(new T.Vector3()).toArray(),
    ];
  };
  const rig = model.userData as Record<string, T.Object3D>;
  return {
    head: part(rig.body.getObjectByName('worker-head') as T.Mesh),
    limbs: ['legL', 'legR', 'armL', 'armR'].map((key) => [
      rig[key].position.toArray(),
      rig[key].children
        .filter((child) => (child as T.Mesh).isMesh)
        .map((child) => part(child as T.Mesh)),
    ]),
  };
}

/** Meshes a game puts on top of the head itself, such as its own hat. */
function gameHeadParts(root: T.Object3D) {
  const body = root.userData.body as T.Object3D;
  return body.children.filter((child) => {
    const mesh = child as T.Mesh;
    if (!mesh.isMesh) return false;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bottom =
      mesh.position.y + mesh.geometry.boundingBox!.min.y * mesh.scale.y;
    return bottom >= WORKER_HEAD_TOP - 0.1;
  });
}

function wearsItems(root: T.Object3D) {
  let found = false;
  root.traverse((object) => {
    if (
      object.name === 'worker-look' &&
      object.children.some((child) => (child as T.Mesh).isMesh)
    )
      found = true;
  });
  return found;
}

void test('the avatar lineup covers every game in the admin catalog and three potential avatars', () => {
  assert.deepEqual(
    AVATAR_GAMES.map((game) => game.id),
    GAMES.map((game) => game.id),
  );
  assert.deepEqual(
    POTENTIAL_AVATARS.map((card) => card.tag),
    ['Funny', 'Cute', 'Scary'],
  );
  const keys = [...POTENTIAL_AVATARS, ...AVATAR_GAMES].flatMap((card) =>
    card.looks.map((look) => `${card.id}:${look.key}`),
  );
  assert.equal(new Set(keys).size, keys.length, 'every look has its own key');
  assert.ok(keys.includes(DEFAULT_TEMPLATE), 'the default template exists');
});

void test('every avatar builds at a believable size and moves when it walks', (t) => {
  const previous = globalThis.document;
  globalThis.document = paperDocument();
  t.after(() => {
    globalThis.document = previous;
  });
  for (const card of [...POTENTIAL_AVATARS, ...AVATAR_GAMES])
    for (const look of card.looks) {
      const name = `${card.name} (${look.label})`;
      const { preview, holder, measure } = placeAvatar(look);
      assert.ok(
        measure.height > 0.8 && measure.height < 4.5,
        `${name} is ${measure.height} tall`,
      );
      assert.ok(measure.meshes > 0, `${name} has visible meshes`);
      preview.pose?.(0.2, false);
      const standing = transforms(holder);
      preview.pose?.(0.2, true);
      assert.notDeepEqual(transforms(holder), standing, `${name} walks`);
    }
});

void test('the games on the shared worker build its exact body and change only clothes and hats', () => {
  const reference = workerShape(worker(0));
  const shared = [
    ['stack-or-sink', 'stacker'],
    ['load-bearing', 'wrecker'],
    ['uphill-delivery', 'mover'],
    ['dont-wake-the-giant', 'thief'],
    ['chaos', 'worker'],
    ['wrong-floor', 'guest'],
    ['one-more-button', 'contestant'],
    ['reel-problems', 'angler'],
    ['act-natural', 'farmer'],
    ['shelf-control', 'mannequin'],
  ];
  for (const [id, key] of shared) {
    const look = AVATAR_GAMES.find((card) => card.id === id)?.looks.find(
      (item) => item.key === key,
    );
    assert.ok(look, `${id} shows its ${key}`);
    assert.deepEqual(
      workerShape(look.create().root),
      reference,
      `${id} builds the shared worker's body`,
    );
  }
});

void test('eight games dress the shared worker in wardrobe items over their own clothes', () => {
  const dressable = AVATAR_GAMES.flatMap((card) =>
    card.looks
      .filter((look) => look.dressable)
      .map((look) => ({ key: `${card.id}:${look.key}`, look })),
  );
  assert.deepEqual(dressable.map(({ key }) => key).sort(), [
    'chaos:worker',
    'dont-wake-the-giant:thief',
    'load-bearing:wrecker',
    'one-more-button:contestant',
    'reel-problems:angler',
    'stack-or-sink:stacker',
    'uphill-delivery:mover',
    'wrong-floor:guest',
  ]);
  const reference = workerShape(worker(0));
  const everything: Look = {
    hat: 'top-hat',
    top: 'striped-tee',
    legs: 'denim-overalls',
    shoes: 'rain-boots',
    face: 'round-glasses',
  };
  for (const { key, look } of dressable) {
    const dressed = look.create(everything).root;
    assert.deepEqual(
      workerShape(dressed),
      reference,
      `${key} keeps the shared body under a full look`,
    );
    assert.ok(wearsItems(dressed), `${key} shows the items`);
    // Uphill Delivery merges its torso, any hat included, so there is nothing
    // separate to find. It dresses through dressedWorker, whose own test checks
    // that a hat takes the cap off.
    if (key === 'uphill-delivery:mover') continue;
    assert.equal(
      gameHeadParts(dressed).length,
      0,
      `${key} leaves its own hat off under a player's hat`,
    );
    assert.ok(
      gameHeadParts(look.create().root).length > 0,
      `${key} wears its own hat without a look`,
    );
  }
});
