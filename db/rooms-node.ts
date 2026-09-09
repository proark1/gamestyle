import type { DatabaseSync } from 'node:sqlite';
import type { RoomStore, Row } from '../shared/rooms/types';
import { getSqliteDatabase } from './sqlite.mjs';
import { sqliteAdapter } from './node';

export function sqliteRoomStore(database: DatabaseSync): RoomStore {
  const db = sqliteAdapter(database);
  const read = database.prepare(
    'SELECT code, state, version, updated FROM rooms WHERE code = ?',
  );
  const insert = db.prepare(
    'INSERT OR IGNORE INTO rooms (code,state,version,updated) VALUES (?,?,?,?)',
  );
  const update = db.prepare(
    'UPDATE rooms SET state = ?, version = ?, updated = ? WHERE code = ? AND version = ?',
  );
  return {
    async get(code) {
      return (read.get(code) as Row | undefined) ?? null;
    },
    async insert(row) {
      return (
        (await insert.bind(row.code, row.state, row.version, row.updated).run())
          .meta.changes > 0
      );
    },
    async compareAndSwap(row, version) {
      return (
        (
          await update
            .bind(row.state, row.version, row.updated, row.code, version)
            .run()
        ).meta.changes > 0
      );
    },
  };
}

let store: RoomStore | undefined;
export function roomStore(): RoomStore {
  return (store ??= sqliteRoomStore(getSqliteDatabase()));
}
