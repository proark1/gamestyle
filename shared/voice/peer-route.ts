import { roomStore } from '@/db/rooms';
import { getBinding } from '@/db/index';
import {
  readRoomRequest,
  withRequestBudget,
  budgetError,
} from '../http/request-budget';
import { isRoomOriginAllowed } from '../http/request-origin';
import { RoomError } from '../rooms/types';
import { PeerError } from '../peer/types';
import { constructionVoiceStore } from './server-store';
import { handleVoicePeer } from './peer-coordinator';
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export const POST = withRequestBudget(async (request: Request) => {
  if (!isRoomOriginAllowed(request, process.env.PUBLIC_GAME_ORIGIN))
    return json({ error: 'Open the game to use voice.' }, 403);
  try {
    const body = await readRoomRequest(request, 280000);
    const membership =
      body.game === 'chaos' || body.game === 'first-person'
        ? constructionVoiceStore(getBinding(), body.game)
        : roomStore();
    return json(await handleVoicePeer(roomStore(), membership, body));
  } catch (error) {
    if (error instanceof RoomError) return budgetError(error);
    if (error instanceof PeerError)
      return json({ error: error.message }, error.status);
    return json({ error: 'Voice connection interrupted. Reconnecting…' }, 503);
  }
});
