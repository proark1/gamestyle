import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRoomOriginAllowed } from './request-origin';

test('room requests support an explicitly configured HTTPS origin behind a proxy', () => {
  const request = new Request('http://internal:8080/api/rooms', {
    headers: { origin: 'https://game.example' },
  });
  assert.equal(isRoomOriginAllowed(request), false);
  assert.equal(isRoomOriginAllowed(request, 'https://game.example'), true);
});

test('untrusted origins and forwarded host headers cannot override the public origin', () => {
  const request = new Request('http://internal:8080/api/rooms', {
    headers: { origin: 'https://attacker.example', 'x-forwarded-host': 'attacker.example' },
  });
  assert.equal(isRoomOriginAllowed(request, 'https://game.example'), false);
  assert.equal(isRoomOriginAllowed(request, 'invalid configuration'), false);
});

test('local same-origin and requests without an origin retain their existing behavior', () => {
  assert.equal(isRoomOriginAllowed(new Request('http://localhost:3010/api/rooms', {
    headers: { origin: 'http://localhost:3010' },
  })), true);
  assert.equal(isRoomOriginAllowed(new Request('http://localhost:3010/api/rooms')), true);
});
