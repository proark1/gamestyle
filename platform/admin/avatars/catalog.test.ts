import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as T from 'three';
import { GAMES } from '../../analytics/catalog';
import { AVATAR_GAMES, DEFAULT_TEMPLATE } from './catalog';
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

void test('the avatar lineup covers every game in the admin catalog', () => {
  assert.deepEqual(
    AVATAR_GAMES.map((game) => game.id),
    GAMES.map((game) => game.id),
  );
  const keys = AVATAR_GAMES.flatMap((game) =>
    game.looks.map((look) => `${game.id}:${look.key}`),
  );
  assert.equal(new Set(keys).size, keys.length, 'every look has its own key');
  assert.ok(keys.includes(DEFAULT_TEMPLATE), 'the default template exists');
});

void test('every avatar builds from its game at a believable size and moves when it walks', (t) => {
  const previous = globalThis.document;
  globalThis.document = paperDocument();
  t.after(() => {
    globalThis.document = previous;
  });
  for (const game of AVATAR_GAMES)
    for (const look of game.looks) {
      const name = `${game.name} (${look.label})`;
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
