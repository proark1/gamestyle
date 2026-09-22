import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceClient } from './peer-client';
void test('shared voice preserves proximity, radio override, and recording consent', () => {
  const client = new VoiceClient(
    { game: 'chaos', code: 'ABCDEF', id: 'me', token: 'test' },
    () => {},
  );
  const level = {
    value: 1,
    setTargetAtTime(value: number) {
      this.value = value;
    },
  };
  const record = { gain: { value: 0 } };
  const self = { gain: { value: 0 } };
  Object.assign(client, {
    context: { currentTime: 0 },
    peers: new Map([
      [
        'other',
        {
          gain: { gain: level },
          record,
          values: new Uint8Array(32),
          analyser: {
            getByteTimeDomainData: (values: Uint8Array) => values.fill(128),
          },
        },
      ],
    ]),
    selfRecord: self,
  });
  const snapshot = {
    players: [
      { id: 'me', name: 'Me', x: 0, z: 0 },
      { id: 'other', name: 'Other', x: 30, z: 0 },
    ],
    nearby: false,
    proximity: { active: true, radio: {} as Record<string, boolean> },
    audioConsent: [] as string[],
  };
  client.update(snapshot);
  assert.equal(level.value, 0, 'distant players are quiet');
  client.capture(true);
  assert.equal(
    record.gain.value,
    0,
    'capture excludes players without consent',
  );
  snapshot.proximity.radio.other = true;
  snapshot.audioConsent = ['other', 'me'];
  client.state.mic = true;
  client.update(snapshot);
  assert.equal(level.value, 1, 'radio bypasses distance');
  assert.equal(record.gain.value, 1);
  assert.equal(self.gain.value, 1);
  snapshot.audioConsent = [];
  client.update(snapshot);
  assert.equal(
    record.gain.value,
    0,
    'revoking consent immediately closes the recording path',
  );
  assert.equal(self.gain.value, 0);
  client.deafen(true);
  assert.equal(level.value, 0);
});
