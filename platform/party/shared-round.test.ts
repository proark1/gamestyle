import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPartyRoom,
  joinPartyRoom,
  startPartyTournament,
  reportRoundResult,
  removePlayerFromParty,
} from './coordinator';
import { partyGameSession } from './game-session';
import { handlePeerRoom } from '../../shared/peer/coordinator';
import { handleVoicePeer } from '../../shared/voice/peer-coordinator';
import { compatibility } from '../../shared/peer/protocol';
import type { RoomStore, Row } from '../../shared/rooms/types';

void test('one shared assignment survives races and reloads; real outcomes, revocation and persistent voice', async () => {
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
  const host = await createPartyRoom(store, 'Host', 0, 1000),
    code = host.state.code;
  const guest = await joinPartyRoom(store, code, 'Guest', 1, 1000);
  const pass = { id: host.playerId, token: host.token };
  await startPartyTournament(store, code, pass, 1000);
  const row = rows.get('party:' + code)!;
  const party = JSON.parse(row.state);
  party.playlist[0] = 'crane-clash';
  row.state = JSON.stringify(party);
  const sessions = await Promise.all(
    [host, guest, guest].map((p) =>
      partyGameSession(store, code, p.playerId, p.token, 0, 5000),
    ),
  );
  assert.equal(new Set(sessions.map((s) => s.code)).size, 1);
  assert.equal(sessions[1].id, sessions[2].id);
  await assert.rejects(
    partyGameSession(store, code, guest.playerId, 'forged', 0, 5000),
    /Rejoin/,
  );
  await assert.rejects(
    partyGameSession(store, code, guest.playerId, guest.token, 1, 5000),
    /no longer/,
  );
  const hello = await handlePeerRoom(
    store,
    {
      ...compatibility('crane-clash'),
      ...sessions[0],
      op: 'hello',
      instance: 'host-tab',
    },
    5000,
  );
  assert.equal(hello.view.members.length, 2);
  assert.equal(hello.view.party?.code, code);
  await assert.rejects(
    handlePeerRoom(
      store,
      { op: 'join', game: 'crane-clash', code: sessions[0].code },
      5000,
    ),
    /party/i,
  );
  await assert.rejects(
    handlePeerRoom(
      store,
      { ...sessions[0], op: 'poll', instance: 'host-tab', protocol: 999 },
      5000,
    ),
    /Update/,
  );
  const voice = {
    game: 'party',
    code,
    id: guest.playerId,
    token: guest.token,
    instance: 'voice-tab',
  };
  await handleVoicePeer(store, store, { ...voice, op: 'hello' }, 5000);
  await reportRoundResult(
    store,
    code,
    0,
    pass,
    { kind: 'versus', outcome: 'won' },
    5000,
  );
  const scored = await reportRoundResult(
    store,
    code,
    0,
    { id: guest.playerId, token: guest.token },
    { kind: 'versus', outcome: 'lost' },
    5000,
  );
  assert.deepEqual(scored.roundResults[0].pointsAwarded, {
    [host.playerId]: 10,
    [guest.playerId]: 3,
  });
  const recovered = await handleVoicePeer(
    store,
    store,
    { ...voice, op: 'poll' },
    22000,
  );
  assert.equal(recovered.view.voiceRecovered, true);
  await handleVoicePeer(
    store,
    store,
    { ...voice, instance: 'new-tab', op: 'hello' },
    22001,
  );
  await assert.rejects(
    handleVoicePeer(store, store, { ...voice, op: 'poll' }, 40000),
    /expired/,
  );
  await removePlayerFromParty(store, code, pass, guest.playerId, 40001);
  await assert.rejects(
    handleVoicePeer(
      store,
      store,
      { ...voice, instance: 'new-tab', op: 'poll' },
      40002,
    ),
    /expired/,
  );
  await assert.rejects(
    handlePeerRoom(
      store,
      { ...sessions[1], op: 'hello', instance: 'guest-tab' },
      40002,
    ),
    /party|expired/i,
  );
});
