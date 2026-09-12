import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { animateGuest, guest, strideAdvance } from './models';

/** A guest's walking pace in metres per second, short of a sprint. */
const WALK = 3.7;

export const hotelAvatars: readonly AvatarLook[] = [
  {
    key: 'guest',
    label: 'Hotel guest',
    dressable: true,
    create(look) {
      const root = guest(0, false, look);
      return {
        root,
        pose: (time, walking) =>
          animateGuest(root, strideAdvance(WALK, 1) * time * 95, walking),
      };
    },
  },
];
