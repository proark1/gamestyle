import * as T from 'three';
import { ball, box, taper } from '../../shared/rendering/primitives';
import { dressedGameAvatar } from '../../shared/rendering/game-avatar';
import { CLOTH, seatKit } from '../../shared/rendering/palette';
import { poseWorker } from '../../shared/rendering/worker-pose';
import type { Look } from '../../shared/wardrobe/look';
import type { Rider } from './types';

const BOARD_TOP = 0.15;

type RiderRig = {
  body: T.Group;
  head: T.Group;
  legL: T.Group;
  legR: T.Group;
  armL: T.Group;
  armR: T.Group;
};

function snowboard(root: T.Group) {
  const board = new T.Group();
  board.name = 'snowboard';
  root.add(board);

  box(board, [1, 0.06, 1.82], [0, 0.06, 0], '#20a5a5', true);
  box(board, [0.92, 0.08, 1.84], [0, 0.11, 0], '#173e5a', true);
  for (const side of [-1, 1]) {
    const edge = box(
      board,
      [1, 0.06, 0.38],
      [0, 0.085, side * 1.06],
      '#20a5a5',
      true,
    );
    edge.rotation.x = side * -0.17;
    const tip = box(
      board,
      [0.92, 0.075, 0.4],
      [0, 0.135, side * 1.055],
      side > 0 ? '#f0b33f' : '#173e5a',
      true,
    );
    tip.rotation.x = side * -0.17;
  }
  box(board, [0.76, 0.018, 0.16], [0, 0.158, 0], '#f6e5a4', true);
}

function binding(root: T.Group, position: T.Vector3, side: number) {
  const mount = new T.Group();
  mount.name = 'snowboard-binding';
  mount.position.set(position.x, BOARD_TOP, position.z);
  root.add(mount);
  box(mount, [0.36, 0.045, 0.23], [0, 0.022, 0], '#f4d068', true);
  box(
    mount,
    [0.34, 0.075, 0.065],
    [side * 0.02, 0.085, 0.015],
    '#f8f3df',
    true,
  ).rotation.z = side * 0.08;
  box(
    mount,
    [0.32, 0.2, 0.055],
    [-0.11, 0.12, -0.085],
    '#f0b33f',
    true,
  ).rotation.z = side * -0.12;
}

function winterGear(body: T.Group, suit: string, faceCovered: boolean) {
  const rig = body.userData as RiderRig;
  const accent = `#${new T.Color(suit)
    .lerp(new T.Color('#ffd99b'), 0.24)
    .getHexString()}`;

  for (const y of [0.59, 0.69, 0.79])
    box(rig.body, [0.45, 0.045, 0.27], [0, y, 0.008], accent, true);
  ball(rig.body, [0.2, 0.055, 0.15], [0, 0.97, 0], '#173e5a', 8);

  for (const arm of [rig.armL, rig.armR]) {
    const grip = arm.getObjectByName('worker-hand');
    if (!grip) continue;
    const mitten = ball(grip, [0.085, 0.1, 0.075], [0, 0, 0], '#173e5a', 8);
    mitten.name = 'snowboard-mitten';
  }

  if (!faceCovered) {
    const goggles = new T.Group();
    goggles.name = 'park-pro-goggles';
    box(goggles, [0.47, 0.13, 0.055], [0, 0.29, 0.264], '#f1bd43', true);
    box(goggles, [0.58, 0.045, 0.045], [0, 0.29, 0.025], '#173e5a', true);
    rig.head.add(goggles);
  }
}

export function riderModel(color: number, look?: Look) {
  const suit = seatKit(color);
  const root = new T.Group();
  const { model: body, worn } = dressedGameAvatar(
    color,
    {
      shirt: suit,
      overalls: CLOTH.teal,
      boots: CLOTH.navy,
      trousers: true,
    },
    look,
  );
  snowboard(root);
  body.rotation.y = Math.PI / 2;
  root.add(body);
  const rig = body.userData as RiderRig;
  for (const leg of [rig.legL, rig.legR]) {
    const anchor = new T.Object3D();
    anchor.name = 'snowboard-boot-anchor';
    anchor.position.set(0, -0.525, 0.045);
    leg.add(anchor);
  }
  root.updateMatrixWorld(true);
  body.position.y += BOARD_TOP - new T.Box3().setFromObject(body).min.y;
  root.updateMatrixWorld(true);

  const bootAnchors = body.getObjectsByProperty(
    'name',
    'snowboard-boot-anchor',
  );
  for (const [index, anchor] of bootAnchors.entries())
    binding(
      root,
      root.worldToLocal(anchor.getWorldPosition(new T.Vector3())),
      index ? 1 : -1,
    );
  winterGear(body, suit, worn.face);
  return { root, body };
}

export function poseRider(body: T.Group, p: Rider, time: number) {
  poseWorker(body, time, 'still');
  const rig = body.userData as RiderRig;
  const steer = Math.max(-1, Math.min(1, p.input.steer));
  const wipingOut = time * 1000 < p.wipeoutUntil;

  if (wipingOut) {
    rig.body.rotation.set(0.22, steer * -0.08, steer * 0.08);
    rig.legL.rotation.set(0.18, 0, 0.04);
    rig.legR.rotation.set(-0.18, 0, -0.04);
    rig.armL.rotation.set(-1.25, 0.1, 1.05);
    rig.armR.rotation.set(-1.25, -0.1, -1.05);
    return;
  }

  if (!p.grounded) {
    rig.body.rotation.set(0.08, steer * -0.1, steer * 0.05);
    rig.legL.rotation.set(0.12, 0, 0.08);
    rig.legR.rotation.set(-0.12, 0, -0.08);
    rig.armL.rotation.set(-1, 0.06, 0.82);
    rig.armR.rotation.set(-1, -0.06, -0.82);
    return;
  }

  const tuck = p.input.tuck;
  const flex = tuck ? 0.27 : 0.17;
  const sinceJump = time * 1000 - p.lastJump;
  const landingCompression =
    p.lastJump > 0 && sinceJump >= 0 && sinceJump < 1100
      ? (1 - sinceJump / 1100) * 0.065
      : 0;
  rig.body.position.y = Math.sin(time * 2) * 0.006 - landingCompression;
  rig.body.rotation.set(tuck ? 0.4 : 0.17, steer * -0.1, steer * 0.07);
  rig.legL.rotation.set(steer * 0.06, 0, flex);
  rig.legR.rotation.set(steer * -0.06, 0, -flex);
  rig.armL.rotation.set(tuck ? -0.88 : -0.48, 0.08, tuck ? 0.3 : 0.68);
  rig.armR.rotation.set(tuck ? -0.88 : -0.48, -0.08, tuck ? -0.3 : -0.68);
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
