import { roomStore } from '@/db/rooms';
import { createRoomHandler } from '@/shared/http/room-handler';
import { handleFarmRoom } from './rooms';
export const POST = createRoomHandler({
  store: roomStore,
  handle: handleFarmRoom,
  originError: 'Open Blend Business to use the farm controls.',
  unavailableError:
    'The farm is unavailable. Try again, or play solo practice.',
  logLabel: 'Farm request failed',
});
