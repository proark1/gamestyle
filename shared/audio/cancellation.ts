import type { GameDatabase } from '@/db/contract';
import { AudioError } from './errors';

// Persist cancellation so a stop arriving before generation, or on another
// server process, is still honored. UUIDs are scoped to their game.
export async function cancelGeneration(
  db: GameDatabase,
  game: string,
  requestId: string,
) {
  await db
    .prepare(
      'INSERT INTO audio_generation_jobs (game, request, cancelled, created) VALUES (?, ?, 1, ?) ON CONFLICT(game, request) DO UPDATE SET cancelled = 1',
    )
    .bind(game, requestId, Date.now())
    .run();
}
export async function watchGeneration(
  db: GameDatabase,
  game: string,
  requestId: string,
) {
  await db
    .prepare('DELETE FROM audio_generation_jobs WHERE created < ?')
    .bind(Date.now() - 86_400_000)
    .run();
  await db
    .prepare(
      'INSERT INTO audio_generation_jobs (game, request, cancelled, created) VALUES (?, ?, 0, ?) ON CONFLICT(game, request) DO NOTHING',
    )
    .bind(game, requestId, Date.now())
    .run();
  const controller = new AbortController();
  let checking: Promise<void> | undefined;
  const check = () => {
    checking ??= (async () => {
      const row = await db
        .prepare(
          'SELECT cancelled FROM audio_generation_jobs WHERE game = ? AND request = ?',
        )
        .bind(game, requestId)
        .first<{ cancelled: number }>();
      if (row?.cancelled) controller.abort();
    })().finally(() => {
      checking = undefined;
    });
    return checking;
  };
  await check();
  const timer = setInterval(() => {
    void check().catch(() => controller.abort());
  }, 300);
  return {
    signal: controller.signal,
    async assertActive() {
      await check();
      if (controller.signal.aborted)
        throw new AudioError('Generation cancelled.', 409);
    },
    async dispose() {
      clearInterval(timer);
      await checking?.catch(() => {});
    },
  };
}
