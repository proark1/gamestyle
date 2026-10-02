import * as T from 'three';
import { ball, box, taper } from '../../shared/rendering/primitives';
import { dressedGameAvatar } from '../../shared/rendering/game-avatar';
import { CLOTH, seatKit } from '../../shared/rendering/palette';
import { poseWorker } from '../../shared/rendering/worker-pose';
import type { Look } from '../../shared/wardrobe/look';
import type { Rider } from './types';

export function riderModel(color: number, look?: Look) {
  const suit = seatKit(color);
  const root = new T.Group();
  const body = dressedGameAvatar(
    color,
    {
      shirt: suit,
      overalls: CLOTH.white,
      boots: CLOTH.navy,
      trousers: true,
    },
    look,
  ).model;
  root.add(body);
  box(root, [0.92, 0.12, 2.1], [0, 0.06, 0], '#173e5a', true);
  box(root, [0.84, 0.035, 0.42], [0, 0.13, 0.66], suit);
  box(root, [0.84, 0.035, 0.42], [0, 0.13, -0.66], suit);
  return { root, body };
}

export function poseRider(body: T.Group, p: Rider, time: number) {
  poseWorker(body, time, p.grounded ? 'still' : 'hero');
  const rig = body.userData;
  rig.body.rotation.x = p.input.tuck ? 0.45 : 0.12;
  rig.armL.rotation.x = p.grounded ? -0.55 : -1.1;
  rig.armR.rotation.x = p.grounded ? -0.55 : -1.1;
}

export function pine(
  parent: T.Object3D,
  x: number,
  z: number,
  y: number,
  size: number,
) {
  const tree = new T.Group();
  tree.position.set(x, y, z);
  taper(
    tree,
    0.12 * size,
    0.16 * size,
    1.1 * size,
    [0, 0.55 * size, 0],
    '#765743',
    8,
  );
  taper(
    tree,
    0.05 * size,
    1.1 * size,
    2.5 * size,
    [0, 2.1 * size, 0],
    '#1a685f',
    8,
  );
  taper(
    tree,
    0.03 * size,
    0.8 * size,
    1.8 * size,
    [0, 3.0 * size, 0],
    '#237f72',
    8,
  );
  ball(
    tree,
    [0.75 * size, 0.13 * size, 0.75 * size],
    [0, 1.3 * size, 0],
    '#ecf6ed',
    8,
  );
  parent.add(tree);
}
