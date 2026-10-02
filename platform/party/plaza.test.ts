import test from 'node:test';
import assert from 'node:assert/strict';
import type { RoomStore, Row } from '../../shared/rooms/types';
import {
  createPartyRoom,
  joinPartyRoom,
  updateLobbyPresence,
  toggleReady,
  startPartyTournament,
} from './coordinator';
import {
  boundedPose,
  nearestStation,
  spawnPose,
  validPose,
} from '../../shared/plaza/world';

void test('plaza positions are finite and bounded, with reachable shop entrances', () => {
  assert.equal(validPose({ x: NaN, z: 0, angle: 0 }), false);
  assert.equal(validPose({ x: 0, z: 0, angle: Infinity }), false);
  assert.deepEqual(boundedPose({ x: -100, z: -100, angle: 0 }), {
    x: -8,
    z: -2.5,
    angle: 0,
  });
  assert.equal(nearestStation({ x: -5.6, z: -1, angle: 0 })?.id, 'hats');
  assert.equal(nearestStation(spawnPose(0)), null);
});

void test('shop presence gates readiness, clamps teleporting, and keeps account bindings private', async () => {
  const rows = new Map<string, Row>();
  const store: RoomStore = {
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
  const host = await createPartyRoom(store, 'Host', 0, 1000);
  const code = host.state.code;
  const guest = await joinPartyRoom(store, code, 'Guest', 0, 1000);
  const pass = { id: guest.playerId, token: guest.token };
  const hostPass = { id: host.playerId, token: host.token };
  await toggleReady(store, code, pass, true, 1000);
  const presence = {
    pose: { x: 100, z: 100, angle: 0 },
    browsing: true,
    look: { hat: 'party-cone' },
    fullGame: false,
    accountId: 'private-account-id',
  };
  const room = await updateLobbyPresence(store, code, pass, presence, 1350);
  const player = room.players.find((p) => p.id === pass.id)!;
  assert.equal(player.ready, false);
  assert.equal(player.browsing, true);
  assert.equal('accounts' in room, false);
  assert.ok(!JSON.stringify(room).includes('private-account-id'));
  assert.equal(
    JSON.parse(rows.get(`party:${code}`)!.state).accounts[pass.id],
    'private-account-id',
  );
  const origin = spawnPose(player.color);
  assert.ok(
    Math.hypot(
      player.lobbyPose!.x - origin.x,
      player.lobbyPose!.z - origin.z,
    ) <= 1.701,
  );
  await assert.rejects(toggleReady(store, code, pass, true, 1400));
  await assert.rejects(startPartyTournament(store, code, hostPass, 1400));
  await assert.rejects(
    updateLobbyPresence(
      store,
      code,
      { ...pass, token: 'wrong' },
      presence,
      1400,
    ),
  );
  await updateLobbyPresence(
    store,
    code,
    pass,
    { ...presence, browsing: false },
    1500,
  );
  await toggleReady(store, code, pass, true, 1600);
  assert.equal(
    (await startPartyTournament(store, code, hostPass, 1700)).status,
    'briefing',
  );
});
