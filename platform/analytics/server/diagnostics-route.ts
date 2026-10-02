import { getBinding } from '@/db/index';
import { isRoomOriginAllowed } from '@/shared/http/request-origin';
import { readJsonObject } from '@/shared/http/json-request';
import { RequestBudget, budgetError } from '@/shared/http/request-budget';
import { RoomError } from '@/shared/rooms/types';
import {
  DiagnosticError,
  MAX_DIAGNOSTIC_BYTES,
  parseDiagnostics,
} from '@/shared/diagnostics/protocol';
import { recordDiagnostics, purgeDiagnostics } from './diagnostics-store';
import { RETENTION_MS } from './store';

const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const budget = new RequestBudget(16, 2048);
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
    budget.take('diagnostics', 240, 20);
    const batch = parseDiagnostics(
      await readJsonObject(request, MAX_DIAGNOSTIC_BYTES),
    );
    if (!seen.has(batch.id)) {
      budget.take('diagnostics:visits', 120, 2);
      if (seen.size >= 4096) seen.clear();
      seen.add(batch.id);
    }
    budget.take(`diagnostics:${batch.id}`, 10, 0.5);
    const db = getBinding();
    await recordDiagnostics(db, batch);
    const now = Date.now();
    if (now - purgedAt > 3600000) {
      purgedAt = now;
      void purgeDiagnostics(db, now - RETENTION_MS).catch(() =>
        console.error('Diagnostic retention sweep failed.'),
      );
    }
    return new Response(null, { status: 204, headers });
  } catch (error) {
    if (error instanceof RoomError) return budgetError(error);
    if (error instanceof DiagnosticError)
      return Response.json({ error: error.message }, { status: 400, headers });
    console.error('Diagnostic reporting unavailable.');
    return Response.json(
      { error: 'Diagnostics are unavailable.' },
      { status: 503, headers },
    );
  } finally {
    release?.();
  }
}
