import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openSqlite, migrateSqlite } from './sqlite.mjs';
import { sqliteRoomStore } from './rooms-node';
import { handleRoom } from '../game/rooms';
import type { Session, Snapshot } from '../game/types';
type Reply = { session: Session; snapshot: Snapshot };

test('Railway database persists room state and authentication after reopening', async () => {
  const parent = resolve(tmpdir()), directory = mkdtempSync(join(parent, 'stack-or-sink-test-'));
  const filename = join(directory, 'rooms.sqlite');
  let database = openSqlite(filename);
  try {
    migrateSqlite(database); migrateSqlite(database);
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM _game_migrations').get()?.n, 1);
    const first = await handleRoom(sqliteRoomStore(database), { op: 'create', name: 'Persistent builder' }) as Reply;
    database.close(); database = openSqlite(filename);
    const reopened = await handleRoom(sqliteRoomStore(database), { op: 'sync', ...first.session }) as Reply;
    assert.equal(reopened.snapshot.world.players[0].name, 'Persistent builder');
    assert.equal(reopened.snapshot.host, first.session.id);
    await assert.rejects(handleRoom(sqliteRoomStore(database), { op: 'sync', ...first.session, token: 'invalid' }), /expired/);
  } finally {
    database.close();
    if (!resolve(directory).startsWith(join(parent, 'stack-or-sink-test-'))) throw new Error('Unexpected test directory');
    rmSync(directory, { recursive: true, force: true });
  }
});

test('SQLite compare-and-swap preserves four-player capacity under competing joins', async () => {
  const database = openSqlite(':memory:');
  try {
    migrateSqlite(database); const store = sqliteRoomStore(database);
    const first = await handleRoom(store, { op: 'create', name: 'Captain' }) as Reply;
    const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => handleRoom(store, { op: 'join', code: first.session.code, name: `Builder ${i}` })));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 3);
    const state = await handleRoom(store, { op: 'sync', ...first.session }) as Reply;
    assert.equal(state.snapshot.world.players.length, 4);
  } finally { database.close(); }
});
