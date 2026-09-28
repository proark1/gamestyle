import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../public/citrus-jelly-cutter.html', import.meta.url),
  'utf8',
);

void test('the WGSL shader explicitly splats scalar colour adjustments', () => {
  assert.doesNotMatch(source, /color\.rgb\s*-=/);
  assert.match(
    source,
    /color\s*=\s*vec4f\(color\.rgb\s*-\s*vec3f\(pore\),\s*color\.a\)/,
  );
});
