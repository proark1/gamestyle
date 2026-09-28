import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PERSONAL_OBJECTIVES,
  applyObjectiveFact,
  assignPersonalObjectives,
  neutralizePersonalObjective,
} from './personal-objectives';

void test('personal objectives are deterministic, solo eligible and sabotage safe', () => {
  const a = assignPersonalObjectives(9, ['b', 'a', 'c']);
  assert.deepEqual(a, assignPersonalObjectives(9, ['c', 'b', 'a']));
  assert.equal(PERSONAL_OBJECTIVES.length, 3);
  assert.ok(
    PERSONAL_OBJECTIVES.every((item) => item.soloEligible && item.sabotageSafe),
  );
});

void test('objective progress is idempotent and only rewards matching success facts', () => {
  const objectives = assignPersonalObjectives(0, ['p1']);
  const catchFact = {
    id: 'f1',
    at: 0,
    kind: 'catch' as const,
    actorId: 'p1',
    severity: 0,
    benefit: 1,
    playerCaused: true,
    tags: ['rough-weather'],
  };
  applyObjectiveFact(objectives, catchFact);
  applyObjectiveFact(objectives, catchFact);
  assert.equal(objectives.p1.status, 'completed');
  assert.equal(objectives.p1.progress, 1);
});

void test('sea legs fails on overboard and disconnected objectives become neutral', () => {
  const objectives = assignPersonalObjectives(2, ['p1', 'p2']);
  applyObjectiveFact(objectives, {
    id: 'f1',
    at: 0,
    kind: 'overboard',
    actorId: 'p1',
    severity: 2,
    benefit: 0,
    playerCaused: false,
    tags: [],
  });
  assert.equal(objectives.p1.status, 'failed');
  neutralizePersonalObjective(objectives, 'p2');
  assert.equal(objectives.p2.status, 'neutral');
});
