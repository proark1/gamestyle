import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { createAngler, deckSway } from './models';
import { ANGLER_COLORS } from './types';

export const reelAvatars: readonly AvatarLook[] = [
  {
    key: 'angler',
    label: 'Angler',
    create() {
      const root = createAngler(ANGLER_COLORS[0]);
      return {
        root,
        // Anglers have no swinging limbs: walking rocks the whole body.
        pose: (time, walking) => {
          root.rotation.z = deckSway(time * 1000, {
            x: walking ? 1 : 0,
            z: 0,
            brace: false,
          });
        },
      };
    },
  },
];
