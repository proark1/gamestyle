import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freshChaosVoyage } from './chaos-voyage';
import { freshReel, newAngler } from './simulation';
import {
  MAX_VOYAGE_FACTS,
  buildVoyageRecap,
  emitVoyageFact,
} from './voyage-story';

function game() {
  const w = freshReel(1_000);
  w.players.push(newAngler('p1', 'Player', 0, w.clock));
  w.voyage = freshChaosVoyage('giant-catch', 7, w.started, ['p1']);
  return w;
}

const fact = (severity = 0) => ({
  kind: 'director-active' as const,
  severity,
  benefit: 0,
  playerCaused: false,
  tags: [],
});

void test('voyage facts have stable ids, dedupe transitions and stay bounded', () => {
  const w = game();
  assert.equal(emitVoyageFact(w, fact(), 'same')?.id, 'fact-1');
  assert.equal(emitVoyageFact(w, fact(), 'same'), undefined);
  for (let i = 0; i < MAX_VOYAGE_FACTS + 5; i++) emitVoyageFact(w, fact());
  assert.equal(w.voyage?.story.facts.length, MAX_VOYAGE_FACTS);
  assert.equal('text' in w.voyage!.story.facts[0], false);
});

void test('recap ranks connected evidence and never invents a culprit', () => {
  const w = game();
  const warning = emitVoyageFact(w, fact(1))!;
  emitVoyageFact(w, { ...fact(4), causeFactId: warning.id });
  emitVoyageFact(w, { ...fact(4.5), at: w.started + 999_999 });
  const recap = buildVoyageRecap(w.voyage!.story, w.started, 540_000);
  assert.deepEqual(recap.disaster?.factIds, ['fact-2', 'fact-1']);
  assert.equal(recap.notableAt, 1_000);
  assert.equal(recap.questionable, undefined);
  assert.equal(recap.hero, undefined);
});

void test('hero and questionable moments require direct factual support', () => {
  const w = game();
  emitVoyageFact(w, {
    kind: 'rescue',
    actorId: 'p1',
    targetId: 'p2',
    severity: 0,
    benefit: 3,
    playerCaused: true,
    tags: [],
  });
  emitVoyageFact(w, {
    kind: 'overboard',
    actorId: 'p1',
    severity: 2,
    benefit: 0,
    playerCaused: true,
    tags: [],
  });
  const recap = buildVoyageRecap(w.voyage!.story, w.started, 540_000);
  assert.equal(recap.hero?.kind, 'rescue');
  assert.equal(recap.questionable?.kind, 'overboard');
});
