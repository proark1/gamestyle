import type * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { worker } from '../../shared/rendering/worker';

/**
 * Walks a wrecker; `time` is in seconds. `hammer` is the arm angle while a
 * sledgehammer comes down, or null between swings.
 */
export function poseWrecker(
  model: T.Object3D,
  time: number,
  pose: {
    moving: boolean;
    down: boolean;
    color: number;
    still: boolean;
    hammer: number | null;
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
  const swing = pose.moving && !pose.down ? Math.sin(time * 13) * 0.62 : 0;
  rig.legL.rotation.x = swing;
  rig.legR.rotation.x = -swing;
  // Both arms come over the head for the downswing of a sledgehammer.
  rig.armL.rotation.x = pose.hammer ?? -swing * 0.7;
  rig.armR.rotation.x = pose.hammer ?? swing * 0.7;
}

export const loadBearingAvatars: readonly AvatarLook[] = [
  {
    key: 'wrecker',
    label: 'Wrecker',
    create() {
      const root = worker(0);
      return {
        root,
        pose: (time, walking) =>
          poseWrecker(root, time, {
            moving: walking,
            down: false,
            color: 0,
            still: false,
            hammer: null,
          }),
      };
    },
  },
];
