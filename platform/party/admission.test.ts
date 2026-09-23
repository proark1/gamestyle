import test from 'node:test';
import assert from 'node:assert/strict';
import type { Row, RoomStore } from '../../shared/rooms/types';
import { hasGameAccess } from '../../shared/commerce/catalog';
import {
  createPartyRoom,
  joinPartyRoom,
  startPartyTournament,
  toggleReady,
  updateLobbyPresence,
  partyPlayerAction,
} from './coordinator';
import { partyGameSession } from './game-session';
import { voteCandidates } from './intermission';

function storeFixture() {
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
  return { rows, store };
}

void test('mixed ownership only schedules and offers shared free games', async () => {
  const { store } = storeFixture();
  const host = await createPartyRoom(store, 'Host', 0, 1000);
  const guest = await joinPartyRoom(store, host.state.code, 'Guest', 1, 1000);
  await updateLobbyPresence(
    store,
    host.state.code,
    { id: host.playerId, token: host.token },
    {
      pose: { x: 0, z: 0, angle: 0 },
      browsing: false,
      look: {},
      fullGame: true,
      accountId: 'licensed-host',
    },
    1100,
  );
  await toggleReady(
    store,
    host.state.code,
    { id: guest.playerId, token: guest.token },
    true,
    1200,
  );
  const started = await startPartyTournament(
    store,
    host.state.code,
    { id: host.playerId, token: host.token },
    1300,
    true,
  );
  assert.equal(started.accessScope, 'free');
  assert.equal(started.playlist.length, 6);
  assert(started.playlist.every((game) => hasGameAccess(game, false)));
  const choices = voteCandidates({
    ...started,
    currentRound: 0,
    roundResults: started.playlist.slice(0, 3).map((game, round) => ({
      round,
      game,
      scores: {},
      pointsAwarded: {},
    })),
  });
  assert.equal(choices.length, 3);
  assert(choices.every((game) => hasGameAccess(game, false)));
});

void test('a paid party seat is checked before reservation and keeps an existing round on refund', async () => {
  const { rows, store } = storeFixture();
  const host = await createPartyRoom(store, 'Host', 0, 1000);
  const code = host.state.code;
  const pass = { id: host.playerId, token: host.token };
  await updateLobbyPresence(
    store,
    code,
    pass,
    {
      pose: { x: 0, z: 0, angle: 0 },
      browsing: false,
      look: {},
      fullGame: true,
      accountId: 'owner',
    },
    1100,
  );
  const started = await startPartyTournament(store, code, pass, 1200, true);
  assert.equal(started.accessScope, 'full');
  await partyPlayerAction(store, code, pass, 'briefing_ready', 0, 6200);
  const row = rows.get(`party:${code}`)!;
  const stored = JSON.parse(row.state);
  stored.playlist[0] = 'wrong-floor';
  row.state = JSON.stringify(stored);
  const denial = {
    accountId: 'owner',
    check: async () => {
      throw new Error('refunded');
    },
  };
  await assert.rejects(
    partyGameSession(store, code, pass.id, pass.token, 0, 6500, denial),
    /refunded/,
  );
  assert(![...rows.keys()].some((key) => key.startsWith('party-round:')));
  await assert.rejects(
    partyGameSession(store, code, pass.id, pass.token, 0, 6500, {
      ...denial,
      accountId: 'borrowed',
    }),
    /signed-in account/,
  );
  const session = await partyGameSession(
    store,
    code,
    pass.id,
    pass.token,
    0,
    6500,
    {
      accountId: 'owner',
      check: async (_game, accounts) => assert.deepEqual(accounts, ['owner']),
    },
  );
  assert.equal(session.game, 'wrong-floor');
  const sameRound = await partyGameSession(
    store,
    code,
    pass.id,
    pass.token,
    0,
    6501,
    denial,
  );
  assert.equal(sameRound.code, session.code);
});
