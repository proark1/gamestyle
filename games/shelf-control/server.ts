import { roomStore } from '@/db/rooms';
import { createRoomHandler } from '@/shared/http/room-handler';
import { handleShelfRoom } from './rooms';
export const POST = createRoomHandler({
  store: roomStore,
  handle: handleShelfRoom,
  originError: 'Open Shelf Control to use these controls.',
  unavailableError: 'The shop is unavailable. Try again shortly.',
  logLabel: 'Shelf Control request failed',
});
