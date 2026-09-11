import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { deliveryWorker, poseDeliveryWorker } from './objects';

export const deliveryAvatars: readonly AvatarLook[] = [
  {
    key: 'mover',
    label: 'Mover',
    create() {
      const root = deliveryWorker(0);
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
