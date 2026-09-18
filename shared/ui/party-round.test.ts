import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARTY_ROUND_ATTRIBUTE,
  PARTY_ROUND_ENDED_SELECTOR,
  partyRound,
} from './party-round';

void test('a running match is marked playing', () => {
  assert.deepEqual(partyRound(false), { 'data-party-round': 'playing' });
});

void test('the ribbon selector matches exactly the mark of a finished match', () => {
  const [[name, value]] = Object.entries(partyRound(true));
  assert.equal(name, PARTY_ROUND_ATTRIBUTE);
  assert.equal(PARTY_ROUND_ENDED_SELECTOR, `[${name}="${value}"]`);
  assert.notEqual(
    PARTY_ROUND_ENDED_SELECTOR,
    `[${name}="${partyRound(false)[PARTY_ROUND_ATTRIBUTE]}"]`,
  );
});
