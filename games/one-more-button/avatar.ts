import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { animateContestant, contestant } from './models';
import { COLORS } from './types';

export const buttonAvatars: readonly AvatarLook[] = [
  {
    key: 'contestant',
    label: 'Contestant',
    dressable: true,
    create(look) {
      const root = contestant(COLORS[0], look);
      return {
        root,
        pose: (time, walking) =>
          animateContestant(
            root,
            { vx: walking ? 1 : 0, vz: 0, y: 0 },
            time * 1000,
          ),
      };
    },
  },
];
