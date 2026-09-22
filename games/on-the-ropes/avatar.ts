import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { createBoxer, poseBoxer } from './models';
import { newBoxer } from './simulation';
export const boxingAvatars: readonly AvatarLook[] = (
  ['red', 'blue'] as const
).map((team) => ({
  key: `boxer-${team}`,
  label: `${team === 'red' ? 'Red' : 'Blue'} corner boxer`,
  dressable: true,
  create(look) {
    const p = newBoxer('preview', 'Boxer', 0, team, true);
    const visual = createBoxer(p, look);
    return {
      root: visual.model,
      pose: (time, walking) => {
        p.vx = walking ? 3 : 0;
        poseBoxer(visual, p, time, false);
      },
    };
  },
}));
