import * as T from 'three';
import { soft, rounded, surface } from '../avatars/soft-parts';
import type { ItemModel } from './items';

type Point = [number, number, number];
const LOOK_GROUP = 'worker-look';
type MascotId =
  | 'cluck-cloud'
  | 'patchwork-moo'
  | 'wobble-cone'
  | 'steam-bun'
  | 'nimbus-nib';

type Palette = { suit: string; trim: string; accent: string; feet: string };

const PALETTES: Record<MascotId, Palette> = {
  'cluck-cloud': {
    suit: '#f5ead1',
    trim: '#fff7e7',
    accent: '#4caeaa',
    feet: '#e58a62',
  },
  'patchwork-moo': {
    suit: '#efe6d2',
    trim: '#574a61',
    accent: '#b39bc4',
    feet: '#554a57',
  },
  'wobble-cone': {
    suit: '#ed8853',
    trim: '#fff3df',
    accent: '#d86b47',
    feet: '#536673',
  },
  'steam-bun': {
    suit: '#f4dcae',
    trim: '#fff0d2',
    accent: '#ad8fb8',
    feet: '#735c7b',
  },
  'nimbus-nib': {
    suit: '#9acbd1',
    trim: '#d8e9ec',
    accent: '#a88dc2',
    feet: '#6b9da9',
  },
};

/** These models use the existing costume slot but need their own rigged shells. */
export const MASCOT_MODELS: Record<string, ItemModel> = Object.fromEntries(
  (Object.keys(PALETTES) as MascotId[]).map((id) => [
    id,
    {
      slot: 'costume',
      mascot: true,
      shirt: PALETTES[id].suit,
      overalls: PALETTES[id].suit,
      boots: PALETTES[id].feet,
      parts: [],
    },
  ]),
);

export function isMascot(id: string | undefined): id is MascotId {
  return !!id && Object.hasOwn(PALETTES, id);
}

let shellGeometry: T.SphereGeometry | undefined;
let rimGeometry: T.TubeGeometry | undefined;
const extraGeometries = new Map<string, T.BufferGeometry>();
const HOLE_X = 0.68;
const HOLE_Y = 0.64;

function sharedGeometry(key: string, make: () => T.BufferGeometry) {
  let geometry = extraGeometries.get(key);
  if (!geometry) {
    geometry = make();
    geometry.userData.shared = true;
    extraGeometries.set(key, geometry);
  }
  return geometry;
}

/** Closed ellipsoid with a real oval opening in front, rather than an overlay on the face. */
function hoodShell() {
  if (shellGeometry) return shellGeometry;
  const geometry = new T.SphereGeometry(1, 64, 48);
  const positions = geometry.getAttribute('position');
  const source = geometry.getIndex()!;
  const indices: number[] = [];
  for (let i = 0; i < source.count; i += 3) {
    const a = source.getX(i),
      b = source.getX(i + 1),
      c = source.getX(i + 2);
    const x = (positions.getX(a) + positions.getX(b) + positions.getX(c)) / 3;
    const y = (positions.getY(a) + positions.getY(b) + positions.getY(c)) / 3;
    const z = (positions.getZ(a) + positions.getZ(b) + positions.getZ(c)) / 3;
    if (z > 0 && (x / HOLE_X) ** 2 + (y / HOLE_Y) ** 2 < 1) continue;
    indices.push(a, b, c);
  }
  geometry.setIndex(indices);
  geometry.userData.shared = true;
  shellGeometry = geometry;
  return geometry;
}

function hoodRim() {
  if (rimGeometry) return rimGeometry;
  const points = Array.from({ length: 64 }, (_, i) => {
    const angle = (i / 64) * Math.PI * 2;
    const x = HOLE_X * Math.cos(angle),
      y = HOLE_Y * Math.sin(angle);
    return new T.Vector3(x, y, Math.sqrt(1 - x * x - y * y) + 0.015);
  });
  rimGeometry = new T.TubeGeometry(
    new T.CatmullRomCurve3(points, true),
    96,
    0.065,
    8,
    true,
  );
  rimGeometry.userData.shared = true;
  return rimGeometry;
}

function mesh(
  parent: T.Object3D,
  geometry: T.BufferGeometry,
  color: string,
  at: Point,
  scale: Point,
) {
  const part = new T.Mesh(geometry, surface(color));
  part.position.set(...at);
  part.scale.set(...scale);
  part.castShadow = true;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}

function tuft(
  parent: T.Object3D,
  at: Point,
  color: string,
  length: number,
  tilt = 0,
) {
  const part = soft(parent, [0.06, length, 0.07], at, color);
  part.rotation.z = tilt;
  return part;
}

