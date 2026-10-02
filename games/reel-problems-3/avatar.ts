import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { runHoopKid } from '../../shared/rendering/avatars/hoop-kid';
import { gameAvatar } from '../../shared/rendering/game-avatar';
import { seatKit } from '../../shared/rendering/palette';

export function createAdventureAvatar(color: number) {
  const root = gameAvatar(color, { shirt: seatKit(color) });
  root.scale.setScalar(0.94);
  return root;
}

export const adventureAvatars: readonly AvatarLook[] = [
  {
    key: 'crew',
    label: 'Harbor crew',
    create() {
      const root = createAdventureAvatar(0);
      return { root, pose: (time, walking) => runHoopKid(root, time, walking) };
    },
  },
];
