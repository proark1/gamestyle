import { compatibility } from '../../../shared/peer/protocol.ts';
import assert from 'node:assert/strict';
import wrtc from '@roamhq/wrtc';
import { handlePeerRoom } from '../../../shared/peer/coordinator.ts';
import { PeerGameConnection } from '../../../shared/peer/connection.ts';
import { acquireMesh } from '../../../shared/peer/mesh.ts';
import { PeerError } from '../../../shared/peer/types.ts';

// The Windows native test binding can expose an uninitialized fractional
// sdpMLineIndex. Keep the valid sdpMid; browsers do not exhibit this binding bug.
class TestPeerConnection extends wrtc.RTCPeerConnection {
  constructor(configuration) {
    super(configuration);
    this.addEventListener('icecandidate', ({ candidate }) => {
      if (
        candidate &&
        candidate.sdpMid != null &&
        (!Number.isInteger(candidate.sdpMLineIndex) ||
          candidate.sdpMLineIndex < 0 ||
          candidate.sdpMLineIndex > 65535)
      ) {
        candidate.sdpMLineIndex = null;
      }
    });
  }
}

Object.assign(globalThis, {
  RTCPeerConnection: TestPeerConnection,
  RTCSessionDescription: wrtc.RTCSessionDescription,
  RTCIceCandidate: wrtc.RTCIceCandidate,
  MediaStream: wrtc.MediaStream,
});
const rows = new Map();
const store = {
  get: async (code) => (rows.has(code) ? { ...rows.get(code) } : null),
  insert: async (row) => {
    if (rows.has(row.code)) return false;
    rows.set(row.code, { ...row });
    return true;
  },
  compareAndSwap: async (row, version) => {
    if (rows.get(row.code)?.version !== version) return false;
    rows.set(row.code, { ...row });
    return true;
  },
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  assert.equal(
    url,
    '/api/peer',
    'Game frames and voice must never use a server simulation or LiveKit endpoint',
  );
  if (process.env.PEER_TEST_URL) {
    const origin = new URL(process.env.PEER_TEST_URL).origin;
    const headers = new Headers(options.headers);
    headers.set('Origin', origin);
    const response = await originalFetch(new URL(url, origin), {
      ...options,
      headers,
    });
    const reply = await response.json();
    if (reply.view && process.env.PEER_RELAY_ONLY !== '1')
      reply.view.iceServers = [];
    return Response.json(reply, { status: response.status });
  }
  try {
    const reply = await handlePeerRoom(store, JSON.parse(options.body));
    // Test direct connections on this machine without contacting an external STUN service.
    if (process.env.PEER_RELAY_ONLY !== '1') reply.view.iceServers = [];
    return Response.json(reply);
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: error instanceof PeerError ? error.status : 500 },
    );
  }
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(condition, description, timeout = 30000) {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeout)
      throw new Error(`Timed out: ${description}`);
    await pause(40);
  }
}

const { createEngine } = await import('../peer.ts');
const { commitment, newNonce } = await import('../selection.ts');
const game = 'cage-clash',
  sessions = [],
  connections = [],
  leases = [],
  latest = new Map(),
  inputs = [
    { x: 0, z: 0 },
    { x: 0, z: 0 },
  ];