function addHood(head: T.Object3D, id: MascotId, kid: boolean) {
  const colors = PALETTES[id];
  const group = new T.Group();
  group.name = LOOK_GROUP;
  group.userData.mascotSection = 'hood';
  head.add(group);
  const center: Point = kid ? [0, 0.28, 0] : [0, 0, 0];
  const scale: Point = kid ? [0.39, 0.39, 0.37] : [0.39, 0.39, 0.42];
  mesh(group, hoodShell(), colors.suit, center, scale).name =
    'mascot-hood-shell';
  mesh(group, hoodRim(), colors.trim, center, scale).name = 'mascot-face-rim';
  const top = center[1] + scale[1];
  const side = scale[0];
  switch (id) {
    case 'cluck-cloud':
      for (const [x, h, lean] of [
        [-0.12, 0.16, 0.28],
        [0, 0.2, 0],
        [0.12, 0.16, -0.28],
      ] as const)
        tuft(group, [x, top + h * 0.55, -0.025], colors.accent, h, lean);
      rounded(
        group,
        [0.16, 0.07, 0.08],
        [0, center[1] + 0.19, scale[2] * 0.87],
        colors.feet,
        0.025,
      );
      break;
    case 'patchwork-moo':
      for (const sign of [-1, 1]) {
        const ear = soft(
          group,
          [0.17, 0.085, 0.09],
          [sign * side, center[1] + 0.13, 0],
          colors.trim,
        );
        ear.rotation.z = sign * 0.27;
        tuft(
          group,
          [sign * 0.17, top + 0.035, -0.03],
          colors.trim,
          0.12,
          -sign * 0.28,
        );
      }
      break;
    case 'wobble-cone': {
      const cone = mesh(
        group,
        sharedGeometry('cone-tip', () => new T.ConeGeometry(0.23, 0.36, 24)),
        colors.suit,
        [0, top + 0.15, 0],
        [1, 1, 1],
      );
      cone.name = 'mascot-cone-tip';
      rounded(
        group,
        [0.28, 0.055, 0.27],
        [0, top + 0.065, 0],
        colors.trim,
        0.025,
      );
      break;
    }
    case 'steam-bun':
      for (const x of [-0.21, -0.1, 0, 0.1, 0.21])
        tuft(group, [x, top - 0.015, 0.045], colors.trim, 0.09, -x * 0.8);
      for (const [x, y] of [
        [-0.05, top + 0.14],
        [0.055, top + 0.19],
      ] as const)
        tuft(group, [x, y, -0.035], colors.accent, 0.12, x * 2);
      break;
    case 'nimbus-nib':
      for (const [x, y] of [
        [-0.3, 0.22],
        [0, 0.36],
        [0.3, 0.22],
      ] as const)
        soft(group, [0.11, 0.1, 0.11], [x, top + y - 0.28, -0.06], colors.trim);
      soft(
        group,
        [0.075, 0.11, 0.075],
        [-side * 0.92, center[1] - 0.1, 0],
        colors.accent,
      );
      soft(
        group,
        [0.075, 0.11, 0.075],
        [side * 0.92, center[1] - 0.1, 0],
        colors.accent,
      );
  }
  return group;
}

function addBody(body: T.Object3D, id: MascotId, kid: boolean) {
  const colors = PALETTES[id];
  const group = new T.Group();
  group.name = LOOK_GROUP;
  group.userData.mascotSection = 'body';
  body.add(group);
  const y = kid ? 0.75 : 0.88;
  const scale = kid ? 1 : 1.16;
  const width =
    (id === 'cluck-cloud' || id === 'steam-bun' ? 0.37 : 0.35) * scale;
  const height = (id === 'wobble-cone' ? 0.43 : 0.45) * scale;
  const depth = 0.3 * scale;
  if (id === 'wobble-cone') {
    mesh(
      group,
      sharedGeometry(
        `cone-body:${scale}`,
        () =>
          new T.CylinderGeometry(0.22 * scale, 0.4 * scale, 0.88 * scale, 32),
      ),
      colors.suit,
      [0, y, 0],
      [1, 1, 0.88],
    );
    for (const offset of [-0.15, 0.09]) {
      const radius = (0.31 - offset * 0.205) * scale;
      mesh(
        group,
        sharedGeometry(
          `cone-stripe:${scale}:${offset}`,
          () =>
            new T.CylinderGeometry(
              radius - 0.006 * scale,
              radius + 0.006 * scale,
              0.075 * scale,
              32,
              1,
              true,
            ),
        ),
        colors.trim,
        [0, y + offset * scale, 0],
        [1.04, 1, 0.91],
      );
    }
  } else {
    soft(group, [width, height, depth], [0, y, 0], colors.suit);
  }
  if (id === 'cluck-cloud') {
    soft(
      group,
      [0.24 * scale, 0.3 * scale, 0.055 * scale],
      [0, y - 0.02 * scale, depth * 0.94],
      colors.trim,
    );
    for (const x of [-0.15, 0, 0.15])
      tuft(
        group,
        [x * scale, y - 0.04 * scale, -depth - 0.04 * scale],
        colors.trim,
        0.16 * scale,
        -x,
      );
  } else if (id === 'patchwork-moo') {
    for (const [x, dy, z, sx, sy] of [
      [-0.17, 0.17, 0.25, 0.1, 0.13],
      [0.18, -0.11, 0.27, 0.13, 0.1],
      [0.11, 0.14, -0.28, 0.11, 0.14],
    ] as const)
      soft(
        group,
        [sx * scale, sy * scale, 0.045 * scale],
        [x * scale, y + dy * scale, z * scale],
        colors.trim,
      );
    const tail = tuft(
      group,
      [0, y - 0.2 * scale, -depth - 0.04 * scale],
      colors.trim,
      0.19 * scale,
      0.5,
    );
    tail.rotation.x = 0.65;
  } else if (id === 'steam-bun') {
    for (const x of [-0.24, -0.12, 0, 0.12, 0.24])
      soft(
        group,
        [0.025 * scale, 0.23 * scale, 0.025 * scale],
        [x * scale, y + 0.13 * scale, depth * 0.94],
        colors.trim,
      );
    soft(
      group,
      [0.16 * scale, 0.1 * scale, 0.035 * scale],
      [0, y - 0.18 * scale, depth],
      colors.accent,
    );
  } else if (id === 'nimbus-nib') {
    for (const [x, dy, z] of [
      [-0.3, 0.13, 0],
      [0.3, 0.13, 0],
      [-0.22, -0.19, 0.03],
      [0.22, -0.19, 0.03],
      [0, 0.16, -0.27],
    ] as const)
      soft(
        group,
        [0.15 * scale, 0.17 * scale, 0.17 * scale],
        [x * scale, y + dy * scale, z * scale],
        colors.trim,
      );
    soft(
      group,
      [0.19 * scale, 0.14 * scale, 0.045 * scale],
      [0, y - 0.04 * scale, depth],
      colors.accent,
    );
  }
}

