import { roomStore } from '@/db/rooms';
import { createRoomHandler } from '@/shared/http/room-handler';
import { handleRoom } from './rooms';
export const POST = createRoomHandler({
  game: 'stack-or-sink',
  store: roomStore,
  handle: handleRoom,
  originError: 'Open the game to use its room controls.',
  unavailableError:
    'The crew cabin is unavailable. Try again in a moment, or play a practice run.',
  logLabel: 'Room request failed',
});
