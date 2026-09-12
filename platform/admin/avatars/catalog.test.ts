import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { worker } from '../../../shared/rendering/worker';
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
