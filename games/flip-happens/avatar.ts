import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { poseWorker } from '../../shared/rendering/worker-pose';
import { flipPlayer } from './models';
export const flipAvatars: readonly AvatarLook[] = [
  {
    key: 'flipper',
    label: 'Table flipper',
    dressable: true,
    create(look) {
      const root = flipPlayer(0, 0, look);
      return {
        root,
        pose: (time, walking) =>
          poseWorker(root, time, walking ? 'walk' : 'wave'),
      };
    },
  },
];
