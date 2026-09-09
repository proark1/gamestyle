import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  bedKey,
  dimensions,
  emptyInventory,
  FLOOR,
  freshWorld,
  MIX_TIME,
  placementError,
  raceProgress,
  snapped,
  STATIONS,
  type Action,
  type Builder,
  type Part,
  type World,
} from './model';
import { placementAtSurface, previewShape } from './placement';
import { blocksWalker, insideSolid, TRUCK, BOARD } from './site-layout';
const builder: Builder = {
  id: 'a',
  name: 'A',
  color: 0,
  seen: 1,
  x: 0,
  y: 1.8,
  z: 1,
  yaw: 0,
  pitch: 0,
};
const near = (id: string): Builder => {
  const s = STATIONS.find((s) => s.id === id)!;
  return { ...builder, x: s.x, z: s.z + 1.6 };
};
const p = { x: 0, y: FLOOR + 0.125, z: 0, rotation: 0 };
function stocked(): World {
  const w = freshWorld();
  w.inventories.a = {
    ...emptyInventory(),
    bricks: 8,
    mortar: 24,
    beams: 2,
    roofs: 2,
  };
  return w;
}
function brick(x: number, bonded = true): Part {
  return { ...p, x, kind: 'brick', id: String(x), by: 'a', at: 1, bonded };
}
void test('the physical supply/mixer sequence consumes ingredients and makes mortar only after mixing finishes', () => {
  let w = freshWorld();
  for (const station of ['cement', 'sand', 'sand', 'water']) {
    w = applyAction(w, { type: 'supply', station }, near(station), 100);
    assert.equal(w.inventories.a.carrying, station);
    w = applyAction(w, { type: 'mixer' }, near('mixer'), 100);
    assert.equal(w.inventories.a.carrying, null);
  }
  w = applyAction(w, { type: 'mixer' }, near('mixer'), 100);
  assert.equal(w.mixer.readyAt, 100 + MIX_TIME);
  assert.equal(w.mixer.cement, 0);
  assert.throws(
    () => applyAction(w, { type: 'mixer' }, near('mixer'), 101),
    /running/,
  );
  w = applyAction(w, { type: 'mixer' }, near('mixer'), 100 + MIX_TIME);
  assert.equal(w.inventories.a.mortar, 24);
  assert.equal(w.mixer.remaining, 0);
});
void test('bad recipes are recoverable and a carried ingredient can be returned to its station', () => {
  let w = freshWorld();
  w.mixer = { ...w.mixer, cement: 7, sand: 12, water: 7 };
  assert.throws(() => applyAction(w, { type: 'mixer' }, near('mixer')), /sand/);
  w = applyAction(w, { type: 'empty-mixer' }, near('mixer'));
  assert.deepEqual(w.mixer, freshWorld().mixer);
  w = applyAction(w, { type: 'supply', station: 'water' }, near('water'));
  w = applyAction(w, { type: 'supply', station: 'water' }, near('water'));
  assert.equal(w.inventories.a.carrying, null);
});
void test('mortar and brick placement are separate, consume stock once, and support the next course', () => {
  let w = stocked();
  w = applyAction(w, { type: 'mortar', placement: p }, builder);
  assert.equal(w.parts.length, 0);
  assert.equal(w.beds.length, 1);
  assert.equal(w.inventories.a.mortar, 23);
  w = applyAction(
    w,
    { type: 'place', kind: 'brick', placement: p },
    builder,
    100,
    'one',
  );
  assert.equal(w.parts.length, 1);
  assert.equal(w.beds.length, 0);
  assert.equal(w.parts[0].bonded, true);
  assert.equal(w.inventories.a.bricks, 7);
  assert.equal(
    applyAction(
      w,
      { type: 'place', kind: 'brick', placement: p },
      builder,
      101,
      'one',
    ),
    w,
  );
  assert.equal(
    placementError(w, { ...p, y: p.y + 0.25 }, 'brick', builder),
    null,
  );
  assert.throws(
    () =>
      applyAction(w, { type: 'place', kind: 'brick', placement: p }, builder),
    /already/,
  );
});
void test('a dry brick can be pointed at and mortared afterwards', () => {
  let w = applyAction(
    stocked(),
    { type: 'place', kind: 'brick', placement: p },
    builder,
  );
  assert.match(placementError(w, { ...p, y: p.y + 0.25 }, 'brick')!, /dry/);
  w = applyAction(w, { type: 'mortar', placement: p }, builder);
  assert.equal(w.parts[0].bonded, true);
  assert.equal(w.inventories.a.mortar, 23);
  assert.equal(placementError(w, { ...p, y: p.y + 0.25 }, 'brick'), null);
});
void test('roof and beams require both ends supported; pieces cannot float or overlap', () => {
  const w = stocked();
  assert.match(placementError(w, { ...p, y: p.y + 1 }, 'brick')!, /support/);
  assert.match(
    placementError(w, { ...p, y: 0.18 }, 'roof')!,
    /supporting frame/,
  );
  w.parts = [brick(-0.75)];
  assert.match(
    placementError(w, { ...p, y: p.y + 0.25 }, 'beam')!,
    /both ends/,
  );
  w.parts.push(brick(0.75));
  assert.equal(placementError(w, { ...p, y: p.y + 0.25 }, 'beam'), null);
});
void test('removal keeps independently supported neighbours and returns the removed material', () => {
  let w = stocked();
  w.parts = [brick(0), brick(0.5)];
  const bed = { ...p, x: 0.5, y: p.y + 0.25 };
  w.beds = [{ ...bed, key: bedKey(bed), by: 'a' }];
  w = applyAction(w, { type: 'remove', id: '0' }, builder);
  assert.equal(w.beds.length, 1);
  assert.equal(w.inventories.a.bricks, 9);
  w.parts.push({ ...brick(0.5), id: 'upper', y: p.y + 0.25 });
  assert.throws(
    () => applyAction(w, { type: 'remove', id: '0.5' }, builder),
    /resting on/,
  );
});
void test('two helpers cannot each scoop the last mortar batch or place into the same occupied cell', () => {
  let w = stocked();
  w.mixer = { ...w.mixer, remaining: 24, readyAt: 100 };
  w.inventories.a.mortar = 0;
  w.inventories.b = emptyInventory();
  w = applyAction(w, { type: 'mixer' }, near('mixer'), 101);
  assert.throws(
    () => applyAction(w, { type: 'mixer' }, { ...near('mixer'), id: 'b' }, 101),
    /Recipe/,
  );
  assert.equal(w.inventories.a.mortar, 24);
  assert.equal(w.inventories.b.mortar, 0);
});
void test('unknown actions, invalid numbers, remote supply grabs and empty inventories are rejected', () => {
  assert.throws(
    () =>
      applyAction(freshWorld(), { type: 'supply', station: 'cement' }, builder),
    /closer/,
  );
  assert.throws(
    () =>
      applyAction(
        freshWorld(),
        { type: 'place', kind: 'brick', placement: p },
        builder,
      ),
    /bricks/,
  );
  assert.throws(
    () =>
      applyAction(
        stocked(),
        { type: 'mortar', placement: { ...p, x: NaN } },
        builder,
      ),
    /valid/,
  );
  assert.throws(
    () =>
      applyAction(stocked(), { type: 'hack' } as unknown as Action, builder),
    /Unknown/,
  );
});

