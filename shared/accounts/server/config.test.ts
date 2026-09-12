import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountConfig, publicOriginFor } from './config';

const SECRET = 'a-test-secret-that-is-long-enough-000';

void test('codes go to the server console only without HTTPS, however the scheme is written', () => {
  const env = (origin?: string) => ({
    AUTH_SECRET: SECRET,
    ACCOUNT_EMAIL_DEV_LOG: '1',
    PUBLIC_GAME_ORIGIN: origin,
  });
  assert.equal(accountConfig(env('http://localhost:3000')).email, 'log');
  assert.equal(accountConfig(env()).email, 'log');
  for (const origin of [
    'https://www.jumbleyard.com',
    'HTTPS://www.jumbleyard.com',
    'http://localhost:3000, Https://www.jumbleyard.com',
  ])
    assert.equal(accountConfig(env(origin)).email, undefined, origin);
});

void test('the public origin follows the Host header among the configured origins', () => {
  const request = (host: string) =>
    new Request('http://internal:8080/api/account/session', {
      headers: { host },
    });
  const configured =
    'https://www.jumbleyard.com,https://jumbleyard.up.railway.app';
  assert.equal(
    publicOriginFor(request('jumbleyard.up.railway.app'), configured),
    'https://jumbleyard.up.railway.app',
  );
  assert.equal(
    publicOriginFor(request('elsewhere.example'), configured),
    'https://www.jumbleyard.com',
  );
  assert.equal(
    publicOriginFor(request('internal:8080')),
    'http://internal:8080',
  );
});
