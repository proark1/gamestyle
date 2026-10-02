import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nativeApiUrl } from './api-fetch';
void test('installed API routing leaves bundled assets and third-party URLs untouched', () => {
  assert.equal(
    nativeApiUrl('/api/peer', 'https://www.jumbleyard.com'),
    'https://www.jumbleyard.com/api/peer',
  );
  assert.equal(
    nativeApiUrl('/audio/music.wav', 'https://www.jumbleyard.com'),
    '/audio/music.wav',
  );
  assert.equal(
    nativeApiUrl('https://media.example/clip', 'https://www.jumbleyard.com'),
    'https://media.example/clip',
  );
  assert.throws(() => nativeApiUrl('/api/peer', 'http://untrusted.test'));
  assert.throws(() =>
    nativeApiUrl('/api/peer', 'https://user:secret@untrusted.test'),
  );
});
