import type { GameDatabase } from '../../db/contract';
import type { RoomStore } from '../rooms/types';

/** Normalize construction rooms for the same voice authentication and cleanup. */
export function constructionVoiceStore(
  db: GameDatabase,
  game: 'chaos' | 'first-person',
): Pick<RoomStore, 'get'> {
  const rooms = game === 'chaos' ? 'handwerker_rooms' : 'handwerker_fp_rooms';
  const players =
    game === 'chaos' ? 'handwerker_players' : 'handwerker_fp_players';
  return {
    async get(code) {
      const room = await db
        .prepare(`SELECT updated FROM ${rooms} WHERE code = ?`)
        .bind(code)
        .first<{ updated: number }>();
      if (!room) return null;
      const result = await db
        .prepare(
          `SELECT id, name, seen, token_hash FROM ${players} WHERE room = ?`,
        )
        .bind(code)
        .all<{ id: string; name: string; seen: number; token_hash: string }>();
      return {
        code,
        version: 0,
        // Construction rooms persist between edits; player heartbeats, rather
        // than the last building action, determine whether voice is active.
        updated: Math.max(room.updated, ...result.results.map((p) => p.seen)),
        state: JSON.stringify({
          members: Object.fromEntries(
            result.results.map((p) => [p.id, p.token_hash]),
          ),
          world: {
            players: result.results.map(({ id, name, seen }) => ({
              id,
              name,
              seen,
            })),
          },
        }),
      };
    },
  };
}
