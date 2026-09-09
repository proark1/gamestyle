import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {
  applyAction,
  CATALOG,
  freshWorld,
  JOBS,
  type Piece,
  type Player,
} from './model';
import { makePiece, disposePiece } from './objects';
import { pieceShape } from './colliders';
import { appearanceKey, PAINTS, finishesFor } from './appearance';
import { buildSnapshot, restoreBuild } from './build-snapshot';
import { homeProgress } from './home-projects';
import { PROP_USES } from './house-props';
import { animateHomeModel } from './home-models';
import { enableParty, challengeLink, parseChallenge } from './party';
import { craneDuration } from './crane';
import { tickWorld } from './model';

const now = 100000;
const player: Player = {
  id: 'builder',
  name: 'Painter',
  color: 0,
  x: 0,
  z: 2,
  angle: Math.PI,
  seen: now,
};
const empty = () => ({ ...freshWorld('sandbox', now), pieces: [] as Piece[] });
const part = (kind: Piece['kind'], id: string = kind, x = 0, z = 0): Piece => ({
  id,
  kind,
  x,
  z,
  rotation: 0,
  placed: true,
});
const paint = (world: ReturnType<typeof empty>, id: string, extra = {}) =>
  applyAction(
    world,
    { type: 'paint', id, paint: 'ocean', ...extra },
    player,
    [player],
    player.id,
    now,
  );

void test('colored floor building and repainting preserve placement and unrelated pieces', () => {
  const world = empty();
  applyAction(
    world,
    {
      type: 'build',
      kind: 'floor',
      x: 0,
      z: 0,
      rotation: 0,
      paint: 'coral',
      finish: 'checker',
    },
    player,
    [player],
    player.id,
    now,
  );
  const floor = world.pieces[0];
  assert.equal(floor.paint, 'coral');
  assert.equal(floor.finish, 'checker');
  world.pieces.push(part('sofa', 'neighbor', 3, 0));
  const location = { x: floor.x, z: floor.z, rotation: floor.rotation };
  paint(world, floor.id);
  assert.equal(floor.paint, 'ocean');
  assert.equal(floor.finish, 'checker');
  assert.deepEqual(
    { x: floor.x, z: floor.z, rotation: floor.rotation },
    location,
  );
  assert.equal(world.pieces[1].paint, undefined);
  assert.equal(world.builds, 1);
});
void test('whole-house paint updates placed exterior parts on all levels and leaves furniture, supplies and remote parts alone', () => {
  const world = empty();
  world.pieces = [
    part('wall'),
    part('window', 'upper', 2, -2),
    part('door', 'door', -2, 0),
    part('wall', 'outside', 8, 0),
    part('wall', 'loose', 3, 1),
    part('sofa', 'sofa', 2, 2),
    part('roof'),
  ];
  world.pieces[1].level = 1;
  world.pieces[4].placed = false;
  paint(world, 'wall', { wholeHouse: true, finish: 'plaster' });
  for (const piece of world.pieces.slice(0, 3)) {
    assert.equal(piece.paint, 'ocean');
    assert.equal(piece.finish, 'plaster');
  }
  for (const piece of world.pieces.slice(3))
    assert.equal(piece.paint, undefined);
});
void test('painting enforces reach, free hands, placed state, valid colors and compatible finishes', () => {
  const world = empty();
  world.pieces = [part('wall')];
  assert.throws(() => paint(world, 'wall', { paint: 'neon-script' }), /color/);
  assert.throws(() => paint(world, 'wall', { finish: 'checker' }), /finish/);
  assert.throws(
    () => paint(world, 'wall', { wholeHouse: 'true' }),
    /individual/,
  );
  assert.throws(
    () =>
      applyAction(
        world,
        { type: 'paint', id: 'wall', paint: 'mint' },
        { ...player, x: 10 },
        [player],
        player.id,
        now,
      ),
    /Walk/,
  );
  world.pieces[0].placed = false;
  assert.throws(() => paint(world, 'wall'), /placed/);
  world.pieces[0].placed = true;
  world.pieces.push({ ...part('chair'), heldBy: player.id });
  assert.throws(() => paint(world, 'wall'), /carrying/);
  assert.equal(world.pieces[0].paint, undefined);
});
void test('painting respects locked crew rounds and neighboring walls', () => {
  const world = empty();
  world.pieces = [part('chair'), part('wall', 'occluder', 0, 1)];
  assert.throws(() => paint(world, 'chair'), /Walk/);
  world.mode = 'job';
  enableParty(world, now, 42, 'sofa', 'paint-room');
  assert.throws(() => paint(world, 'chair'), /Wait/);
});
void test('painted finishes and completed prop trials survive saving and restoration without activity timestamps', () => {
  const world = empty();
  world.round = JOBS.length - 1;
  world.pieces = [
    { ...part('floor'), paint: 'mint', finish: 'tiles' },
    { ...part('stove', 'stove', 2, 0), usedAt: now },
  ];
  const saved = JSON.parse(JSON.stringify(buildSnapshot(world)));
  assert.equal(saved.brief, JOBS.length - 1);
  assert.equal(saved.pieces[0].paint, 'mint');
  assert.equal(saved.pieces[1].usedAt, undefined);
  assert.equal(saved.pieces[1].tried, true);
  const restored = empty();
  restoreBuild(restored, saved, 'saved-home', 'remix');
  assert.equal(restored.pieces[0].finish, 'tiles');
  assert.equal(restored.pieces[1].tried, true);
});
void test('all catalog entries and every compatible finish produce finite visible models with physical shapes', () => {
  for (const item of CATALOG)
    for (const finish of finishesFor(item.id)) {
      const group = makePiece(item.id, { paint: 'ocean', finish: finish.id });
      const bounds = new T.Box3().setFromObject(group);
      assert.ok(!bounds.isEmpty(), item.id);
      assert.ok([...bounds.min, ...bounds.max].every(Number.isFinite), item.id);
      const shape = pieceShape(item.id);
      assert.ok(
        shape.mass > 0 &&
          shape.boxes.every((b) => b.w > 0 && b.h > 0 && b.d > 0),
      );
      disposePiece(group);
    }
});
void test('paint materials are isolated across pieces and tile patterns have distinct geometry', () => {
  const original = makePiece('sofa'),
    blue = makePiece('sofa', { paint: 'ocean' }),
    again = makePiece('sofa');
  const colors = (g: T.Group) => {
    const result: string[] = [];
    g.traverse((o) => {
      if (o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial)
        result.push(o.material.color.getHexString());
    });
    return result;
  };
  assert.deepEqual(colors(original), colors(again));
  assert.notDeepEqual(colors(original), colors(blue));
  const tiles = makePiece('floor', { paint: 'forest', finish: 'checker' });
  assert.equal(tiles.children.length, 17);
  assert.ok(new Set(colors(tiles)).size >= 3);
  assert.equal(
    appearanceKey({}),
    appearanceKey({ paint: 'original', finish: 'classic' }),
  );
  assert.equal(new Set(PAINTS.map((p) => p.hex)).size, PAINTS.length);
  [original, blue, again, tiles].forEach((g) => disposePiece(g));
});
void test('new interactive props run through the shared action, cooldown and visual lifecycle', () => {
  for (const kind of [
    'sink',
    'stove',
    'bathtub',
    'tv',
    'piano',
    'aquarium',
    'easel',
  ] as const) {
    const world = empty();
    world.pieces = [part(kind)];
    applyAction(
      world,
      { type: 'use', id: kind },
      player,
      [player],
      player.id,
      now,
    );
    assert.equal(world.pieces[0].usedAt, now);
    assert.equal(world.events.at(-1)?.audioCue, PROP_USES[kind]!.cue);
    assert.throws(
      () =>
        applyAction(
          world,
          { type: 'use', id: kind },
          player,
          [player],
          player.id,
          now + 100,
        ),
      /finish/,
    );
    const model = makePiece(kind);
    animateHomeModel(model, kind, 1000, 4000);
    assert.ok(model.userData.activity);
    if (kind === 'tv' || kind === 'sink') {
      assert.equal(model.userData.activity.visible, true);
      animateHomeModel(model, kind, 5000, 4000);
      assert.equal(model.userData.activity.visible, false);
    }
    disposePiece(model);
  }
});
void test('home projects require furnishing the foundation and trying interactive items', () => {
  const world = empty();
  world.pieces = ['counter', 'fridge', 'sink', 'stove'].map((k, i) =>
    part(k as Piece['kind'], k, i - 2, 0),
  );
  const kitchen = () => homeProgress(world).find((p) => p.id === 'kitchen')!;
  assert.equal(kitchen().complete, false);
  world.pieces[3].tried = true;
  assert.equal(kitchen().complete, true);
  world.pieces[0].placed = false;
  assert.equal(kitchen().complete, false);
  world.pieces[0].placed = true;
  world.pieces[0].x = 9;
  assert.equal(kitchen().complete, false);
  world.pieces[0].x = 0;
  world.pieces[0].level = 2;
  assert.equal(kitchen().complete, true);
});

