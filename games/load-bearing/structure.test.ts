import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HALF_W,
  buildHouse,
  grounded,
  restsOn,
  supported,
} from './structure';
import { alive, partBottom, partTop, type Part } from './types';

const house = () => buildHouse();
const find = (parts: Part[], id: string) => parts.find((p) => p.id === id)!;
const destroy = (parts: Part[], match: (p: Part) => boolean) => {
  for (const p of parts) if (match(p)) p.hits = 0;
};

void test('the house starts as one connected structure', () => {
  const parts = house();
  assert.ok(parts.length > 25, 'expected a house worth demolishing');
  const held = supported(parts);
  assert.equal(
    held.size,
    parts.length,
    'every part should reach the ground before anything is hit',
  );
});

void test('ground columns stand on the ground and the roof does not', () => {
  const parts = house();
  assert.ok(grounded(find(parts, `col-${-HALF_W}-${-4}`)));
  assert.ok(!grounded(find(parts, 'roof--2')));
});

void test('parts rest only on what actually carries them', () => {
  const parts = house();
  const column = find(parts, `col-${-HALF_W}-${-4}`);
  const beam = find(parts, 'beam-z--4');
  const roof = find(parts, 'roof--2');
  assert.ok(restsOn(column, beam), 'the ring beam sits on its column');
  assert.ok(!restsOn(column, roof), 'the roof is nowhere near a ground column');
  assert.ok(!restsOn(beam, column), 'support does not run downward');
});

void test('touching footprints do not carry load', () => {
  const lower: Part = {
    ...find(house(), 'beam-z--4'),
    id: 'lower',
    x: 0,
    z: 0,
    w: 2,
    d: 2,
  };
  const edge: Part = { ...lower, id: 'edge', x: 2, y: lower.y + lower.h };
  assert.ok(!restsOn(lower, edge), 'a shared edge is not support');
  const biting: Part = { ...lower, id: 'biting', x: 1, y: lower.y + lower.h };
  assert.ok(restsOn(lower, biting), 'a real overlap is support');
});

void test('cutting every ground support drops the whole upper structure', () => {
  const parts = house();
  destroy(parts, (p) => partBottom(p) < 0.1);
  const held = supported(parts);
  const standing = parts.filter(alive);
  assert.ok(standing.length > 0, 'the upper structure still exists');
  assert.equal(held.size, 0, 'nothing can reach the ground any more');
});

void test('one slab bay can go without dropping the rest of the floor', () => {
  const parts = house();
  const bay = find(parts, 'slab-3.33--2');
  bay.hits = 0;
  const held = supported(parts);
  const others = parts.filter((p) => p.kind === 'slab' && alive(p));
  assert.equal(others.length, 5);
  for (const slab of others)
    assert.ok(held.has(slab.id), `${slab.id} should still be carried`);
});

void test('a part already falling stops carrying anything above it', () => {
  const parts = house();
  for (const p of parts) if (p.kind === 'beam') p.falling = true;
  const held = supported(parts);
  for (const slab of parts.filter((p) => p.kind === 'slab'))
    assert.ok(!held.has(slab.id), 'slabs cannot rest on a falling beam');
});

void test('the upper storey rides on the slab it stands on', () => {
  const parts = house();
  const slab = find(parts, `slab--3.33--2`);
  const column = find(parts, `up-col-${-HALF_W}-${-4}`);
  assert.ok(
    Math.abs(partTop(slab) - partBottom(column)) < 0.08,
    'the upper column meets the slab surface',
  );
});
