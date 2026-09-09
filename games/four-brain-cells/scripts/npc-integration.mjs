import assert from 'node:assert/strict';
import wrtc from '@roamhq/wrtc';
import { handlePeerRoom } from '../../../shared/peer/coordinator.ts';
import { PeerGameConnection } from '../../../shared/peer/connection.ts';
import { acquireMesh } from '../../../shared/peer/mesh.ts';
import { PeerError } from '../../../shared/peer/types.ts';
import { createEngine } from '../peer.ts';

Object.assign(globalThis, {
  RTCPeerConnection: wrtc.RTCPeerConnection,
  RTCSessionDescription: wrtc.RTCSessionDescription,
  RTCIceCandidate: wrtc.RTCIceCandidate,
  MediaStream: wrtc.MediaStream,
});
// The Windows native test binding can emit a fractional sdpMLineIndex on its
// first candidate. This harness negotiates audio (mid 0) and data (mid 1),
// so recover that index from its valid media ID before sending the candidate.
// Production signal validation remains strict; browsers do not use this shim.
const rows = new Map();
const store = {
  get: async (code) => rows.get(code) ?? null,
  insert: async (row) => {
    if (rows.has(row.code)) return false;
    rows.set(row.code, row);
    return true;
  },
  compareAndSwap: async (row, version) => {
    if (rows.get(row.code)?.version !== version) return false;
    rows.set(row.code, row);
    return true;
  },
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  assert.equal(url, '/api/peer');
  const body = JSON.parse(options.body);
  for (const signal of body.signals ?? []) {
    const c = signal.candidate;
    if (
      c &&
      ['0', '1'].includes(c.sdpMid) &&
      (!Number.isInteger(c.sdpMLineIndex) ||
        c.sdpMLineIndex < 0 ||
        c.sdpMLineIndex > 65535)
    )
      c.sdpMLineIndex = Number(c.sdpMid);
  }
  options = { ...options, body: JSON.stringify(body) };
  if (process.env.PEER_TEST_URL) {
    const origin = new URL(process.env.PEER_TEST_URL).origin;
    const headers = new Headers(options.headers);
    headers.set('Origin', origin);
    const response = await originalFetch(new URL(url, origin), {
      ...options,
      headers,
    });
    const reply = await response.json();
    if (reply.view) reply.view.iceServers = [];
    return Response.json(reply, { status: response.status });
  }
  try {
    const reply = await handlePeerRoom(store, JSON.parse(options.body));
    reply.view.iceServers = [];
    return Response.json(reply);
  } catch (e) {
    return Response.json(
      { error: e.message },
      { status: e instanceof PeerError ? e.status : 500 },
    );
  }
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(condition, label, timeout = 18000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error(`Timed out: ${label}`);
    await pause(40);
  }
}
const sessions = [],
  connections = [],
  leases = [],
  latest = new Map(),
  inputs = [];
