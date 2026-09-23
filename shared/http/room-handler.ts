import {
  readRoomRequest,
  withRequestBudget,
  budgetError,
} from './request-budget';
import { RoomError, type RoomStore } from '../rooms/types';
import { isRoomOriginAllowed } from './request-origin';
import { sweepExpiredRooms } from '../rooms/expiry';
import {
  assertGameEntry,
  paidAdmissionEnabled,
} from '../commerce/server/access';
import { CommerceError } from '../commerce/types';

type RoomHandlerOptions = {
  game?: string;
  store: () => RoomStore;
  handle: (store: RoomStore, body: Record<string, unknown>) => Promise<unknown>;
  originError: string;
  unavailableError: string;
  logLabel: string;
};

export function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export { readJsonObject } from './json-request';

/** The transport owns validation; each game owns its rules and player-facing errors. */
export function createRoomHandler(options: RoomHandlerOptions) {
  return withRequestBudget(async function POST(request: Request) {
    try {
      if (!isRoomOriginAllowed(request, process.env.PUBLIC_GAME_ORIGIN))
        return jsonResponse({ error: options.originError }, 403);
      const body = await readRoomRequest(request);
      if (
        options.game &&
        paidAdmissionEnabled() &&
        (body.op === 'create' || body.op === 'join')
      ) {
        const [{ currentAccount }, { getBinding }] = await Promise.all([
          import('../accounts/server/current'),
          import('../../db/index'),
        ]);
        const account = await currentAccount(request);
        await assertGameEntry(getBinding(), options.game, account?.id ?? null);
      }
      const store = options.store();
      sweepExpiredRooms(store);
      return jsonResponse(await options.handle(store, body));
    } catch (error) {
      if (error instanceof CommerceError)
        return jsonResponse({ error: error.message }, error.status);
      if (error instanceof RoomError) return budgetError(error);
      console.error(options.logLabel, error);
      return jsonResponse({ error: options.unavailableError }, 503);
    }
  });
}