void test('perpendicular bricks meet exactly in all four corner directions and match the outer edge', () => {
  for (const rotation of [0, 1])
    for (const sign of [-1, 1])
      for (const edge of [-1, 1]) {
        const base = { ...brick(0), rotation },
          d = dimensions('brick', rotation);
        const normal = rotation
          ? { x: 0, y: 0, z: sign }
          : { x: sign, y: 0, z: 0 };
        const point = {
          x: rotation ? edge * 0.1 : (sign * d.w) / 2,
          y: base.y,
          z: rotation ? (sign * d.d) / 2 : edge * 0.1,
        };
        const next = placementAtSurface(
            point,
            normal,
            'brick',
            1 - rotation,
            base,
          ),
          nd = dimensions('brick', next.rotation);
        assert.equal(Math.abs(rotation ? next.z : next.x), 0.375);
        assert.equal(
          rotation ? next.x + (edge * nd.w) / 2 : next.z + (edge * nd.d) / 2,
          edge * 0.125,
        );
        const w = stocked();
        w.parts.push(base);
        assert.equal(placementError(w, next, 'brick'), null);
        const placed = applyAction(
          w,
          { type: 'place', kind: 'brick', placement: next },
          builder,
        );
        assert.deepEqual(snapped(next), {
          x: placed.parts[1].x,
          y: placed.parts[1].y,
          z: placed.parts[1].z,
          rotation: placed.parts[1].rotation,
        });
      }
});

