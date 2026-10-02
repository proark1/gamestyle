import test from 'node:test';
import assert from 'node:assert/strict';
import { sqliteAdapter } from '../../db/node';
import { openSqlite } from '../../db/sqlite.mjs';
import { hashToken } from '../rooms/identity';
import { constructionVoiceStore } from './server-store';
import { authorizeVoice, parseVoiceRoomName } from './membership';

void test('construction voice authenticates both games, isolates identical codes, and revokes departed players', async () => {
  const native = openSqlite(':memory:');
  const now = Date.now();
  try {
    for (const prefix of ['handwerker', 'handwerker_fp']) {
      native.exec(
        `CREATE TABLE ${prefix}_rooms (code TEXT, updated INTEGER); CREATE TABLE ${prefix}_players (room TEXT, id TEXT, name TEXT, seen INTEGER, token_hash TEXT)`,
      );
      native
        .prepare(`INSERT INTO ${prefix}_rooms VALUES (?,?)`)
        .run('ABCDEF', now - 120000);
      native
        .prepare(`INSERT INTO ${prefix}_players VALUES (?,?,?,?,?)`)
        .run('ABCDEF', prefix, prefix, now, await hashToken(prefix));
    }
    const db = sqliteAdapter(native);
    for (const game of ['chaos', 'first-person'] as const) {
      const id = game === 'chaos' ? 'handwerker' : 'handwerker_fp';
      const store = constructionVoiceStore(db, game);
      const session = { game, code: 'ABCDEF', id, token: id };
      const result = await authorizeVoice(store, session, now);
      assert.deepEqual(parseVoiceRoomName(result.name), {
        game,
        code: 'ABCDEF',
      });
      await assert.rejects(
        authorizeVoice(store, { ...session, token: 'forged' }, now),
      );
      const other = id === 'handwerker' ? 'handwerker_fp' : 'handwerker';
      await assert.rejects(
        authorizeVoice(store, { ...session, id: other, token: other }, now),
      );
      await assert.rejects(authorizeVoice(store, session, now + 60001));
      native.prepare(`DELETE FROM ${id}_players WHERE id = ?`).run(id);
      await assert.rejects(authorizeVoice(store, session, now));
    }
  } finally {
    native.close();
  }
});
