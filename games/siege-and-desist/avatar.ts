import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { crewMember, poseCrew } from './models';
import { COLORS } from './types';

export const siegeAvatars: readonly AvatarLook[] = [
  {
    key: 'crew',
    label: 'Siege crew',
    dressable: true,
    create(look) {
      const root = crewMember(COLORS[0], look);
      return {
        root,
        pose: (time, walking) =>
          poseCrew(root, time * 1000, {
            walking,
            winding: false,
            flying: false,
          }),
      };
    },
  },
];
