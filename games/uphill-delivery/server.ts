import { roomStore } from '@/db/rooms';
import { createRoomHandler } from '@/shared/http/room-handler';
import { handleDeliveryRoom } from './rooms';
export const POST = createRoomHandler({
  store: roomStore,
  handle: handleDeliveryRoom,
  originError: 'Open Uphill Delivery to use the delivery controls.',
  unavailableError:
    'The delivery is unavailable. Try again, or play solo practice.',
  logLabel: 'Delivery request failed',
});
