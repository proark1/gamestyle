import assert from 'node:assert/strict';
import test from 'node:test';
import { citrusMessage } from './bridge';

void test('the frame bridge accepts only the Citrus Jelly event vocabulary', () => {
  assert.deepEqual(
    citrusMessage({ source: 'citrus-jelly-cutter', kind: 'ready' }),
    { kind: 'ready' },
  );
  assert.deepEqual(
    citrusMessage({
      source: 'citrus-jelly-cutter',
      kind: 'milestone',
      key: 'first-cut',
    }),
    { kind: 'milestone', key: 'first-cut' },
  );
  assert.equal(
    citrusMessage({
      source: 'citrus-jelly-cutter',
      kind: 'action',
      key: 'delete-everything',
    }),
    null,
  );
  assert.equal(citrusMessage({ source: 'another-frame', kind: 'ready' }), null);
});
