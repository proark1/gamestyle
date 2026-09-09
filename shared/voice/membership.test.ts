import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeVoice,
  voiceRoomName,
  parseVoiceRoomName,
  storageCode,
} from './membership';
import { handleRoom } from '../../games/stack-or-sink/rooms';
import { type RoomStore, type Row } from '../rooms/types';
import { handleFarmRoom } from '../../games/act-natural/rooms';
import { handleGiantRoom } from '../../games/dont-wake-the-giant/rooms';
import { handleDeliveryRoom } from '../../games/uphill-delivery/rooms';
const games = {
  'stack-or-sink': handleRoom,
  'act-natural': handleFarmRoom,
  'dont-wake-the-giant': handleGiantRoom,
  'uphill-delivery': handleDeliveryRoom,
};
function memory(): RoomStore {
  const rows = new Map<string, Row>();
  return {
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
}
void test('voice authenticates real room membership, isolates the games and rejects expired/leaving players', async () => {
  const store = memory(),
    now = Date.now();
  for (const game of Object.keys(games) as (keyof typeof games)[]) {
    const handle = games[game];
    const result = await handle(
      store,
      { op: 'create', name: 'Voice tester' },
      now,
    );
    assert.ok('session' in result && result.session);
    const session = { ...result.session!, game };
    const authorized = await authorizeVoice(store, session, now);
    assert.equal(authorized.player.name, 'Voice tester');
    assert.equal(authorized.name, voiceRoomName(game, session.code));
    const parsed = parseVoiceRoomName(authorized.name);
    assert.ok(parsed, 'Every supported game must be included in voice cleanup');
    assert.ok(await store.get(storageCode(parsed.game, parsed.code)));
    await assert.rejects(
      authorizeVoice(store, { ...session, token: 'forged' }, now),
    );
    await assert.rejects(
      authorizeVoice(
        store,
        {
          ...session,
          game: game === 'stack-or-sink' ? 'act-natural' : 'stack-or-sink',
        },
        now,
      ),
    );
    await assert.rejects(authorizeVoice(store, session, now + 31000));
    await handle(store, { op: 'leave', ...session }, now + 100);
    await assert.rejects(authorizeVoice(store, session, now + 100));
  }
});
void test('voice cleanup ignores other applications and malformed room names', () => {
  for (const name of [
    'other-room',
    'gamestyle-unknown-ABCDEF',
    'gamestyle-act-natural-abc123',
    'gamestyle-act-natural-ABCDEF-extra',
  ]) {
    assert.equal(parseVoiceRoomName(name), null);
  }
});
