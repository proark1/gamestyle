import { roomStore } from '@/db/rooms';
import { createRoomHandler } from '@/shared/http/room-handler';
import { handleGiantRoom } from './rooms';
export const POST = createRoomHandler({
  store: roomStore,
  handle: handleGiantRoom,
  originError: 'Open the giant game to use the cottage controls.',
  unavailableError:
    'The cottage is unavailable. Try again, or play solo practice.',
  logLabel: 'Giant request failed',
});
