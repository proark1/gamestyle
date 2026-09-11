import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { animateWorker, worker } from './objects';

/** How far a walking worker trails its player: walk speed over follow rate. */
const WALK_LAG = 4.3 / 17;

export const chaosAvatars: readonly AvatarLook[] = [
  {
    key: 'worker',
    label: 'Site worker',
    create() {
      const root = worker(0);
      return {
        root,
        pose: (time, walking) =>
          animateWorker(root, time, {
            lag: walking ? WALK_LAG : 0,
            bonked: null,
            holding: false,
            hammering: false,
          }),
      };
    },
  },
];
