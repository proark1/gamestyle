import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { animateDoll, mannequin } from './models';

function doll(key: string, label: string, guard: boolean): AvatarLook {
  return {
    key,
    label,
    create() {
      const figure = mannequin(guard);
      return {
        root: figure.group,
        pose: (time, walking) => animateDoll(figure, 0, walking, time, false),
      };
    },
  };
}

export const shelfAvatars: readonly AvatarLook[] = [
  doll('mannequin', 'Mannequin', false),
  doll('guard', 'Night guard', true),
];
