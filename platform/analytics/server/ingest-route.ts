import { getBinding } from '@/db/index';
import {
  AnalyticsError,
  MAX_BATCH_BYTES,
  parseBatch,
} from '@/shared/analytics/protocol';
import { readJsonObject } from '@/shared/http/json-request';
import { RequestBudget, budgetError } from '@/shared/http/request-budget';
import { isRoomOriginAllowed } from '@/shared/http/request-origin';
import { RoomError } from '@/shared/rooms/types';
import { analyticsGame } from '../catalog';
import { RETENTION_MS, purgeSessions, recordBatch } from './store';

const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
/** Reports have their own admission budget so they can never crowd out rooms. */
const budget = new RequestBudget(32, 4096);
const seen = new Set<string>();
let purgedAt = 0;

export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    release = budget.enter();
    if (!isRoomOriginAllowed(request, process.env.PUBLIC_GAME_ORIGIN))
      return Response.json(
        { error: 'Reports are accepted from the games only.' },
        { status: 403, headers },
      );
    budget.take('analytics', 600, 100);
    const batch = parseBatch(
      await readJsonObject(request, MAX_BATCH_BYTES),
      analyticsGame,
    );
    if (!seen.has(batch.id)) {
      // New visits are what grow the database; later reports only update a row.
      budget.take('analytics:visits', 240, 2);
      if (seen.size >= 8192) seen.clear();
      seen.add(batch.id);
    }
    budget.take(`analytics:${batch.id}`, 20, 1);
    const db = getBinding();
    await recordBatch(db, batch, analyticsGame(batch.game)!);
    const now = Date.now();
    if (now - purgedAt > 3_600_000) {
      purgedAt = now;
      void purgeSessions(db, now - RETENTION_MS).catch((error) =>
        console.error('Analytics retention sweep failed', error),
      );
    }
    return new Response(null, { status: 204, headers });
  } catch (error) {
    if (error instanceof RoomError) return budgetError(error);
    if (error instanceof AnalyticsError)
      return Response.json({ error: error.message }, { status: 400, headers });
    console.error('Analytics report failed', error);
    return Response.json(
      { error: 'Analytics are unavailable.' },
      { status: 503, headers },
    );
  } finally {
    release?.();
  }
}
