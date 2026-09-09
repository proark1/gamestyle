import {
  readRoomRequest,
  withRequestBudget,
  budgetError,
} from './request-budget';
import { RoomError, type RoomStore } from '../rooms/types';
import { isRoomOriginAllowed } from './request-origin';

type RoomHandlerOptions = {
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
      return jsonResponse(await options.handle(options.store(), body));
    } catch (error) {
      if (error instanceof RoomError) return budgetError(error);
      console.error(options.logLabel, error);
      return jsonResponse({ error: options.unavailableError }, 503);
    }
  });
}
