import { env } from 'cloudflare:workers';
import type { RoomStore, Row } from '@/shared/rooms/types';
export function roomStore(): RoomStore {
  const db = env.DB;
  if (!db) throw new Error('Room storage is unavailable.');
  return {
    get: (code) =>
      db
        .prepare('SELECT code,state,version,updated FROM rooms WHERE code = ?')
        .bind(code)
        .first<Row>(),
    async insert(row) {
      const result = await db
        .prepare(
          'INSERT OR IGNORE INTO rooms (code,state,version,updated) VALUES (?,?,?,?)',
        )
        .bind(row.code, row.state, row.version, row.updated)
        .run();
      return result.meta.changes > 0;
    },
    async compareAndSwap(row, version) {
      const result = await db
        .prepare(
          'UPDATE rooms SET state = ?,version = ?,updated = ? WHERE code = ? AND version = ?',
        )
        .bind(row.state, row.version, row.updated, row.code, version)
        .run();
      return result.meta.changes > 0;
    },
  };
}
