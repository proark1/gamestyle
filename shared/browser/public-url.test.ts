import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameInviteUrl, publicGameOrigin } from './public-url';
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

void test('sharing inside a party keeps the party invitation instead of a private game code', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'location');
  try {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: {
        origin: 'https://www.jumbleyard.com',
        search: '?party=abc234&room=XYZ567',
      },
    });
    assert.equal(
      gameInviteUrl('crane-clash', 'XYZ567'),
      'https://www.jumbleyard.com/party?room=ABC234',
    );
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { origin: 'https://www.jumbleyard.com', search: '?room=XYZ567' },
    });
    assert.equal(
      gameInviteUrl('crane-clash', 'XYZ567'),
      'https://www.jumbleyard.com/crane-clash?room=XYZ567',
    );
  } finally {
    if (previous) Object.defineProperty(globalThis, 'location', previous);
    else Reflect.deleteProperty(globalThis, 'location');
  }
});
