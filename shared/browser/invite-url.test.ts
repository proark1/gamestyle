import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inviteTarget } from './invite-url';
void test('native and HTTPS invites preserve game and room', () => {
  for (const origin of ['jumbleyard:/', 'https://www.jumbleyard.com'])
    assert.equal(
      inviteTarget(`${origin}/stack-or-sink?room=ABCDEF`),
      '/stack-or-sink?room=ABCDEF',
    );
  assert.equal(inviteTarget('jumbleyard://room/ABCDEF'), '/?room=ABCDEF');
  assert.equal(
    inviteTarget('https://www.jumbleyard.com/party?code=ABCDEF'),
    '/party?code=ABCDEF',
  );
});
void test('untrusted hosts, schemes and unknown routes cannot navigate the native shell', () => {
  for (const value of [
    'javascript:alert(1)',
    'https://evil.test/stack-or-sink',
    'jumbleyard://admin',
    'jumbleyard://stack-or-sink/extra',
    'bad',
  ])
    assert.equal(inviteTarget(value), null);
});
