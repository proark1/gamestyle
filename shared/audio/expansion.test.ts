import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breakfastCatalog } from '../../games/four-brain-cells/audio';
import { reelCatalog } from '../../games/reel-problems/audio';
import { hotelCatalog } from '../../games/wrong-floor/audio';
import { parseCue } from '../../platform/audio/service';

void test('expanded catalogs keep unique provider-valid cues and complete scene layers', () => {
  for (const catalog of [breakfastCatalog, reelCatalog, hotelCatalog]) {
    const ids = new Set(catalog.map((c) => c.id));
    assert.equal(ids.size, catalog.length);
    for (const cue of catalog)
      assert.doesNotThrow(() => parseCue(cue, cue), cue.id);
    for (const id of [
      'event.ui',
      'event.join',
      'event.leave',
      'event.fail',
      'music.menu',
      'music.win',
      'music.fail',
    ])
      assert.ok(ids.has(id), id);
    assert.ok(catalog.some((c) => c.category === 'ambience' && c.loop));
    assert.equal(catalog.find((c) => c.id === 'music.win')?.loop, false);
    assert.equal(catalog.find((c) => c.id === 'music.fail')?.loop, false);
  }
});