/** All parts follow the avatar's existing movement rig; the face remains its own mesh. */
export function wearMascot(model: T.Object3D, id: string, kid: boolean) {
  if (!isMascot(id)) return;
  const rig = model.userData as Record<string, T.Object3D>;
  const colors = PALETTES[id];
  const head = kid ? rig.head : new T.Group();
  if (!kid) {
    head.position.y = 1.43;
    rig.body.add(head);
  }
  addHood(head, id, kid);
  addBody(rig.body, id, kid);
  const limbScale = kid ? 1 : 1.25;
  for (const sign of [-1, 1] as const) {
    const arm = kid
      ? rig[sign < 0 ? 'sleeveL' : 'sleeveR']
      : rig[sign < 0 ? 'armL' : 'armR'];
    const leg = rig[sign < 0 ? 'legL' : 'legR'];
    const sleeve = new T.Group();
    sleeve.name = LOOK_GROUP;
    sleeve.userData.mascotSection = 'sleeve';
    arm.add(sleeve);
    const wing = id === 'cluck-cloud';
    const sleevePart = soft(
      sleeve,
      [0.13 * limbScale, 0.29 * limbScale, (wing ? 0.16 : 0.135) * limbScale],
      [0, -0.17 * limbScale, 0],
      colors.suit,
    );
    sleevePart.rotation.z = sign * (wing ? 0.2 : 0.04);
    soft(
      sleeve,
      [0.13 * limbScale, 0.13 * limbScale, 0.13 * limbScale],
      [0, -0.39 * limbScale, 0.01],
      wing ? colors.trim : colors.feet,
    );
    if (wing)
      for (const dy of [-0.13, -0.2, -0.27])
        soft(
          sleeve,
          [0.055 * limbScale, 0.09 * limbScale, 0.06 * limbScale],
          [sign * 0.12 * limbScale, dy * limbScale, 0],
          colors.trim,
        );
    const trouser = new T.Group();
    trouser.name = LOOK_GROUP;
    trouser.userData.mascotSection = 'leg';
    leg.add(trouser);
    soft(
      trouser,
      [0.155 * limbScale, kid ? 0.27 : 0.28, 0.16 * limbScale],
      [0, kid ? -0.19 : -0.18, 0],
      colors.suit,
    );
    const footY = kid ? -0.43 : -0.35;
    soft(
      trouser,
      [0.17 * limbScale, kid ? 0.12 : 0.15, 0.21 * limbScale],
      [0, footY, 0.08 * limbScale],
      colors.feet,
    );
    if (wing)
      for (const x of [-0.1, 0, 0.1])
        soft(
          trouser,
          [0.055 * limbScale, 0.055 * limbScale, 0.1 * limbScale],
          [x * limbScale, kid ? -0.48 : -0.4, 0.25 * limbScale],
          colors.feet,
        );
    if (id === 'patchwork-moo')
      rounded(
        trouser,
        [0.25 * limbScale, 0.035 * limbScale, 0.1 * limbScale],
        [0, kid ? -0.49 : -0.41, 0.23 * limbScale],
        colors.trim,
        0.015 * limbScale,
      );
  }
  model.updateMatrixWorld(true);
  model.userData.hatTop = new T.Box3().setFromObject(head, true).max.y;
  model.userData.mascot = id;
}
