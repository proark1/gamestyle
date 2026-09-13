import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { deliveryWorker, poseDeliveryWorker } from './objects';

export const deliveryAvatars: readonly AvatarLook[] = [
  {
    key: 'mover',
    label: 'Mover',
    dressable: true,
    create(look) {
      const root = deliveryWorker(0, look);
      return {
        root,
        pose: (time, walking) =>
          poseDeliveryWorker(root, time * 1000, {
            moving: walking,
            gripping: false,
            stumbling: false,
            color: 0,
          }),
      };
    },
  },
];
