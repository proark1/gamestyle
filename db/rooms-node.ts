import type { DatabaseSync } from 'node:sqlite';
import type { RoomStore, Row } from '../game/rooms';
import { openSqlite } from './sqlite.mjs';

export function sqliteRoomStore(database: DatabaseSync): RoomStore {
  const read = database.prepare('SELECT code, state, version, updated FROM rooms WHERE code = ?');
  const insert = database.prepare('INSERT OR IGNORE INTO rooms (code,state,version,updated) VALUES (?,?,?,?)');
  const update = database.prepare('UPDATE rooms SET state = ?, version = ?, updated = ? WHERE code = ? AND version = ?');
  return {
    async get(code) { return (read.get(code) as Row | undefined) ?? null; },
    async insert(row) { return insert.run(row.code, row.state, row.version, row.updated).changes > 0; },
    async compareAndSwap(row, version) { return update.run(row.state, row.version, row.updated, row.code, version).changes > 0; },
  };
}

let store: RoomStore | undefined;
export function roomStore(): RoomStore {
  return store ??= sqliteRoomStore(openSqlite());
}
