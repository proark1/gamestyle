import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { createFighter, poseFighter } from './models';
import { newFighter } from './simulation';
export const cageAvatars: readonly AvatarLook[] = (
  ['red', 'blue'] as const
).map((team) => ({
  key: `fighter-${team}`,
  label: `${team === 'red' ? 'Red' : 'Blue'} MMA fighter`,
  dressable: true,
  create(look) {
    const p = newFighter('preview', 'Fighter', 0, team),
      visual = createFighter(p, look);
    return {
      root: visual.model,
      pose: (time, walking) => {
        p.vx = walking ? 3 : 0;
        poseFighter(visual, p, time, false);
      },
    };
  },
}));
