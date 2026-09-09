import { createPeerEngine } from '../platform/peer/engine.ts';
import assert from 'node:assert/strict';
import wrtc from '@roamhq/wrtc';
import { handlePeerRoom } from '../shared/peer/coordinator.ts';
import { PeerGameConnection } from '../shared/peer/connection.ts';
import { acquireMesh } from '../shared/peer/mesh.ts';
import { PeerError } from '../shared/peer/types.ts';

Object.assign(globalThis, {
  RTCPeerConnection: wrtc.RTCPeerConnection,
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
    if (reply.view) reply.view.iceServers = [];
    return Response.json(reply, { status: response.status });
  }
  try {
    const reply = await handlePeerRoom(store, JSON.parse(options.body));
    // Test direct connections on this machine without contacting an external STUN service.
    reply.view.iceServers = [];
    return Response.json(reply);
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: error instanceof PeerError ? error.status : 500 },
    );
  }
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(condition, description, timeout = 16000) {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeout)
      throw new Error(`Timed out: ${description}`);
    await pause(40);
  }
}
async function run(game) {
  const sessions = [],
    connections = [],
    leases = [],
    latest = new Map(),
    inputs = [],
    errors = [];
  let sink, track, audioTimer;
  try {
    for (let i = 0; i < 4; i++) {
      const response = await fetch('/api/peer', {
        body: JSON.stringify({
          op: i ? 'join' : 'create',
          game,
          code: sessions[0]?.code,
          name: `Peer ${i + 1}`,
        }),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      assert.equal(response.status, 200, result.error);
      sessions.push(result.session);
      const connection = new PeerGameConnection(
        game,
        result.session,
        () => ({
          x: 0,
          z: 0,
          seq: 0,
          jump: false,
          crouch: false,
          graze: false,
          ...inputs[i],
        }),
        (snapshot) => latest.set(result.session.id, snapshot),
        () => {},
        async () => ({
          createEngine: (now, checkpoint) =>
            createPeerEngine(game, now, checkpoint),
        }),
      );
      connections.push(connection);
      const lease = acquireMesh(result.session);
      leases.push(lease);
      lease.mesh.on('error', (error) => errors.push(error.message));
      connection.start();
    }
    await until(
      () => sessions.every((s) => latest.has(s.id)),
      `four ${game} clients receive real data-channel snapshots; ${JSON.stringify(errors)}`,
    );
    await until(
      () =>
        leases.every(
          (lease) =>
            [...lease.mesh.links.values()].filter(
              (link) => link.channel?.readyState === 'open',
            ).length === 3,
        ),
      'all six peer links open',
    );
    await connections[0].action({ type: 'start' });
    await until(
      () => sessions.every((s) => latest.get(s.id)?.world.phase === 'playing'),
      `${game} start reaches all peers`,
    );
    const started = latest.get(sessions[1].id).world.started;
    let reelRecoveryTarget;
    let siegeRecovery;
    if (game === 'reel-problems') {
      const world = () => latest.get(sessions[1].id).world;
      for (let i = 0; i < 4; i++)
        inputs[i] = { x: 0, z: 0, brace: true, reel: false };
      const monster = world().fish.find((fish) => fish.kind === 'monster');
      await connections[0].action({ type: 'cast', x: monster.x, z: monster.z });
      await until(
        () =>
          world().players.find((p) => p.id === sessions[0].id)?.line?.target ===
          monster.id,
        'captain hooks the monster',
      );
      const target = world().fish.find((fish) => fish.id === monster.id);
      await Promise.all(
        connections
          .slice(1)
          .map((c) => c.action({ type: 'cast', x: target.x, z: target.z })),
      );
      await until(
        () =>
          sessions.every((s) =>
            latest
              .get(s.id)
              .world.players.every((p) => p.line?.target === monster.id),
          ),
        'four independent lines share one fish on every real WebRTC client',
      );
      await until(
        () => {
          const w = world(),
            fish = w.fish.find((f) => f.id === monster.id);
          for (let i = 0; i < 4; i++) {
            const p = w.players.find((p) => p.id === sessions[i].id);
            inputs[i] = {
              x: 0,
              z: 0,
              brace: true,
              reel: !fish.surge && (p.line?.tension ?? 0) < 0.9,
            };
          }
          return sessions.every(
            (s) => latest.get(s.id).world.haul.monster === 1,
          );
        },
        'cooperative monster catch reaches every peer',
        30000,
      );
      for (const s of sessions) {
        const w = latest.get(s.id).world;
        assert.equal(w.score, 100);
        assert.ok(w.players.every((p) => p.catches === 1 && !p.line));
      }
      for (let i = 0; i < 4; i++)
        inputs[i] = { x: 0, z: 0, brace: true, reel: false };
      const w = world();
      const next = w.fish.find(
        (f) =>
          !f.respawnAt &&
          Math.hypot(f.x - w.boat.x, f.z - w.boat.z) > 8 &&
          Math.hypot(f.x - w.boat.x, f.z - w.boat.z) < 19,
      );
      assert.ok(next, 'another reachable fish for host recovery');
      reelRecoveryTarget = next.id;
      await Promise.all(
        connections.map((c) =>
          c.action({ type: 'cast', x: next.x, z: next.z }),
        ),
      );
      await until(
        () =>
          sessions.every((s) =>
            latest
              .get(s.id)
              .world.players.every((p) => p.line?.target === next.id),
          ),
        'all crew hook the next fish before host loss',
      );
      console.log(
        'reel-problems: four shared monster lines, combined reeling, one team score and four catch credits passed over WebRTC.',
      );
    }
    if (game === 'wrong-floor') {
      const { STATIONS } = await import('../games/wrong-floor/types.ts');
      const walk = async (i, x, z) => {
        await until(
          () => {
            const p = latest
              .get(sessions[i].id)
              .world.players.find((p) => p.id === sessions[i].id);
            const dx = x - p.x,
              dz = z - p.z,
              distance = Math.hypot(dx, dz);
            inputs[i] =
              distance < 0.6
                ? { x: 0, z: 0 }
                : { x: dx / distance, z: dz / distance, sprint: true };
            return distance < 0.6;
          },
          `hotel guest ${i} reaches ${x}, ${z}`,
          15000,
        );
      };
      assert.equal(
        new Set(sessions.map((s) => latest.get(s.id).you.station)).size,
        4,
      );
      for (const s of sessions) {
        const v = latest.get(s.id);
        for (const key of ['seed', 'deck', 'plan'])
          assert.equal(key in v.world, false);
        assert.equal(v.you.observation, '');
      }
      await assert.rejects(
        connections[1].action({ type: 'inspect' }),
        /Move closer/,
      );
      await Promise.all(
        sessions.map(async (s, i) => {
          const station = STATIONS[latest.get(s.id).you.station];
          await walk(i, station.x, station.z);
          await connections[i].action({ type: 'inspect' });
        }),
      );
      await until(
        () =>
          sessions.every((s) => latest.get(s.id).you.observation.length > 0),
        'four independent hotel observations',
      );
      for (const s of sessions)
        assert.ok(
          latest.get(s.id).world.players.every((p) => p.report === ''),
          'inspection stays private until reported',
        );
      await Promise.all(connections.map((c) => c.action({ type: 'report' })));
      await until(
        () =>
          sessions.every((s) =>
            latest.get(s.id).world.players.every((p) => p.report),
          ),
        'shared hotel reports reach everyone',
      );
      const haunted = sessions.some((s) => latest.get(s.id).you.anomaly);
      await Promise.all(sessions.map((_, i) => walk(i, 0, -23)));
      for (const c of connections)
        await c.action({
          type: 'vote',
          choice: haunted ? 'advance' : 'retreat',
        });
      await until(
        () => sessions.every((s) => latest.get(s.id).world.phase === 'escape'),
        'wrong majority vote starts the same escape on four clients',
      );
      assert.equal(
        sessions.filter((s) => latest.get(s.id).you.apparition).length,
        1,
        'only one guest sees the pursuer',
      );
      for (let i = 0; i < 4; i++) inputs[i] = { x: 0, z: 1, sprint: true };
      await until(
        () =>
          sessions.every(
            (s) =>
              latest.get(s.id).world.stage === 'travel' &&
              latest.get(s.id).world.phase === 'playing',
          ),
        'crew physically runs back and holds the elevator',
        10000,
      );
      for (let i = 0; i < 4; i++) inputs[i] = { x: 0, z: 0 };
      assert.equal(latest.get(sessions[1].id).world.mistakes, 1);
      assert.equal(latest.get(sessions[1].id).world.cleared, 0);
      await until(
        () => sessions.every((s) => latest.get(s.id).world.stage === 'inspect'),
        'hotel retries the stop with new evidence',
      );
      console.log(
        'wrong-floor: four private inspections, shared reports, wrong vote, single-witness pursuer and live four-person escape passed.',
      );
    }
    if (game === 'one-more-button') {
      await connections[1].action({ type: 'press' });
      await until(
        () => sessions.every((s) => latest.get(s.id)?.world.pot === 500),
        'a guest button press raises the same shared prize on all four clients',
      );
      await connections[2].action({ type: 'stop' });
      await until(
        () =>
          sessions.every((s) =>
            latest.get(s.id)?.world.events.some((e) => e.kind === 'stop'),
          ),
        'STOP reaches the entire crew',
      );
      await pause(2300);
      await connections[0].action({ type: 'press' });
      await until(
        () =>
          sessions.every((s) => {
            const w = latest.get(s.id)?.world;
            return (
              w?.pot === 1250 &&
              w.hazards.length === 2 &&
              w.hazards[1].kind === 'glove'
            );
          }),
        'one more press adds the same boxing glove to every client',
      );
      console.log(
        'one-more-button: guest and host presses, shared prize/hazards, and crew STOP call passed over real WebRTC.',
      );
    }
    if (game === 'siege-and-desist') {
      const world = () => latest.get(sessions[1].id).world;
      // Two guests put their shoulders to the winch; the counterweight is
      // shared state, so every client must watch the same one rise.
      await Promise.all(
        [connections[1], connections[2]].map((c) => c.action({ type: 'wind' })),
      );
      await until(
        () =>
          sessions.every(
            (s) =>
              latest.get(s.id).world.players.filter((p) => p.winding).length ===
              2,
          ),
        'both winders are visible on all four clients',
      );
      await until(
        () => sessions.every((s) => latest.get(s.id).world.wind > 0.2),
        'the shared counterweight rises on every client',
      );
      await Promise.all(
        [connections[1], connections[2]].map((c) =>
          c.action({ type: 'stopWind' }),
        ),
      );
      const held = world().wind;
      // The opening aim is deliberately off-centre; a guest leans it back.
      const opening = world().turn;
      const pusher = world().players.find((p) => p.id === sessions[3].id);
      const expected = pusher.x < 0 ? 1 : -1;
      await connections[3].action({ type: 'push' });
      await until(
        () =>
          sessions.every(
            (s) =>
              Math.sign(latest.get(s.id).world.turn - opening) === expected,
          ),
        'a shoulder on the frame swings the aim the same way for everyone',
      );
      await connections[3].action({ type: 'stopPush' });
      siegeRecovery = { wind: held, turn: world().turn };
      await assert.rejects(
        connections[0].action({ type: 'loose' }),
        /lever/i,
        'nobody can loose from across the field',
      );
      console.log(
        'siege-and-desist: shared winch, swung aim and lever proximity passed over real WebRTC.',
      );
    }
    if (game === 'four-brain-cells') {
      const view = () => latest.get(sessions[1].id).world;
      assert.deepEqual(
        view().players.map((p) => p.limb),
        [0, 1, 2, 3],
      );
      await assert.rejects(
        connections[0].action({ type: 'claim', limb: 1 }),
        /belongs to a friend/,
      );
      const handBefore = view().limbs[0].y;
      inputs[0] = { x: 0, z: 0, lift: 1 };
      await until(
        () => view().limbs[0].y > handBefore + 0.3,
        'left hand input reaches all players',
      );
      inputs[0] = { x: 0, z: 0, lift: 0 };
      assert.equal(
        view().limbs[1].y,
        2,
        'the other player’s hand stays independent',
      );
      inputs[2] = { x: 1, z: 0 };
      inputs[3] = { x: 1, z: 0 };
      await until(
        () => view().robot.x > 1.3,
        'two players walk their shared robot to the table',
      );
      inputs[2] = { x: 0, z: 0 };
      inputs[3] = { x: 0, z: 0 };
      const tableBefore = view().table.x;
      await connections[3].action({ type: 'kick' });
      await until(
        () => view().table.x > tableBefore + 0.3,
        'right foot kick moves the shared breakfast table',
      );
      assert.ok(
        view().events.some(
          (event) => event.kind === 'kick' && event.limb === 3,
        ),
      );
      console.log(
        'four-brain-cells: independent limb inputs, exclusive ownership, coordinated walking, and attributed table kicks passed over real WebRTC.',
      );
    }
    if (game === 'act-natural') {
      const view = latest.get(sessions[2].id);
      assert.ok(view.you.cowId);
      assert.equal('farmerId' in view.world, false);
      assert.equal('cowRoutines' in view.world, false);
    }
    let audioFrames = 0;
    const source = new wrtc.nonstandard.RTCAudioSource();
    track = source.createTrack();
    await leases[1].mesh.microphone(track);
    await until(
      () => leases[2].mesh.tracks.has(sessions[1].id),
      'remote voice track',
    );
    sink = new wrtc.nonstandard.RTCAudioSink(
      leases[2].mesh.tracks.get(sessions[1].id),
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
      'voice samples cross the direct peer connection',
    );
    const voiceLink = leases[1].mesh.links.get(sessions[2].id).pc;
    const framesBefore = audioFrames;
    // Crash the original host without sending leave or a final checkpoint.
    connections[0].stop();
    leases[0].release();
    await until(
      () =>
        sessions
          .slice(1)
          .every((s) => latest.get(s.id)?.host === sessions[1].id),
      `${game} abrupt host recovery`,
      18000,
    );
    assert.equal(latest.get(sessions[1].id).world.started, started);
    if (game === 'reel-problems') {
      await until(
        () =>
          sessions.slice(1).every((s) => {
            const w = latest.get(s.id).world;
            return (
              w.players.length === 3 &&
              w.players.every((p) => p.line?.target === reelRecoveryTarget)
            );
          }),
        'remaining three fish lines survive an abrupt host loss',
      );
      const w = latest.get(sessions[1].id).world;
      assert.equal(w.score, 100);
      assert.ok(w.weather.until > w.clock);
      assert.equal(w.wildlife.length, 3);
    }
    if (game === 'one-more-button') {
      assert.equal(latest.get(sessions[1].id).world.pot, 1250);
      assert.equal(latest.get(sessions[1].id).world.hazards.length, 2);
    }
    if (game === 'siege-and-desist') {
      const w = latest.get(sessions[1].id).world;
      assert.ok(
        Math.abs(w.wind - siegeRecovery.wind) < 0.05,
        'the wound counterweight survives the host handover',
      );
      assert.ok(
        Math.abs(w.turn - siegeRecovery.turn) < 0.02,
        'the swung aim survives the host handover',
      );
      // Snapshots carry only moved masonry, so the castle's size is asserted
      // through the count each client rebuilds its local baseline from.
      assert.ok(w.totalBlocks > 50, 'the castle survives the host handover');
    }
    assert.equal(
      leases[1].mesh.links.get(sessions[2].id).pc,
      voiceLink,
      'Surviving voice links stay connected during election',
    );
    assert.ok(
      audioFrames > framesBefore + 10,
      'Voice continues while the game host changes',
    );
    const framesAfter = audioFrames;
    await until(
      () => audioFrames > framesAfter + 5,
      'voice continues after recovery',
    );
    clearInterval(audioTimer);
    audioTimer = undefined;
    track.stop();
    track = undefined;
    sink.stop();
    sink = undefined;
    const handoffAt = Date.now();
    await connections[1].leave();
    await until(
      () =>
        sessions
          .slice(2)
          .every((s) => latest.get(s.id)?.host === sessions[2].id),
      `${game} graceful second handover`,
      6000,
    );
    assert.equal(latest.get(sessions[2].id).world.started, started);
    console.log(
      `${game}: 4 real WebRTC clients, direct audio, abrupt recovery, preserved round, surviving voice links, and join-order handover (${Date.now() - handoffAt} ms graceful) passed.`,
    );
  } catch (error) {
    console.error(
      `${game} diagnostics:`,
      JSON.stringify(
        {
          errors: errors.slice(-8),
          clients: leases.map((lease, i) => ({
            received: latest.has(sessions[i].id),
            restoring: connections[i].restoring,
            simulation: connections[i].engine
              ? {
                  seq: connections[i].engine.seq,
                  phase: connections[i].engine.world.phase,
                }
              : null,
            host: lease.mesh.view?.host,
            epoch: lease.mesh.view?.epoch,
            links: [...lease.mesh.links.values()].map((link) => ({
              state: link.pc.connectionState,
              channel: link.channel?.readyState,
              signalling: link.pc.signalingState,
            })),
          })),
        },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    clearInterval(audioTimer);
    track?.stop();
    sink?.stop();
    for (const connection of connections) connection.stop();
    for (const lease of leases) lease.release();
  }
}
try {
  assert.ok(process.argv[2], 'Pass the game to test');
  await run(process.argv[2]);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  setTimeout(() => process.exit(process.exitCode || 0), 500);
}
