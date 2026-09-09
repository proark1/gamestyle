import type { GameDatabase } from '@/db/contract';
import type { SavedBuild, BuildSnapshot } from './build-snapshot';
export const BUILD_ID = /^[a-f0-9]{32}$/;
type Row = {
  id: string;
  title: string;
  author: string;
  source_id: string | null;
  snapshot: string;
  created: number;
};
export async function readBuild(
  db: GameDatabase,
  id: string,
): Promise<SavedBuild | null> {
  if (!BUILD_ID.test(id)) return null;
  const row = await db
    .prepare(
      'SELECT id, title, author, source_id, snapshot, created FROM handwerker_saved_builds WHERE id = ?',
    )
    .bind(id)
    .first<Row>();
  return row
    ? {
        id: row.id,
        title: row.title,
        author: row.author,
        sourceId: row.source_id,
        created: row.created,
        build: JSON.parse(row.snapshot) as BuildSnapshot,
      }
    : null;
}
export async function hashIdentity(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
