import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountConfig, publicOriginFor, signInMethods } from './config';

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

void test('over HTTPS no sign-in method opens until the privacy page names the operator', () => {
  const env = {
    AUTH_SECRET: SECRET,
    GOOGLE_CLIENT_ID: 'client-1',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    RESEND_API_KEY: 're_test',
    EMAIL_FROM: 'Jumbleyard <sign-in@jumbleyard.com>',
    PUBLIC_GAME_ORIGIN: 'https://www.jumbleyard.com',
  };
  const operator = {
    name: 'Example Operator',
    address: '1 Example Street, Example Town',
    email: 'hello@example.com',
  };
  assert.deepEqual(signInMethods(accountConfig(env, null)), {
    google: false,
    email: false,
  });
  assert.deepEqual(signInMethods(accountConfig(env, operator)), {
    google: true,
    email: true,
  });
  const local = { ...env, PUBLIC_GAME_ORIGIN: 'http://localhost:3000' };
  assert.deepEqual(signInMethods(accountConfig(local, null)), {
    google: true,
    email: true,
  });
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
