import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { COLORS as BUILDER_COLOURS } from '../../../games/first-person/world-view';
import { WARDROBE_COLOURS } from '../../../shared/rendering/palette';
import { GAME_HEAD_TOP as WORKER_HEAD_TOP } from '../../../shared/rendering/game-avatar';
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

void test('the avatar lineup covers every game in the admin catalog and ten potential avatars', () => {
  assert.deepEqual(
    AVATAR_GAMES.map((game) => game.id),
    GAMES.map((game) => game.id),
  );
  assert.deepEqual(
    POTENTIAL_AVATARS.map((card) => card.tag),
    [
      'Funny',
      'Cute',
      'Scary',
      'Human',
      'Party',
      'Co-op',
      'Animals',
      'Girl',
      'Boy',
      'Cosy',
    ],
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

void test('every human game avatar is Nico; cows, robots and wooden mannequins stay exceptions', (t) => {
  const previous = globalThis.document;
  globalThis.document = paperDocument();
  t.after(() => {
    globalThis.document = previous;
  });
  const exceptions = new Set([
    'act-natural:cow',
    'four-brain-cells:robot',
    'shelf-control:mannequin',
  ]);
  for (const card of AVATAR_GAMES)
    for (const look of card.looks) {
      const key = card.id + ':' + look.key;
      const preview = look.create();
      const root = preview.root;
      let nico = false;
      root.traverse((o) => {
        if (o.userData.kid === 'nico') nico = true;
      });
      assert.equal(nico, !exceptions.has(key), key);
      preview.pose?.(0.4, true);
      preview.pose?.(0.8, false);
      assert.ok(
        transforms(root).every(Number.isFinite),
        key + ' has finite poses',
      );
    }
});

/**
 * Nico inside a preview, even when a game seats him in a vehicle.
 */
function findWorker(root: T.Object3D) {
  let found: T.Object3D | undefined;
  root.traverse((object) => {
    const rig = object.userData;
    if (!found && rig.kid === 'nico') found = object;
  });
  return found;
}

void test('every human avatar keeps its game kit colours', (t) => {
  const previous = globalThis.document;
  globalThis.document = paperDocument();
  t.after(() => {
    globalThis.document = previous;
  });
  // Mannequins are the worker carved in oak: wood is the point of that game.
  const exempt = new Set(['shelf-control:mannequin']);
  const allowed = new Set([
    ...WARDROBE_COLOURS.map((hex) => hex.toLowerCase()),
    ...BUILDER_COLOURS.map((hex) => '#' + hex.toString(16).padStart(6, '0')),
  ]);
  const offCloth: string[] = [];
  for (const card of AVATAR_GAMES)
    for (const look of card.looks) {
      const key = `${card.id}:${look.key}`;
      const model = findWorker(look.create().root);
      if (!model || exempt.has(key)) continue;
      const clothes = model.userData.kit as Record<string, string>;
      for (const [part, hex] of Object.entries(clothes))
        if (!allowed.has(hex)) offCloth.push(`${key} ${part} ${hex}`);
    }
  assert.deepEqual(offCloth, [], 'clothes outside the shared palette');
});

void test('games dress Nico in wardrobe items over their own clothes', () => {
  const dressable = AVATAR_GAMES.flatMap((card) =>
    card.looks
      .filter((look) => look.dressable)
      .map((look) => ({ key: `${card.id}:${look.key}`, look })),
  );
  assert.deepEqual(dressable.map(({ key }) => key).sort(), [
    'basketball:baller-blue',
    'basketball:baller-red',
    'bungee-doubles:tennis-duo',
    'cage-clash:fighter-blue',
    'cage-clash:fighter-red',
    'carry-on-carnage:traveler',
    'chain-of-fools:chain-worker',
    'chaos:worker',
    'crane-clash:crane-crew',
    'dont-wake-the-giant:thief',
    'drive-thru:cook',
    'drive-thru:driver',
    'load-bearing:wrecker',
    'on-the-ropes:boxer-blue',
    'on-the-ropes:boxer-red',
    'one-more-button:contestant',
    'panic-curling:curler',
    'reel-problems-2:angler',
    'reel-problems:angler',
    'sample-stampede:rider',
    'sample-stampede:shopper',
    'scaffold-scramble:scaffold-cleaner',
    'siege-and-desist:crew',
    'stack-or-sink:stacker',
    'uphill-delivery:mover',
    'wrong-floor:guest',
    'zorb-clash:zorb-blue',
    'zorb-clash:zorb-red',
  ]);

  const everything: Look = {
    hat: 'top-hat',
    top: 'striped-tee',
    legs: 'denim-overalls',
    shoes: 'rain-boots',
    face: 'round-glasses',
  };
  for (const { key, look } of dressable) {
    const dressed = look.create(everything).root;
    // Showing the player's items is the promise `dressable` makes, so it holds
    // for every avatar regardless of what the game builds around the worker.
    assert.ok(wearsItems(dressed), `${key} shows the items`);
    // Shared Nico owns the wardrobe fitting; no game-supplied hat may remain.
    if (
      dressed.userData.kid &&
      key !== 'basketball:baller-red' &&
      key !== 'basketball:baller-blue'
    )
      assert.equal(
        gameHeadParts(dressed).length,
        0,
        key + ' removes its own hat',
      );
  }
});
