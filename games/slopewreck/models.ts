import * as T from 'three';
import { ball, box, taper } from '../../shared/rendering/primitives';
import { dressedGameAvatar } from '../../shared/rendering/game-avatar';
import { CLOTH, seatKit } from '../../shared/rendering/palette';
import { poseWorker } from '../../shared/rendering/worker-pose';
import type { Look } from '../../shared/wardrobe/look';
import type { Rider } from './types';

const BOARD_TOP = 0.15;
const BOARD_WIDTH_SCALE = 0.92;
const BOARD_LENGTH_SCALE = 0.89;

type RiderRig = {
  body: T.Group;
  head: T.Group;
  legL: T.Group;
  legR: T.Group;
  armL: T.Group;
  armR: T.Group;
};

export type BoardOutlinePoint = { x: number; z: number };

export function snowboardOutline(): BoardOutlinePoint[] {
  return [
    { x: 0, z: 1.48 },
    { x: 0.34, z: 1.43 },
    { x: 0.5, z: 1.27 },
    { x: 0.52, z: 1.02 },
    { x: 0.46, z: 0.52 },
    { x: 0.41, z: 0 },
    { x: 0.46, z: -0.52 },
    { x: 0.52, z: -1.02 },
    { x: 0.5, z: -1.27 },
    { x: 0.34, z: -1.43 },
    { x: 0, z: -1.48 },
    { x: -0.34, z: -1.43 },
    { x: -0.5, z: -1.27 },
    { x: -0.52, z: -1.02 },
    { x: -0.46, z: -0.52 },
    { x: -0.41, z: 0 },
    { x: -0.46, z: 0.52 },
    { x: -0.52, z: 1.02 },
    { x: -0.5, z: 1.27 },
    { x: -0.34, z: 1.43 },
  ].map(({ x, z }) => ({
    x: x * BOARD_WIDTH_SCALE,
    z: z * BOARD_LENGTH_SCALE,
  }));
}

const deckHeight = (z: number) =>
  BOARD_TOP +
  Math.max(0, Math.abs(z) / BOARD_LENGTH_SCALE - 1.02) * 0.52;

function boardDeck(topColor: string) {
  const outline = snowboardOutline();
  const positions: number[] = [];
  const add = (...points: Array<[number, number, number]>) => {
    for (const point of points) positions.push(...point);
  };
  const topStart = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    add(
      [0, BOARD_TOP, 0],
      [a.x, deckHeight(a.z), a.z],
      [b.x, deckHeight(b.z), b.z],
    );
  }
  const topCount = positions.length / 3;
  const bottomStart = topCount;
  for (let i = outline.length - 1; i >= 0; i--) {
    const a = outline[i];
    const b = outline[(i - 1 + outline.length) % outline.length];
    add(
      [0, 0.065, 0],
      [a.x, deckHeight(a.z) - 0.085, a.z],
      [b.x, deckHeight(b.z) - 0.085, b.z],
    );
  }
  const bottomCount = positions.length / 3 - bottomStart;
  const edgeStart = positions.length / 3;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const ay = deckHeight(a.z);
    const by = deckHeight(b.z);
    add(
      [a.x, ay, a.z],
      [a.x, ay - 0.085, a.z],
      [b.x, by, b.z],
      [b.x, by, b.z],
      [a.x, ay - 0.085, a.z],
      [b.x, by - 0.085, b.z],
    );
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.addGroup(topStart, topCount, 0);
  geometry.addGroup(bottomStart, bottomCount, 1);
  geometry.addGroup(edgeStart, positions.length / 3 - edgeStart, 2);
  geometry.computeVertexNormals();
  const deck = new T.Mesh(geometry, [
    new T.MeshStandardMaterial({ color: topColor, roughness: 0.64 }),
    new T.MeshStandardMaterial({ color: '#173e5a', roughness: 0.78 }),
    new T.MeshStandardMaterial({ color: '#23b5b1', roughness: 0.48 }),
  ]);
  deck.name = 'snowboard-deck';
  deck.castShadow = true;
  deck.receiveShadow = true;
  deck.userData.outline = outline;
  return deck;
}

function snowboard(root: T.Group, topColor: string) {
  const board = new T.Group();
  board.name = 'snowboard';
  root.add(board);
  board.add(boardDeck(topColor));
  const slash = box(
    board,
    [0.68, 0.018, 0.11],
    [0, BOARD_TOP + 0.012, 0.02],
    '#f6e5a4',
    true,
  );
  slash.rotation.y = -0.28;

  const trails = new T.Group();
  trails.name = 'snowboard-trails';
  for (const x of [-0.26, 0.26]) {
    const trail = new T.Mesh(
      new T.PlaneGeometry(0.075, 1.35),
      new T.MeshBasicMaterial({
        color: '#b9e8e6',
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
      }),
    );
    trail.rotation.x = -Math.PI / 2;
    trail.position.set(x, 0.025, -1.85);
    trails.add(trail);
  }
  root.add(trails);

  const spray = new T.Group();
  spray.name = 'snow-impact';
  spray.visible = false;
  for (let i = 0; i < 7; i++)
    ball(
      spray,
      [0.08 + (i % 3) * 0.025, 0.06, 0.08],
      [((i % 4) - 1.5) * 0.16, 0.12 + (i % 2) * 0.12, -0.4 - i * 0.09],
      i % 2 ? '#ffffff' : '#cceceb',
      6,
    );
  root.add(spray);
}

function binding(root: T.Group, position: T.Vector3, side: number) {
  const mount = new T.Group();
  mount.name = 'snowboard-binding';
  mount.position.set(position.x, BOARD_TOP, position.z);
  mount.rotation.y = side * 0.16;
  root.add(mount);
  box(mount, [0.38, 0.045, 0.25], [0, 0.022, 0], '#f4d068', true);
  box(mount, [0.08, 0.22, 0.27], [-0.16, 0.12, -0.01], '#173e5a', true);
  box(
    mount,
    [0.36, 0.07, 0.065],
    [0.02, 0.095, 0.055],
    '#f8f3df',
    true,
  ).rotation.z = -0.12;
  box(
    mount,
    [0.34, 0.075, 0.06],
    [-0.02, 0.14, -0.065],
    '#f0b33f',
    true,
  ).rotation.z = 0.14;
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
  snowboard(root, suit);
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
  const impact = time * 1000 < p.impactUntil ? p.impactSide : 0;

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
  rig.body.rotation.set(
    tuck ? 0.4 : 0.17,
    steer * -0.14 + impact * 0.12,
    steer * 0.09 + impact * 0.08,
  );
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
