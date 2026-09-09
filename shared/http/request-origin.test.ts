import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRoomOriginAllowed } from './request-origin';

void test('room requests support an explicitly configured HTTPS origin behind a proxy', () => {
  const request = new Request('http://internal:8080/api/rooms', {
    headers: { origin: 'https://game.example' },
  });
  assert.equal(isRoomOriginAllowed(request), false);
  assert.equal(isRoomOriginAllowed(request, 'https://game.example'), true);
});

void test('untrusted origins and forwarded host headers cannot override the public origin', () => {
  const request = new Request('http://internal:8080/api/rooms', {
    headers: {
      origin: 'https://attacker.example',
      'x-forwarded-host': 'attacker.example',
    },
  });
  assert.equal(isRoomOriginAllowed(request, 'https://game.example'), false);
  assert.equal(isRoomOriginAllowed(request, 'invalid configuration'), false);
});

void test('local same-origin and requests without an origin retain their existing behavior', () => {
  assert.equal(
    isRoomOriginAllowed(
      new Request('http://localhost:3010/api/rooms', {
        headers: { origin: 'http://localhost:3010' },
      }),
    ),
    true,
  );
  assert.equal(
    isRoomOriginAllowed(new Request('http://localhost:3010/api/rooms')),
    true,
  );
});

void test('a comma-separated list lets one deployment serve several domains', () => {
  const origins =
    'https://www.jumbleyard.com, https://jumbleyard.up.railway.app';
  const from = (origin: string) =>
    new Request('http://internal:8080/api/rooms', { headers: { origin } });
  assert.equal(
    isRoomOriginAllowed(from('https://www.jumbleyard.com'), origins),
    true,
  );
  assert.equal(
    isRoomOriginAllowed(from('https://jumbleyard.up.railway.app'), origins),
    true,
  );
  assert.equal(
    isRoomOriginAllowed(from('https://attacker.example'), origins),
    false,
  );
  assert.equal(
    isRoomOriginAllowed(from('https://jumbleyard.com'), origins),
    false,
  );
});

void test('malformed and empty entries never widen the allowed origins', () => {
  const request = new Request('http://internal:8080/api/rooms', {
    headers: { origin: 'https://attacker.example' },
  });
  assert.equal(
    isRoomOriginAllowed(request, 'not a url, https://game.example'),
    false,
  );
  assert.equal(isRoomOriginAllowed(request, ',,'), false);
  assert.equal(isRoomOriginAllowed(request, '   '), false);
  const trusted = new Request('http://internal:8080/api/rooms', {
    headers: { origin: 'https://game.example' },
  });
  assert.equal(
    isRoomOriginAllowed(trusted, 'not a url, https://game.example'),
    true,
  );
  assert.equal(
    isRoomOriginAllowed(trusted, 'https://game.example/lobby?a=1'),
    true,
  );
});
