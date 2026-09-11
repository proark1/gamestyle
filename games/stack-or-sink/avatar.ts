import type * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { worker } from '../../shared/rendering/worker';

/** Walks a stacker, arms overhead while carrying; `time` is in seconds. */
export function poseStacker(
  model: T.Object3D,
  time: number,
  pose: {
    moving: boolean;
    down: boolean;
    carrying: boolean;
    color: number;
    still: boolean;
  },
) {
  const rig = model.userData as Record<
    'body' | 'legL' | 'legR' | 'armL' | 'armR',
    T.Group
  >;
  rig.body.rotation.z = pose.down
    ? Math.PI / 2
    : pose.still
      ? 0
      : Math.sin(time * 2 + pose.color) * 0.02;
  const swing = pose.moving && !pose.down ? Math.sin(time * 13) * 0.65 : 0;
  rig.legL.rotation.x = swing;
  rig.legR.rotation.x = -swing;
  rig.armL.rotation.x = pose.carrying ? -2.65 : -swing * 0.7;
  rig.armR.rotation.x = pose.carrying ? -2.65 : swing * 0.7;
}

export const stackAvatars: readonly AvatarLook[] = [
  {
    key: 'stacker',
    label: 'Stacker',
    create() {
      const root = worker(0);
      return {
        root,
        pose: (time, walking) =>
          poseStacker(root, time, {
            moving: walking,
            down: false,
            carrying: false,
            color: 0,
            still: false,
          }),
      };
    },
  },
];
