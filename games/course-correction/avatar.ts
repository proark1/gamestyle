import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { dressedGameAvatar as dressedWorker } from '../../shared/rendering/game-avatar';
import { poseWorker } from '../../shared/rendering/worker-pose';
import { CLOTH, KIT } from '../../shared/rendering/palette';

export const courseCorrectionAvatars: readonly AvatarLook[] = [
  {
    key: 'course-crew',
    label: 'Course crew',
    dressable: true,
    create(look) {
      const root = dressedWorker(
        0,
        { shirt: KIT.green, overalls: CLOTH.navy },
        look,
      ).model;
      return {
        root,
        pose: (time, walking) =>
          poseWorker(root, time, walking ? 'walk' : 'hero'),
      };
    },
  },
];