void test('new customer briefs survive shared challenge links', () => {
  const world = empty();
  world.round = JOBS.length - 1;
  enableParty(world, now, 42, 'sofa', 'new-brief');
  const url = new URL(challengeLink('https://example.test', world));
  assert.equal(parseChallenge(url.searchParams)?.brief, JOBS.length - 1);
  url.searchParams.set('brief', String(JOBS.length));
  assert.throws(() => parseChallenge(url.searchParams), /brief/);
});

void test('roof crane applies chosen tile colors and cancellation restores the original finish', () => {
  const world = freshWorld('sandbox', now);
  const source = world.pieces.find((p) => p.supply)!;
  applyAction(
    world,
    { type: 'crane-pick', id: source.id },
    player,
    [player],
    player.id,
    now,
  );
  const ready = now + craneDuration(world.crane!) + 1;
  tickWorld(world, [{ ...player, seen: ready }], ready);
  assert.equal(world.crane?.phase, 'ready');
  applyAction(
    world,
    { type: 'crane-place', x: -3, z: -3, rotation: 0, paint: 'slate' },
    player,
    [player],
    player.id,
    ready,
  );
  assert.equal(
    world.pieces.find((p) => p.id === world.crane?.pieceId)?.paint,
    'slate',
  );
  const placed = ready + craneDuration(world.crane!) + 1;
  tickWorld(world, [{ ...player, seen: placed }], placed);
  const roof = world.pieces.find((p) => p.kind === 'roof' && p.placed)!;
  assert.ok(roof);
  assert.equal(roof.paint, 'slate');
  applyAction(
    world,
    { type: 'crane-pick', id: roof.id },
    player,
    [player],
    player.id,
    placed + 1,
  );
  const lifted = placed + craneDuration(world.crane!) + 2;
  tickWorld(world, [{ ...player, seen: lifted }], lifted);
  applyAction(
    world,
    { type: 'crane-place', x: -3, z: -3, rotation: 0, paint: 'coral' },
    player,
    [player],
    player.id,
    lifted,
  );
  applyAction(
    world,
    { type: 'crane-cancel' },
    player,
    [player],
    player.id,
    lifted + 1,
  );
  assert.equal(world.pieces.find((p) => p.id === roof.id)?.paint, 'slate');
});
