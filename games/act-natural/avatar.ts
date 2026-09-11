import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { FARMER_SPEED } from './movement';
import { cowModel, farmerModel, poseFarmer, walkCow } from './objects';

export const farmAvatars: readonly AvatarLook[] = [
  {
    key: 'cow',
    label: 'Cow',
    create() {
      const root = cowModel(0);
      return {
        root,
        pose: (time, walking) => walkCow(root, time * 1000, walking),
      };
    },
  },
  {
    key: 'farmer',
    label: 'Farmer',
    create() {
      const { farmer } = farmerModel();
      return {
        root: farmer,
        pose: (time, walking) =>
          poseFarmer(farmer, {
            distance: time * FARMER_SPEED,
            walking,
            night: false,
          }),
      };
    },
  },
];
