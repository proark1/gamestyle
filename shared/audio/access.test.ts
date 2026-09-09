import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioAccess, canEditAudio } from './access';

void test('audio editing is closed without a strong configured password and rejects forged origins', async () => {
  const password = 'test-admin-password-123';
  const request = (value = password, origin = 'https://game.example') =>
    new Request('https://game.example/api/audio/stack-or-sink', {
      headers: { 'x-audio-admin': encodeURIComponent(value), origin },
    });
  assert.deepEqual(await audioAccess(request(), ''), {
    configured: false,
    authorized: false,
  });
  assert.equal((await audioAccess(request(), 'short')).authorized, false);
  assert.equal(
    (await audioAccess(request('wrong'), password)).authorized,
    false,
  );
  assert.equal((await audioAccess(request(), password)).authorized, true);
  assert.equal(
    canEditAudio(
      request(password, 'https://evil.example'),
      'https://game.example',
    ),
    false,
  );
  assert.equal(
    (await audioAccess(new Request('https://game.example'), password))
      .authorized,
    false,
  );
});
