import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { poseThief, thief } from './objects';

export const giantAvatars: readonly AvatarLook[] = [
  {
    key: 'thief',
    label: 'Thief',
    dressable: true,
    create(look) {
      const root = thief(0, look);
      return {
        root,
        pose: (time, walking) =>
          poseThief(root, time * 1000, {
            walking,
            crouch: false,
            carrying: false,
            down: false,
          }),
      };
    },
  },
];
