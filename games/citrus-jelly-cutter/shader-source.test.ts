import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../public/citrus-jelly-cutter.html', import.meta.url),
  'utf8',
);

void test('the WGSL shader explicitly splats scalar colour adjustments', () => {
  assert.doesNotMatch(source, /color\.rgb\s*-=/);
  assert.match(source, /rgb\+vec3f\(dither\)/);
  assert.match(source, /vec3f\(thickness\)/);
  assert.match(source, /vec3f\(grain\)/);
});
