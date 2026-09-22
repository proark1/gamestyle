import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicGameOrigin } from './public-url';
void test('public invites preserve web origins and replace installed origins', () => {
  for (const origin of [
    'capacitor://localhost',
    'http://localhost',
    'https://localhost',
    'jumbleyard-app://client',
    'null',
  ])
    assert.equal(publicGameOrigin(origin, true), 'https://www.jumbleyard.com');
  assert.equal(
    publicGameOrigin('jumbleyard-app://client', false),
    'https://www.jumbleyard.com',
  );
  assert.equal(
    publicGameOrigin('https://www.jumbleyard.com', false),
    'https://www.jumbleyard.com',
  );
  assert.equal(
    publicGameOrigin('http://localhost:4173', false),
    'http://localhost:4173',
  );
});
