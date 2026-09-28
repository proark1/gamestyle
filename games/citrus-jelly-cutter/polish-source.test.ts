import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../public/citrus-jelly-cutter.html', import.meta.url),
  'utf8',
);

void test('the specimen uses a bounded presentation surface', () => {
  assert.match(source, /const MAX_PRESENTATION_OFFSET\s*=/);
  assert.match(source, /function preparePresentation\(/);
  assert.match(source, /presentationOffset/);
  assert.match(source, /presentationFinite/);
});

void test('the material exposes adaptive Studio Gummy rendering', () => {
  assert.match(source, /const QUALITY_PROFILES\s*=/);
  assert.match(source, /fn beerLambert\(/);
  assert.match(source, /fn softboxLobe\(/);
  assert.match(source, /microRoughness/);
  assert.match(source, /transmissionGlow/);
});

void test('the heavy gummy solver preserves volume and weighted grabs', () => {
  assert.match(source, /function smoothstep01\(/);
  assert.match(source, /volumeCorrection/);
  assert.match(source, /weightedGrab/);
  assert.match(source, /contactCompression/);
});