let audioTimer, sink, track;
try {
  for (let i = 0; i < 2; i++) {
    const response = await fetch('/api/peer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...compatibility(game),
        op: i ? 'join' : 'create',
        game,
        code: sessions[0]?.code,
        name: `Fighter ${i + 1}`,
      }),
    });
    const result = await response.json();
    assert.equal(response.status, 200, result.error);
    sessions.push(result.session);
    const connection = new PeerGameConnection(
      game,
      result.session,
      () => inputs[i],
      (s) => latest.set(result.session.id, s),
      () => {},
      async () => ({ createEngine }),
    );
    connections.push(connection);
    leases.push(acquireMesh(result.session));
    connection.start();
  }
  await until(
    () =>
      sessions.every((s) => latest.has(s.id)) &&
      leases.every((l) =>
        [...l.mesh.links.values()].some(
          (link) => link.channel?.readyState === 'open',
        ),
      ),
    'two data channels open',
  );
  await until(
    () =>
      sessions.every((s) =>
        latest.get(s.id).world.players.every((p) => !p.bot),
      ),
    'both human seats',
  );
  const selection = latest.get(sessions[0].id).world.selection;
  const secrets = [
    { style: 'boxer', nonce: newNonce() },
    { style: 'jiu-jitsu', nonce: newNonce() },
  ];
  await connections[0].action({
    type: 'commit',
    selection,
    commitment: commitment(
      selection,
      sessions[0].id,
      secrets[0].style,
      secrets[0].nonce,
    ),
  });
  await until(
    () => latest.get(sessions[1].id).world.players.some((p) => p.commitment),
    'guest sees lock',
  );
  assert.ok(
    latest.get(sessions[1].id).world.players.every((p) => p.style === null),
  );
  await connections[1].action({
    type: 'commit',
    selection,
    commitment: commitment(
      selection,
      sessions[1].id,
      secrets[1].style,
      secrets[1].nonce,
    ),
  });
  await until(
    () =>
      sessions.every((s) =>
        latest.get(s.id).world.players.every((p) => p.commitment),
      ),
    'both locks synchronized',
  );
  for (let i = 0; i < 2; i++)
    await connections[i].action({ type: 'reveal', selection, ...secrets[i] });
  await until(
    () => sessions.every((s) => latest.get(s.id).world.phase === 'playing'),
    'fight starts on both clients',
  );
  for (const session of sessions)
    assert.deepEqual(
      latest.get(session.id).world.players.map((p) => p.style),
      ['boxer', 'jiu-jitsu'],
    );
  const started = latest.get(sessions[1].id).world.started;
  let audioFrames = 0;
  const source = new wrtc.nonstandard.RTCAudioSource();
  track = source.createTrack();
  await leases[0].mesh.microphone(track);
  await until(
    () => leases[1].mesh.tracks.has(sessions[0].id),
    'remote voice track',
  );
  sink = new wrtc.nonstandard.RTCAudioSink(
    leases[1].mesh.tracks.get(sessions[0].id),
  );
  sink.ondata = (data) => {
    if (data.samples.some((n) => Math.abs(n) > 200)) audioFrames++;
  };
  let offset = 0;
  audioTimer = setInterval(() => {
    const samples = Int16Array.from({ length: 480 }, (_, i) =>
      Math.round(Math.sin(((offset + i) * Math.PI * 2 * 440) / 48000) * 5000),
    );
    offset += 480;
    source.onData({
      samples,
      sampleRate: 48000,
      bitsPerSample: 16,
      channelCount: 1,
      numberOfFrames: 480,
    });
  }, 10);
  await until(
    () => audioFrames > 5,
    'voice samples cross the direct connection',
  );
  clearInterval(audioTimer);
  audioTimer = undefined;
  sink.stop();
  sink = undefined;
  track.stop();
  track = undefined;
  inputs[0] = { x: 1, z: 0 };
  inputs[1] = { x: -1, z: 0 };
  await until(() => {
    const [a, b] = latest.get(sessions[1].id).world.players;
    return Math.abs(a.x - b.x) < 1.3;
  }, 'opponents approach');
  inputs[0] = { x: 0, z: 0, punch: true };
  inputs[1] = { x: 0, z: 0 };
  await pause(150);
  inputs[0] = { x: 0, z: 0 };
  await until(
    () =>
      sessions.every((s) =>
        latest.get(s.id).world.players.some((p) => p.health < 100),
      ),
    'strike damage crosses data channels',
  );
  await until(() => {
    const players = latest.get(sessions[1].id).world.players;
    const a = players.find((p) => p.id === sessions[0].id),
      b = players.find((p) => p.id === sessions[1].id);
    const dx = a.x - b.x,
      dz = a.z - b.z,
      d = Math.hypot(dx, dz);
    inputs[1] = { x: d > 1 ? dx / d : 0, z: d > 1 ? dz / d : 0 };
    return d <= 1;
  }, 'guest closes into grappling range');
  await pause(250);
  inputs[1] = { x: 0, z: 0, grapple: true };
  await until(
    () =>
      sessions.every((s) => latest.get(s.id).world.grapple?.mode === 'guard'),
    'guest takedown synchronized',
  );
  inputs[1] = { x: 0, z: 0, guard: true };
  inputs[0] = { x: 0, z: 0, guard: true };
  await pause(1800); // Let the normal recovery checkpoint include the ground position.
  const before = latest.get(sessions[1].id).world;
  assert.equal(before.grapple.mode, 'guard');
  connections[0].stop();
  leases[0].release();
  await until(
    () => latest.get(sessions[1].id)?.host === sessions[1].id,
    'abrupt host election',
    20000,
  );
  const after = latest.get(sessions[1].id).world;
  assert.equal(after.started, started);
  assert.equal(after.players.length, 2);
  assert.equal(
    after.players.find((p) => p.id === sessions[1].id).style,
    'jiu-jitsu',
  );
  assert.ok(after.players.some((p) => p.health < 100));
  await until(
    () => latest.get(sessions[1].id).world.players.some((p) => p.bot),
    'departed host becomes a bot',
    20000,
  );
  console.log(
    'PASS: two real WebRTC clients, hidden selection, simultaneous reveal, direct voice audio, strike damage, guest takedown, abrupt host recovery and bot replacement.',
  );
} catch (error) {
  console.error(
    'Fight state:',
    JSON.stringify(
      [...latest.values()].map((s) => ({
        phase: s.world.phase,
        grapple: s.world.grapple,
        players: s.world.players.map((p) => ({
          id: p.id,
          x: p.x,
          z: p.z,
          attack: p.attack,
          move: p.move,
          cooldown: p.cooldown,
          input: p.input,
        })),
      })),
    ),
  );
  console.error(error);
  process.exitCode = 1;
} finally {
  clearInterval(audioTimer);
  sink?.stop();
  track?.stop();
  for (const c of connections) c.stop();
  for (const l of leases) l.release();
  globalThis.fetch = originalFetch;
  setTimeout(() => process.exit(process.exitCode || 0), 500);
}
