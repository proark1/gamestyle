import { readJsonObject } from '@/shared/http/json-request';
import { withRequestBudget, budgetError } from '@/shared/http/request-budget';
import { RoomError } from '@/shared/rooms/types';
import { voiceToken } from '@/shared/voice/server';
import { isRoomOriginAllowed } from '@/shared/http/request-origin';
async function handleRequest(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!isRoomOriginAllowed(request, process.env.PUBLIC_GAME_ORIGIN))
    return Response.json(
      { error: 'Invalid origin.' },
      { status: 403, headers },
    );
  try {
    const body = await readJsonObject(request, 1000);
    return Response.json(
      await voiceToken(body as Parameters<typeof voiceToken>[0]),
      { headers },
    );
  } catch (error) {
    if (error instanceof RoomError) return budgetError(error);
    return Response.json(
      {
        error:
          'Voice could not connect. Check your game pass and the LiveKit service.',
      },
      { status: 401, headers },
    );
  }
}

export const POST = withRequestBudget(handleRequest);
