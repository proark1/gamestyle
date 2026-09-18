import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inPartyMode } from './party-mode';

const body = (...classes: string[]) => ({
  classList: { contains: (token: string) => classes.includes(token) },
});

void test('a party room code in the URL marks a party round', () => {
  assert.ok(inPartyMode('?party=ABC234&round=2', null));
  assert.ok(inPartyMode('?party=abc234', null), 'codes match in any case');
});

void test('the ribbon body class marks a party round without the URL', () => {
  assert.ok(inPartyMode('', body('jumbleyard-party-mode')));
});

void test('ordinary visits and invite links are not party rounds', () => {
  assert.ok(!inPartyMode('', null));
  assert.ok(!inPartyMode('?room=ABC234', body('something-else')));
  assert.ok(!inPartyMode('?party=', null));
  assert.ok(!inPartyMode('?party=not-a-code', null));
});

void test('outside a browser nothing is a party round', () => {
  assert.equal(inPartyMode(), false);
});
