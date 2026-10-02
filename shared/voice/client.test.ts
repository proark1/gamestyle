import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceClient } from './client';
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
    peers: new Map([['other', { gain: { gain: level }, record }]]),
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
void test('releasing push-to-talk during microphone permission prevents late publication', async () => {
  const client = new VoiceClient(
    { game: 'stack-or-sink', code: 'ABCDEF', id: 'me', token: 'fake' },
    () => {},
  );
  const calls: boolean[] = [];
  let finish!: () => void;
  const permission = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const room = {
    localParticipant: {
      async setMicrophoneEnabled(v: boolean) {
        calls.push(v);
        if (v) await permission;
      },
      getTrackPublication: () => undefined,
    },
    disconnect: async () => {},
  };
  (client as unknown as { room: unknown }).room = room;
  client.state.connected = true;
  const enabling = client.microphone(true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  const disabling = client.microphone(false);
  finish();
  await Promise.all([enabling, disabling]);
  assert.deepEqual(calls, [true, false, false]);
  assert.equal(client.state.mic, false);
  await client.dispose();
});
void test('leaving while permission is pending switches the microphone back off on the original room', async () => {
  const client = new VoiceClient(
    { game: 'act-natural', code: 'ABCDEF', id: 'me', token: 'fake' },
    () => {},
  );
  const calls: boolean[] = [];
  let finish!: () => void;
  const permission = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const room = {
    localParticipant: {
      async setMicrophoneEnabled(v: boolean) {
        calls.push(v);
        if (v) await permission;
      },
    },
    disconnect: async () => {},
  };
  (client as unknown as { room: unknown }).room = room;
  client.state.connected = true;
  const enabling = client.microphone(true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  await client.dispose();
  finish();
  await enabling;
  assert.deepEqual(calls, [true, false]);
  assert.equal(client.state.mic, false);
});
void test('releasing talk during a device switch never enables the new microphone', async () => {
  const client = new VoiceClient(
    { game: 'uphill-delivery', code: 'ABCDEF', id: 'me', token: 'fake' },
    () => {},
  );
  let finish!: () => void;
  const switching = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const calls: boolean[] = [];
  const mediaStreamTrack = { enabled: true };
  const room = {
    switchActiveDevice: () => switching,
    localParticipant: {
      setMicrophoneEnabled: async (enabled: boolean) => {
        calls.push(enabled);
      },
      getTrackPublication: () => ({ track: { mediaStreamTrack } }),
    },
    disconnect: async () => {},
  };
  (client as unknown as { room: unknown }).room = room;
  client.state.connected = true;
  const enabling = client.microphone(true, 'other-device');
  await new Promise<void>((resolve) => setImmediate(resolve));
  const disabling = client.microphone(false);
  assert.equal(
    mediaStreamTrack.enabled,
    false,
    'Mute takes effect without waiting for device access',
  );
  finish();
  await Promise.all([enabling, disabling]);
  assert.deepEqual(calls, [false]);
  assert.equal(client.state.mic, false);
  await client.dispose();
});
void test('permission denial leaves listening connected and offers a recovery action', async () => {
  const client = new VoiceClient(
    { game: 'dont-wake-the-giant', code: 'ABCDEF', id: 'me', token: 'fake' },
    () => {},
  );
  (client as unknown as { room: unknown }).room = {
    localParticipant: {
      setMicrophoneEnabled: async () => {
        throw new DOMException('Denied', 'NotAllowedError');
      },
    },
    disconnect: async () => {},
  };
  client.state.connected = true;
  await client.microphone(true);
  assert.equal(client.state.connected, true);
  assert.equal(client.state.mic, false);
  assert.match(client.state.error!, /browser settings/);
  await client.dispose();
  assert.equal(client.state.connected, false);
});
