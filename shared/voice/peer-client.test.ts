import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceClient } from './peer-client';

function setup(t: TestContext, getUserMedia: () => Promise<MediaStream>) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia } },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous);
    else Reflect.deleteProperty(globalThis, 'navigator');
  });
  const client = new VoiceClient(
    {
      game: 'stack-or-sink',
      code: 'ABCDEF',
      id: 'me',
      token: 'test',
      peer: true,
    },
    () => {},
  );
  const published: (MediaStreamTrack | null)[] = [];
  (client as unknown as { mesh: unknown }).mesh = {
    microphone: async (track: MediaStreamTrack | null) => {
      published.push(track);
    },
  };
  client.state.connected = true;
  return { client, published };
}
function audio() {
  const track = {
    enabled: true,
    stopped: false,
    onended: null,
    stop() {
      this.stopped = true;
    },
  };
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
  return { track, stream };
}
void test('prepared push-to-talk stays silent and reuses one microphone for repeated holds', async (t) => {
  const { track, stream } = audio();
  let acquisitions = 0;
  const { client } = setup(t, async () => {
    acquisitions++;
    return stream;
  });
  assert.equal(await client.prepareMicrophone(), true);
  assert.equal(track.enabled, false);
  assert.equal(client.state.mic, false);
  for (let i = 0; i < 3; i++) {
    await client.setTalking(true);
    assert.equal(track.enabled, true);
    const release = client.setTalking(false);
    assert.equal(track.enabled, false, 'release silences synchronously');
    await release;
  }
  assert.equal(acquisitions, 1);
  await client.microphone(false);
  assert.equal(track.stopped, true);
  await client.setTalking(true);
  assert.equal(client.state.mic, false);
  await client.dispose();
});
void test('leaving during push-to-talk preparation stops the late microphone', async (t) => {
  const { track, stream } = audio();
  let finish!: (stream: MediaStream) => void;
  const { client, published } = setup(
    t,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const preparation = client.prepareMicrophone();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await client.dispose();
  finish(stream);
  assert.equal(await preparation, false);
  assert.equal(track.stopped, true);
  assert.ok(published.every((value) => value === null));
});
void test('peer push-to-talk release before permission returns never publishes the microphone', async (t) => {
  const { track, stream } = audio();
  let finish!: (stream: MediaStream) => void;
  const { client, published } = setup(
    t,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const enabling = client.microphone(true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  const disabling = client.microphone(false);
  finish(stream);
  await Promise.all([enabling, disabling]);
  assert.ok(track.stopped);
  assert.ok(published.every((value) => value === null));
  assert.equal(client.state.mic, false);
  await client.dispose();
});
void test('leaving peer voice during permission stops the eventual track without publishing it', async (t) => {
  const { track, stream } = audio();
  let finish!: (stream: MediaStream) => void;
  const { client, published } = setup(
    t,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const enabling = client.microphone(true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  await client.dispose();
  finish(stream);
  await enabling;
  assert.ok(track.stopped);
  assert.ok(published.every((value) => value === null));
  assert.equal(client.state.connected, false);
});
void test('a failed microphone change stops the old microphone and keeps listening available', async (t) => {
  const { track, stream } = audio();
  let calls = 0;
  const { client, published } = setup(t, async () => {
    if (++calls > 1) throw new Error('Device unavailable');
    return stream;
  });
  await client.microphone(true);
  assert.equal(client.state.mic, true);
  await client.microphone(true, 'missing-device');
  assert.equal(track.stopped, true);
  assert.equal(published.at(-1), null);
  assert.equal(client.state.mic, false);
  assert.equal(client.state.connected, true);
  assert.match(client.state.error!, /still listen/);
  await client.dispose();
});