const request = async (body) => {
  const response = await fetch('/api/peer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game: 'four-brain-cells', ...body }),
  });
  const reply = await response.json();
  return { response, reply };
};
async function join() {
  const { response, reply } = await request({
    op: sessions.length ? 'join' : 'create',
    code: sessions[0]?.code,
    name: `Human ${sessions.length + 1}`,
  });
  assert.equal(response.status, 200, reply.error);
  const i = sessions.length,
    s = reply.session;
  sessions.push(s);
  const c = new PeerGameConnection(
    'four-brain-cells',
    s,
    () => ({
      x: 0,
      z: 0,
      lift: 0,
      seq: 0,
      use: false,
      steady: false,
      ...inputs[i],
    }),
    (v) => latest.set(s.id, v),
    () => {},
    async () => ({ createEngine }),
  );
  connections.push(c);
  leases.push(acquireMesh(s));
  leases
    .at(-1)
    .mesh.on('error', (error) => console.error('Peer error:', error.message));
  c.start();
  await until(() => latest.has(s.id), `human ${i + 1} receives snapshots`);
}
try {
  await join();
  const view = () => latest.get(sessions[0].id).world;
  await connections[0].manageNpcs({ type: 'add-npc', slot: 1 });
  await until(
    () => view().players.filter((p) => p.bot).length === 1,
    'one NPC appears',
  );
  await connections[0].manageNpcs({ type: 'fill-npcs' });
  await until(() => view().players.length === 4, 'fill produces three NPCs');
  const blocked = await request({ op: 'join', code: sessions[0].code });
  assert.equal(blocked.response.ok, false, 'NPCs occupy real seats');
  const replacing = view().players.find((p) => p.color === 2);
  await connections[0].manageNpcs({ type: 'remove-npc', target: replacing.id });
  await join();
  await until(
    () => sessions.every((s) => latest.get(s.id).world.players.length === 4),
    'two humans and two NPCs share a robot',
  );
  await assert.rejects(
    connections[1].manageNpcs({ type: 'fill-npcs' }),
    /leader|host/i,
  );
  const guest = () => latest.get(sessions[1].id).world;
  assert.equal(guest().players.find((p) => p.id === sessions[1].id).limb, 2);
  const bots = guest()
    .players.filter((p) => p.bot)
    .map((p) => p.id)
    .sort();
  assert.equal(
    leases[1].mesh.view.members.length,
    2,
    'NPCs never become voice or network peers',
  );
  await connections[0].action({ type: 'start' });
  await until(() => guest().phase === 'playing', 'round starts');
  const started = guest().started;
  await until(
    () => guest().utensils[1].held === 1,
    'NPC hand physically reaches and grabs the coffee pot',
  );
  await until(
    () => {
      const w = guest(),
        dx = w.table.x - 1.65 - w.robot.x,
        dz = w.table.z + 1.55 - w.robot.z,
        d = Math.hypot(dx, dz);
      inputs[1] = {
        x: d > 0.2 ? dx / Math.max(1, d) : 0,
        z: d > 0.2 ? dz / Math.max(1, d) : 0,
        steady: true,
      };
      return w.coffee > 0.2;
    },
    'human foot and NPC foot carry the NPC hand to pour real coffee',
    30000,
  );
  inputs[1] = { x: 0, z: 0 };
  await assert.rejects(
    connections[0].manageNpcs({ type: 'remove-npc', target: bots[0] }),
    /Finish/,
  );
  await pause(1600);
  connections[0].stop();
  leases[0].release();
  await until(
    () => latest.get(sessions[1].id).host === sessions[1].id,
    'NPC crew recovers after host crash',
  );
  assert.equal(guest().started, started);
  assert.deepEqual(
    guest()
      .players.filter((p) => p.bot)
      .map((p) => p.id)
      .sort(),
    bots,
  );
  assert.ok(guest().coffee > 0.2, 'checkpoint preserves the served coffee');
  const foot = guest().players.find((p) => p.bot && p.limb === 3),
    steps = foot.steps;
  inputs[1] = { x: -1, z: 0, steady: true };
  await until(
    () => guest().players.find((p) => p.id === foot.id).steps > steps,
    'NPC foot continues after host recovery',
  );
  console.log(
    'Four Brain Cells NPCs: per-slot add, fill, remove, capacity, guest restrictions, physical coffee service, real WebRTC replication and abrupt host recovery passed.',
  );
} catch (e) {
  console.error(e);
  console.error(
    JSON.stringify(
      leases.map((lease, i) => ({
        received: latest.has(sessions[i].id),
        restoring: connections[i].restoring,
        phase: connections[i].engine?.world.phase,
        players: connections[i].engine?.world.players.map((p) => ({
          id: p.id,
          limb: p.limb,
          bot: p.bot,
        })),
        view: {
          host: lease.mesh.view?.host,
          members: lease.mesh.view?.members,
          npcs: lease.mesh.view?.npcs,
        },
        links: [...lease.mesh.links.values()].map((l) => ({
          state: l.pc.connectionState,
          channel: l.channel?.readyState,
          signaling: l.pc.signalingState,
        })),
      })),
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  for (const c of connections) c.stop();
  for (const lease of leases) lease.release();
  globalThis.fetch = originalFetch;
  setTimeout(() => process.exit(process.exitCode || 0), 500);
}
