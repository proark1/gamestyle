import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { poseWorker } from '../../shared/rendering/worker-pose';
import { castlePlayer } from './models';
export const castleAvatars: readonly AvatarLook[] = (
  ['red', 'blue'] as const
).map((team) => ({
  key: `castle-${team}`,
  label: `${team === 'red' ? 'Red' : 'Blue'} castle team`,
  dressable: true,
  create(look) {
    const root = castlePlayer(team, team === 'red' ? 0 : 1, look);
    return {
      root,
      pose: (time, walking) =>
        poseWorker(root, time, walking ? 'walk' : 'hero'),
    };
  },
}));
