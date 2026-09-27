import * as T from 'three';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import {
  ball,
  beam,
  box,
  label,
  taper,
} from '../../shared/rendering/primitives';
import {
  BENCH_LENGTH,
  BENCH_ROOT_Y,
  BENCH_ROWS,
  BENCH_SEAT_CENTER_Y,
  BENCH_SEAT_HEIGHT,
  benchLayout,
  type CourseSide,
} from './environment-layout';

const CREAM = '#f4ead2';
const NAVY = '#354f55';
const TIMBER = '#a97c52';
const TIMBER_DARK = '#76583f';
const GRASS = '#648b58';
const GRASS_DARK = '#4f7650';
const LEAF = '#6f965f';
const LEAF_DARK = '#52764f';
const PATH = '#c9ae7e';
const ORANGE = '#d97853';
const YELLOW = '#e4b947';

function tree(root: T.Group, x: number, z: number, scale = 1) {
  const group = new T.Group();
  taper(group, 0.23, 0.34, 3.4, [0, 1.35, 0], TIMBER_DARK, 9);
  ball(group, [1.3, 1.1, 1.16], [0, 3.15, 0], LEAF_DARK, 10);
  ball(group, [1.06, 0.9, 0.96], [-0.72, 3.02, 0.05], LEAF, 10);
  ball(group, [0.98, 1.04, 0.92], [0.66, 3.35, -0.08], '#789f64', 10);
  group.position.set(x, -0.25, z);
  group.scale.setScalar(scale);
  root.add(group);
}

function planter(root: T.Group, x: number, z: number, width = 2.2) {
  box(root, [width, 0.62, 0.82], [x, -0.03, z], TIMBER, true);
  box(root, [width - 0.18, 0.14, 0.66], [x, 0.26, z], '#544934', true);
  const count = Math.max(3, Math.round(width * 2));
  for (let index = 0; index < count; index++) {
    const px = x - width * 0.4 + (index / Math.max(1, count - 1)) * width * 0.8;
    beam(
      root,
      [px, 0.28, z],
      [px + 0.08, 0.82 + (index % 2) * 0.18, z],
      0.035,
      GRASS_DARK,
    );
    const leaf = ball(
      root,
      [0.17, 0.34, 0.13],
      [px + (index % 2 ? -0.08 : 0.08), 0.7, z],
      index % 2 ? LEAF : '#88a966',
      8,
    );
    leaf.rotation.z = index % 2 ? -0.4 : 0.4;
  }
}

function bench(root: T.Group, side: CourseSide, z: number) {
  const layout = benchLayout(side, z);
  const group = new T.Group();
  box(
    group,
    [BENCH_LENGTH, BENCH_SEAT_HEIGHT, 0.62],
    [0, BENCH_SEAT_CENTER_Y, 0],
    TIMBER,
    true,
  );
  // Both sides use the same local backrest position; the group transform mirrors
  // the bench so its open side and the seated crowd face the course.
  box(group, [BENCH_LENGTH, 0.72, 0.15], [0, 0.85, -0.28], '#bc9262', true);
  for (const x of [-1.18, 1.18]) {
    beam(group, [x, -0.08, -0.22], [x, 0.42, -0.22], 0.09, NAVY);
    beam(group, [x, -0.08, 0.22], [x, 0.42, 0.22], 0.09, NAVY);
  }
  group.position.set(layout.x, BENCH_ROOT_Y, layout.z);
  group.rotation.y = layout.rotation;
  root.add(group);
}

function fence(root: T.Group, side: number) {
  const x = side * 9.6;
  for (let z = -3; z <= 20; z += 2.3) {
    taper(root, 0.07, 0.1, 1.7, [x, 0.45, z], CREAM, 8);
    if (z < 19) {
      beam(root, [x, 0.25, z], [x, 0.25, z + 2.3], 0.075, CREAM);
      beam(root, [x, 0.92, z], [x, 0.92, z + 2.3], 0.075, CREAM);
    }
  }
}

