import {
  readRoomRequest,
  withRequestBudget,
  budgetError,
} from '../http/request-budget';
import { RoomError } from '../rooms/types';
import { roomStore } from '@/db/rooms';
import { handlePeerRoom } from '@/shared/peer/coordinator';
import { PeerError } from '@/shared/peer/types';
import { isRoomOriginAllowed } from '@/shared/http/request-origin';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function handleRequest(request: Request) {
  if (!isRoomOriginAllowed(request, process.env.PUBLIC_GAME_ORIGIN))
    return json({ error: 'Open the game to use this room.' }, 403);
  try {
    const body = await readRoomRequest(request, 280_000);
    return json(await handlePeerRoom(roomStore(), body));
  } catch (error) {
    if (error instanceof RoomError) return budgetError(error);
    if (error instanceof PeerError)
      return json({ error: error.message }, error.status);
    return json({ error: 'Room connection interrupted. Reconnecting…' }, 503);
  }
}

export const POST = withRequestBudget(handleRequest);