void test('foundation edges fit complete bricks and mortar previews stay thin above the target surface', () => {
  const corner = placementAtSurface(
    { x: 4, y: FLOOR, z: 3 },
    { x: 0, y: 1, z: 0 },
    'brick',
    0,
  );
  assert.equal(corner.x, 3.75);
  assert.equal(corner.z, 2.875);
  assert.equal(placementError(freshWorld(), corner, 'brick'), null);
  const dry = brick(0, false),
    shape = previewShape('mortar', dry, dry);
  assert.equal(shape.h, 0.024);
  assert.ok(shape.y > dry.y + 0.125);
  const wet = applyAction(stocked(), { type: 'mortar', placement: p }, builder);
  assert.equal(previewShape('mortar', wet.beds[0]).y, FLOOR + 0.015);
  const w = stocked();
  w.parts.push(dry);
  const result = applyAction(w, { type: 'mortar', placement: p }, builder);
  assert.equal(result.parts[0].mortaredTop, true);
  assert.equal(result.inventories.a.mortar, 23);
});

void test('upright timber supports a horizontal beam and a roof at the exact support height', () => {
  let w = stocked();
  for (const x of [-0.75, 0.75])
    w = applyAction(
      w,
      {
        type: 'place',
        kind: 'beam',
        placement: { x, y: FLOOR + 1, z: 0, rotation: 2 },
      },
      builder,
    );
  assert.deepEqual(dimensions('beam', 2), { w: 0.25, h: 2, d: 0.25 });
  w.inventories.a.beams = 1;
  w = applyAction(
    w,
    {
      type: 'place',
      kind: 'beam',
      placement: { x: 0, y: FLOOR + 2.125, z: 0, rotation: 0 },
    },
    builder,
  );
  const beam = w.parts[2];
  // Aiming at its side still proposes the roof on top, never back on the floor.
  const roof = placementAtSurface(
    { x: 0, y: beam.y, z: 0.125 },
    { x: 0, y: 0, z: 1 },
    'roof',
    0,
    beam,
  );
  assert.equal(roof.y, 2.43);
  assert.equal(placementError(w, roof, 'roof'), null);
  w = applyAction(w, { type: 'place', kind: 'roof', placement: roof }, builder);
  assert.equal(w.parts[3].y - 0.06, beam.y + 0.125);
  const roofEdge = placementAtSurface(
    { x: roof.x, y: roof.y, z: roof.z + 0.5 },
    { x: 0, y: 0, z: 1 },
    'roof',
    0,
    w.parts[3],
  );
  assert.equal(roofEdge.y, roof.y);
  assert.equal(roofEdge.z, roof.z + 1);
  assert.match(placementError(freshWorld(), roofEdge, 'roof')!, /support/);
  assert.throws(
    () => applyAction(w, { type: 'remove', id: beam.id }, builder),
    /resting on/,
  );
  assert.match(
    placementError(freshWorld(), { x: 0, y: 2.12, z: 0, rotation: 2 }, 'beam')!,
    /support/,
  );
});

void test('truck collision follows its rotation, board blocks bodies but permits walking around', () => {
  assert.equal(blocksWalker(TRUCK, TRUCK.x, TRUCK.z, 0), true);
  const a = TRUCK.rotation,
    sideX = TRUCK.x + Math.cos(a) * 1.3,
    sideZ = TRUCK.z - Math.sin(a) * 1.3;
  assert.equal(insideSolid(TRUCK, sideX, sideZ), false);
  assert.equal(blocksWalker(TRUCK, TRUCK.x, TRUCK.z, 2), false);
  assert.equal(blocksWalker(BOARD, BOARD.x, BOARD.z, 0), true);
  assert.equal(blocksWalker(BOARD, BOARD.x + 1.6, BOARD.z, 0), false);
});

