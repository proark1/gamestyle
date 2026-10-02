import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARTY_RESULT_ATTRIBUTE,
  PARTY_ROUND_ATTRIBUTE,
  PARTY_ROUND_ENDED_SELECTOR,
  leadingSide,
  parsePartyResult,
  partyGoal,
  partyRound,
  partyVersus,
} from './party-round';

void test('a running match is marked playing and publishes no result', () => {
  assert.deepEqual(partyRound(false, partyGoal(true, 3)), {
    'data-party-round': 'playing',
  });
});

void test('the ribbon selector matches exactly the mark of a finished match', () => {
  const [[name, value]] = Object.entries(partyRound(true, null));
  assert.equal(name, PARTY_ROUND_ATTRIBUTE);
  assert.equal(PARTY_ROUND_ENDED_SELECTOR, `[${name}="${value}"]`);
  assert.notEqual(
    PARTY_ROUND_ENDED_SELECTOR,
    `[${name}="${partyRound(false, null)[PARTY_ROUND_ATTRIBUTE]}"]`,
  );
});

void test('a finished match publishes its result for the ribbon to read back', () => {
  const result = partyVersus('red', 'red');
  const props = partyRound(true, result);
  assert.equal(props[PARTY_ROUND_ATTRIBUTE], 'ended');
  assert.deepEqual(parsePartyResult(props[PARTY_RESULT_ATTRIBUTE]), result);
});

void test('a team result is told from the local side', () => {
  assert.deepEqual(partyVersus('red', 'red'), {
    kind: 'versus',
    outcome: 'won',
  });
  assert.deepEqual(partyVersus('red', 'blue'), {
    kind: 'versus',
    outcome: 'lost',
  });
  assert.deepEqual(partyVersus('blue', 'draw'), {
    kind: 'versus',
    outcome: 'draw',
  });
  assert.deepEqual(partyVersus('blue', null), {
    kind: 'versus',
    outcome: 'draw',
  });
});

void test('the leading side needs the top score to itself', () => {
  assert.equal(leadingSide({ red: 3, blue: 1 }), 'red');
  assert.equal(leadingSide({ red: 1, blue: 3, green: 0 }), 'blue');
  assert.equal(leadingSide({ red: 2, blue: 2 }), 'draw');
  assert.equal(leadingSide({ red: 0, blue: 0, yellow: 0, green: 0 }), 'draw');
});

void test('team results retain a clean scoreboard without trusting malformed score details', () => {
  const result = partyVersus('blue', 'red', { red: 4.2, blue: 3.1 }, 'height');
  assert.deepEqual(parsePartyResult(JSON.stringify(result)), {
    kind: 'versus',
    outcome: 'lost',
    scores: { red: 4.2, blue: 3.1 },
    metric: 'height',
  });
  assert.deepEqual(
    parsePartyResult({
      kind: 'versus',
      outcome: 'won',
      scores: { red: Infinity, blue: 2 },
    }),
    {
      kind: 'versus',
      outcome: 'won',
    },
  );
  assert.deepEqual(
    parsePartyResult({
      kind: 'versus',
      outcome: 'won',
      scores: { red: 7, blue: 4, extra: 99 },
      metric: 'untrusted text',
    }),
    {
      kind: 'versus',
      outcome: 'won',
      scores: { red: 7, blue: 4 },
      metric: 'points',
    },
  );
});

void test('results from outside are checked and copied', () => {
  assert.deepEqual(
    parsePartyResult({ kind: 'goal', cleared: false, score: 4, extra: 1 }),
    { kind: 'goal', cleared: false, score: 4 },
  );
  assert.deepEqual(partyGoal(true, Number.NaN), {
    kind: 'goal',
    cleared: true,
    score: 0,
  });
  for (const bad of [
    null,
    undefined,
    '',
    '{not json',
    42,
    { kind: 'versus', outcome: 'maybe' },
    { kind: 'goal', cleared: 'yes', score: 1 },
    { kind: 'goal', cleared: true, score: Infinity },
    { kind: 'goal', cleared: true },
    { kind: 'ranked', place: 1 },
  ]) {
    assert.equal(parsePartyResult(bad), null, JSON.stringify(bad));
  }
});
