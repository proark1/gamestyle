import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { createAngler, deckSway, poseAngler } from './models';
import { ANGLER_COLORS } from './types';

export const reelAvatars: readonly AvatarLook[] = [
  {
    key: 'angler',
    label: 'Angler',
    create() {
      const root = createAngler(ANGLER_COLORS[0]);
      return {
        root,
        // Anglers rock on the deck as they step, holding the rod steady.
        pose: (time, walking) => {
          root.rotation.z = deckSway(time * 1000, {
            x: walking ? 1 : 0,
            z: 0,
            brace: false,
          });
          poseAngler(root, time * 1000, walking);
        },
      };
    },
  },
];
