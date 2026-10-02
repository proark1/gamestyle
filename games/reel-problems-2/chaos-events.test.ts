import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHAOS_EVENT_PRESENTATION,
  CHAOS_VOYAGE_CATALOG,
  validateVoyageCatalog,
} from './chaos-catalog';
import { advanceChaosVoyage } from './chaos-voyage';
import { freshReel, newAngler, reelAction } from './simulation';

function game() {
  const w = freshReel(10_000);
  w.players.push(newAngler('p1', 'Player', 0, w.clock));
  reelAction(w, 'p1', { type: 'start', mode: 'chaos-voyage', seed: 4 }, 'p1');
  return w;
}

void test('the playable voyage catalog contains four valid presented events', () => {
  assert.doesNotThrow(() => validateVoyageCatalog(CHAOS_VOYAGE_CATALOG));
  assert.equal(CHAOS_VOYAGE_CATALOG.length, 4);
  assert.deepEqual(
    CHAOS_VOYAGE_CATALOG.map((item) => item.id).sort(),
    Object.keys(CHAOS_EVENT_PRESENTATION).sort(),
  );
  assert.ok(CHAOS_VOYAGE_CATALOG.every((item) => item.warningMs >= 2_500));
});

void test('hard gust warns before it activates and activation is idempotent', () => {
  const w = game();
  const notices: string[] = [];
  advanceChaosVoyage(w, (_world, _kind, text) => notices.push(text));
  assert.equal(w.voyage?.director.events[0]?.status, 'warned');
  assert.match(notices[0], /brace/i);
  assert.equal(w.weather.kind, 'calm');
  w.clock = w.voyage!.director.events[0].activateAt;
  advanceChaosVoyage(w, (_world, _kind, text) => notices.push(text));
  assert.equal(w.weather.kind, 'wind');
  const activeFacts = w.voyage!.story.facts.filter(
    (fact) => fact.kind === 'director-active',
  );
  advanceChaosVoyage(w);
  assert.equal(
    w.voyage!.story.facts.filter((fact) => fact.kind === 'director-active')
      .length,
    activeFacts.length,
  );
});
