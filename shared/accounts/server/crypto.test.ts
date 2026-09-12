import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  base64url,
  fromBase64url,
  pkceChallenge,
  randomToken,
  sameText,
  seal,
  sixDigitCode,
  unseal,
} from './crypto';

const SECRET = 'a-test-secret-that-is-long-enough-000';

void test('tokens are 43 URL-safe characters and never repeat', () => {
  const tokens = new Set(Array.from({ length: 200 }, () => randomToken()));
  assert.equal(tokens.size, 200);
  for (const token of tokens) assert.match(token, /^[\w-]{43}$/);
});

void test('base64url round-trips every byte value', () => {
  const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
  assert.deepEqual(fromBase64url(base64url(bytes)), bytes);
});

void test('the PKCE challenge matches the RFC 7636 example', async () => {
  assert.equal(
    await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  );
});

void test('sign-in codes are six digits spread over the whole range', () => {
  const codes = Array.from({ length: 2000 }, () => sixDigitCode());
  for (const code of codes) assert.match(code, /^\d{6}$/);
  assert.ok(codes.some((code) => code < '500000'));
  assert.ok(codes.some((code) => code >= '500000'));
});

void test('sealed values open only untouched, with the same secret and purpose', async () => {
  const sealed = await seal(SECRET, 'google', { state: 'abc', n: 1 });
  assert.deepEqual(await unseal(SECRET, 'google', sealed), {
    state: 'abc',
    n: 1,
  });
  assert.equal(await unseal(SECRET, 'email', sealed), null);
  assert.equal(await unseal(`${SECRET}x`, 'google', sealed), null);
  const [body, signature] = sealed.split('.');
  const forged = base64url(
    new TextEncoder().encode(JSON.stringify({ state: 'evil', n: 1 })),
  );
  assert.equal(await unseal(SECRET, 'google', `${forged}.${signature}`), null);
  assert.equal(
    await unseal(SECRET, 'google', `${body}.${signature.slice(1)}0`),
    null,
  );
  for (const junk of [undefined, '', 'no-dot', '.signature', '%%%.abc'])
    assert.equal(await unseal(SECRET, 'google', junk), null);
});

void test('text comparison needs the same length and content', () => {
  assert.ok(sameText('abc', 'abc'));
  assert.ok(!sameText('abc', 'abd'));
  assert.ok(!sameText('abc', 'abcd'));
});
