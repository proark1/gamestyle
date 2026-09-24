import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { poseWorker } from '../../shared/rendering/worker-pose';
import { riderModel } from './models';

export const slopewreckAvatars: readonly AvatarLook[] = [
  {
    key: 'slopewreck-rider',
    label: 'Slopewreck rider',
    dressable: true,
    create(look) {
      const { root, body } = riderModel(1, look);
      return {
        root,
        pose: (time, walking) =>
          poseWorker(body, time, walking ? 'walk' : 'hero'),
      };
    },
  },
];