function bunting(root: T.Group) {
  const z = 19.2;
  for (let index = 0; index < 16; index++) {
    const x = -8.2 + index * 1.05;
    const next = x + 1.05;
    const y = 4.2 - Math.cos((index / 15) * Math.PI) * 0.36;
    const nextY = 4.2 - Math.cos(((index + 1) / 15) * Math.PI) * 0.36;
    beam(root, [x, y, z], [next, nextY, z], 0.025, CREAM);
    const geometry = new T.BufferGeometry().setAttribute(
      'position',
      new T.Float32BufferAttribute(
        [
          x + 0.17,
          y - 0.03,
          z - 0.02,
          x + 0.82,
          y - 0.03,
          z - 0.02,
          x + 0.5,
          y - 0.62,
          z - 0.02,
        ],
        3,
      ),
    );
    geometry.computeVertexNormals();
    const flag = new T.Mesh(
      geometry,
      new T.MeshStandardMaterial({
        color: index % 3 === 0 ? ORANGE : index % 3 === 1 ? YELLOW : '#6e9990',
        side: T.DoubleSide,
        roughness: 0.88,
      }),
    );
    root.add(flag);
  }
}

function clubhouse(root: T.Group) {
  const club = new T.Group();
  box(club, [8.7, 3.4, 2.75], [0, 1.35, 0], '#dfc391', true);
  const roof = new T.Mesh(
    new T.ConeGeometry(5.25, 2.2, 4),
    new T.MeshStandardMaterial({ color: ORANGE, roughness: 0.88 }),
  );
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.54;
  roof.position.y = 3.45;
  roof.castShadow = roof.receiveShadow = true;
  club.add(roof);
  box(club, [1.45, 2.35, 0.18], [-2.55, 0.9, -1.46], NAVY, true);
  box(club, [2.35, 1.2, 0.18], [1.55, 1.55, -1.46], '#81b6c4', true);
  for (const x of [0.43, 1.55, 2.67])
    box(club, [0.08, 1.12, 0.22], [x, 1.55, -1.5], CREAM);
  box(club, [2.8, 0.14, 1.15], [1.55, 0.28, -1.78], TIMBER, true);
  for (const x of [0.45, 2.65])
    beam(club, [x, -0.3, -1.55], [x, 0.25, -1.55], 0.1, NAVY);
  const sign = label('BACKYARD OPEN', CREAM, NAVY, 4.4);
  sign.position.set(0, 3.1, -1.5);
  club.add(sign);
  club.position.set(0, -0.25, 21.1);
  root.add(club);
}

export function createBackyardEnvironment() {
  const root = new T.Group();
  root.name = 'course-backyard-open';

  box(root, [25, 0.58, 29], [0, -0.68, 8.5], GRASS, true);
  box(root, [3.2, 0.08, 27], [-7.65, -0.35, 8.4], PATH, true);
  box(root, [3.2, 0.08, 27], [7.65, -0.35, 8.4], PATH, true);
  box(root, [16.2, 0.08, 2.8], [0, -0.34, -2.35], PATH, true);

  clubhouse(root);
  fence(root, -1);
  fence(root, 1);
  bunting(root);

  for (const side of [-1, 1] as const) {
    for (const z of BENCH_ROWS) bench(root, side, z);
    planter(root, side * 8.1, 18.4, 2.5);
    planter(root, side * 6.5, -1.4, 2);
  }

  tree(root, -9, 18.5, 1.05);
  tree(root, 8.7, 18.2, 0.92);
  tree(root, -9.6, 1.6, 0.78);
  tree(root, 9.4, 5.1, 0.72);

  // Tournament equipment gives the near corners a purpose without blocking play.
  for (const side of [-1, 1]) {
    box(root, [1.1, 0.8, 0.82], [side * 6.8, 0.02, -2.25], NAVY, true);
    taper(root, 0.25, 0.34, 0.8, [side * 7.55, 0.02, -2.25], ORANGE, 12);
    box(root, [0.82, 0.07, 0.72], [side * 6.8, 0.46, -2.25], CREAM, true);
  }

  batchScenery(root, [], true);
  return root;
}
