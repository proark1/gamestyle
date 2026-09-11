import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { createDetailMaterials } from './detail-materials';
import {
  makeBuilder,
  paintMaterials,
  stepBuilder,
  type BuilderMaterials,
} from './world-view';

// Made once and shared by every preview builder, like the site's own set.
let materials: BuilderMaterials | undefined;

export const siteAvatars: readonly AvatarLook[] = [
  {
    key: 'builder',
    label: 'Builder',
    create() {
      materials ??= { ...createDetailMaterials(), ...paintMaterials() };
      const builder = makeBuilder('', 0, materials);
      builder.tag.visible = false;
      // Builders are modelled facing -Z; turn this one to face the camera.
      builder.group.rotation.y = Math.PI;
      return {
        root: builder.group,
        pose: (time, walking) =>
          stepBuilder(builder.legs, time * 1000, walking),
      };
    },
  },
];