void test('the optional shared race excludes existing builds, does not reward rebuilding, and preserves the world', () => {
  let w = stocked();
  w.parts.push(brick(0));
  const atBoard = { ...builder, x: -2.8, z: -4.3 };
  assert.throws(() => applyAction(w, { type: 'race' }, builder, 100), /sign/);
  w = applyAction(w, { type: 'race' }, atBoard, 100, 'start-race');
  assert.equal(w.parts.length, 1);
  assert.equal(w.race!.deadline, 300100);
  assert.equal(applyAction(w, { type: 'race' }, atBoard, 100, 'start-race'), w);
  assert.throws(
    () => applyAction(w, { type: 'race' }, atBoard, 200),
    /already/,
  );
  assert.deepEqual(raceProgress(w), { bricks: 0, posts: 0, roofs: 0 });
  w = applyAction(
    w,
    { type: 'place', kind: 'brick', placement: { ...p, x: 0.5 } },
    builder,
    201,
  );
  w = applyAction(
    w,
    { type: 'mortar', placement: { ...p, x: 0.5 } },
    builder,
    202,
  );
  assert.equal(raceProgress(w).bricks, 1);
  w = applyAction(w, { type: 'remove', id: w.parts[1].id }, builder, 203);
  assert.equal(raceProgress(w).bricks, 0);
  w = applyAction(w, { type: 'race' }, atBoard, 300101);
  assert.equal(w.parts.length, 1);
  assert.equal(w.race!.started, 300101);
});

void test('a jam happens only in a race, any helper can fix it, and mortar cannot be scooped while jammed', () => {
  let w = freshWorld();
  w.mixer = { ...w.mixer, cement: 1, sand: 2, water: 1, batches: 1 };
  const normal = applyAction(w, { type: 'mixer' }, near('mixer'), 100);
  assert.equal(normal.mixer.jammed, undefined);
  w.race = { started: 1, deadline: 300000, baseline: [] };
  w = applyAction(w, { type: 'mixer' }, near('mixer'), 100);
  assert.equal(w.mixer.jammed, true);
  assert.throws(
    () => applyAction(w, { type: 'empty-mixer' }, near('mixer'), 8000),
    /Nudge/,
  );
  w = applyAction(
    w,
    { type: 'mixer' },
    { ...near('mixer'), id: 'b' },
    8000,
    'rescue',
  );
  assert.equal(w.mixer.jammed, false);
  assert.equal(w.mixer.readyAt, 8000 + MIX_TIME);
  assert.equal(w.inventories.b.mortar, 0);
  assert.equal(
    applyAction(w, { type: 'mixer' }, near('mixer'), 8100, 'rescue'),
    w,
  );
  w = applyAction(w, { type: 'mixer' }, near('mixer'), 8000 + MIX_TIME);
  assert.equal(w.inventories.a.mortar, 24);
});

void test('shared sayings vary, survive reload, rate limit repeated calls and finish a completed race once', () => {
  let w = applyAction(stocked(), { type: 'shout' }, builder, 100);
  const first = w.notice!.text;
  assert.throws(
    () => applyAction(w, { type: 'shout' }, builder, 101),
    /breath/,
  );
  w = applyAction(
    JSON.parse(JSON.stringify(w)),
    { type: 'shout' },
    builder,
    4000,
  );
  assert.notEqual(w.notice!.text, first);
  assert.throws(
    () => applyAction(w, { type: 'horn' }, builder, 8000),
    /vehicle/,
  );
  w.race = { started: 1, deadline: 300000, baseline: [] };
  w.parts = Array.from({ length: 12 }, (_, i) => ({
    ...brick(i),
    id: `brick${i}`,
  }));
  for (const kind of ['beam', 'roof'] as const)
    for (let i = 0; i < 2; i++)
      w.parts.push({
        ...brick(i),
        id: `${kind}${i}`,
        kind,
        rotation: kind === 'beam' ? 2 : 0,
      });
  w = applyAction(w, { type: 'shout' }, builder, 8000);
  assert.equal(w.race!.completed, 8000);
  assert.match(w.notice!.text, /THE ROOF IS UP/);
  w = applyAction(w, { type: 'shout' }, builder, 12000);
  assert.equal(w.race!.completed, 8000);
});
