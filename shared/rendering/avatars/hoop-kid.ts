import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CLOTH, COLORS } from '../palette';
import type { WorkerOutfit } from '../worker';
import { blink, capsule, lathe, rounded, soft, surface } from './soft-parts';

/**
 * The clay basketball kids from the owner's court picture (Lola and Nico):
 * a big round head with rosy cheeks and an open smile, a sleeveless jersey
 * and shorts with white piping, wristbands, white socks and high-top
 * sneakers. This file builds everything but the hair; each kid adds theirs.
 */
type Point = [number, number, number];

const SKIN = '#de9268';
const SKIN_SHADE = '#cc7a55';
const INK = '#2e1c16';
const BROW = '#4a2c20';
const BLUSH = '#e97767';
const MOUTH = '#7a2927';
const TONGUE = '#e0746c';
const TEETH = '#fbf6ec';
const TRIM = CLOTH.white;
/** Clay has a soft sheen, a little glossier than the cloth. */
const CLAY = 0.6;

/** Where each leg swings from, and where the head sits on the neck. */
export const HIP: Point = [0.11, 0.55, 0];
export const SHOULDER: Point = [0.245, 0.885, 0];
export const HEAD_Y = 1.04;
/** The jersey is a lathe squashed front to back by this much. */
export const DEPTH = 0.74;
/** Where long trousers end, below the hip. */
export const TROUSER_HEM = -0.37;
/** Where a hat's brim sits on the head, in head space: just above the brows. */
export const HAT_BRIM = 0.43;

export type Ellipsoid = { centre: Point; radii: Point };
/** The skull, and the chubby cheeks and jaw below it, in head space. */
export const SKULL: Ellipsoid = {
  centre: [0, 0.3, 0],
  radii: [0.31, 0.29, 0.28],
};
export const JAW: Ellipsoid = {
  centre: [0, 0.19, 0.035],
  radii: [0.265, 0.19, 0.25],
};

const FORWARD = new T.Vector3(0, 0, 1);
const geometries = new Map<string, T.BufferGeometry>();
const clays = new Map<string, T.MeshStandardMaterial>();
let glint: T.MeshBasicMaterial | undefined;
let mouth: T.MeshStandardMaterial | undefined;
let thumbprints: T.DataTexture | undefined;

/**
 * Soft lumps and a fine grain, like modelling clay pressed by hand. Built
 * from numbers alone, so it needs no canvas, and tiles in both directions.
 */
function clayBump() {
  if (thumbprints) return thumbprints;
  const size = 128;
  const lattice = (cells: number, seed: number) => {
    const values: number[] = [];
    for (let i = 0; i < cells * cells; i++) {
      const x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
      values.push(x - Math.floor(x));
    }
    return (u: number, v: number) => {
      const x = u * cells,
        y = v * cells;
      const x0 = Math.floor(x),
        y0 = Math.floor(y);
      const at = (i: number, j: number) =>
        values[
          (((j % cells) + cells) % cells) * cells +
            (((i % cells) + cells) % cells)
        ];
      const fx = (x - x0) ** 2 * (3 - 2 * (x - x0));
      const fy = (y - y0) ** 2 * (3 - 2 * (y - y0));
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
      const bottom =
        at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
      return top + (bottom - top) * fy;
    };
  };
  const lumps = lattice(8, 1);
  const grain = lattice(32, 2);
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const value =
        lumps(i / size, j / size) * 0.7 + grain(i / size, j / size) * 0.3;
      data.fill(
        Math.round(value * 255),
        (j * size + i) * 4,
        (j * size + i) * 4 + 3,
      );
      data[(j * size + i) * 4 + 3] = 255;
    }
  thumbprints = new T.DataTexture(data, size, size);
  thumbprints.wrapS = thumbprints.wrapT = T.RepeatWrapping;
  thumbprints.magFilter = T.LinearFilter;
  thumbprints.minFilter = T.LinearMipmapLinearFilter;
  thumbprints.generateMipmaps = true;
  thumbprints.repeat.set(3, 2);
  thumbprints.needsUpdate = true;
  return thumbprints;
}

/**
 * Gives every plain material on the kid the clay's lumpy surface. Materials
 * are cached by colour and roughness, so a crowd of kids shares them.
 */
export function inClay<Model extends T.Object3D>(root: Model) {
  root.traverse((object) => {
    const mesh = object as T.Mesh;
    const material = mesh.material as T.MeshStandardMaterial;
    if (!mesh.isMesh || !material.isMeshStandardMaterial || material === mouth)
      return;
    const key = `${material.color.getHexString()}:${material.roughness}`;
    let clay = clays.get(key);
    if (!clay) {
      clay = new T.MeshStandardMaterial({
        color: material.color,
        roughness: material.roughness,
        bumpMap: clayBump(),
        bumpScale: 1.2,
      });
      clay.userData.shared = true;
      clays.set(key, clay);
    }
    mesh.material = clay;
  });
  return root;
}

function cached(key: string, make: () => T.BufferGeometry) {
  let geometry = geometries.get(key);
  if (!geometry) {
    geometry = make();
    geometry.userData.shared = true;
    geometries.set(key, geometry);
  }
  return geometry;
}

function add(parent: T.Object3D, mesh: T.Mesh, position: Point) {
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Skin: an ellipsoid with the clay's sheen. */
function skin(parent: T.Object3D, radii: Point, position: Point, color = SKIN) {
  const mesh = soft(parent, radii, position, color);
  mesh.material = surface(color, CLAY);
  return mesh;
}

/** A band or sleeve: a cylinder, wider at the bottom when `bottom` is given. */
function band(
  parent: T.Object3D,
  radius: number,
  height: number,
  position: Point,
  color: string,
  bottom = radius,
) {
  const geometry = cached(
    `band:${radius}:${bottom}:${height}`,
    () => new T.CylinderGeometry(radius, bottom, height, 28),
  );
  return add(parent, new T.Mesh(geometry, surface(color)), position);
}

/** A ring of piping around the Z axis, `radius` to the middle of the tube. */
export function ring(
  parent: T.Object3D,
  radius: number,
  tube: number,
  position: Point,
  color: string,
) {
  const geometry = cached(
    `ring:${radius}:${tube}`,
    () => new T.TorusGeometry(radius, tube, 10, 36),
  );
  return add(parent, new T.Mesh(geometry, surface(color)), position);
}

/**
 * The top of an ellipsoid down to `reach` radians from its pole, tipped back
 * by `tilt`, for hair. The shape is baked into the buffer, so the admin's
 * bounding boxes measure the hair itself rather than a turned box around it.
 */
export function dome(
  parent: T.Object3D,
  reach: number,
  radii: Point,
  tilt: number,
  position: Point,
  color: string,
) {
  const geometry = cached(`dome:${reach}:${radii.join(':')}:${tilt}`, () =>
    new T.SphereGeometry(1, 36, 20, 0, Math.PI * 2, 0, reach)
      .scale(...radii)
      .rotateX(-tilt),
  );
  return add(parent, new T.Mesh(geometry, surface(color, CLAY)), position);
}

/**
 * Thin tubes through each list of points, as one mesh: brows, piping and
 * strands pressed into hair. `closed` joins each tube into a loop.
 */
export function strokes(
  parent: T.Object3D,
  curves: Point[][],
  radius: number,
  color: string,
  closed = false,
) {
  const key = `strokes:${radius}:${closed}:${curves.flat(2).join(':')}`;
  const geometry = cached(key, () => {
    const tubes = curves.map((points) => {
      const curve = new T.CatmullRomCurve3(
        points.map((point) => new T.Vector3(...point)),
        closed,
      );
      return new T.TubeGeometry(curve, closed ? 48 : 12, radius, 8, closed);
    });
    const merged = mergeGeometries(tubes)!;
    for (const tube of tubes) tube.dispose();
    return merged;
  });
  return add(parent, new T.Mesh(geometry, surface(color)), [0, 0, 0]);
}

/** How far out the face is at (x, y) in head space, and which way it faces. */
export function faceAt(x: number, y: number, shapes = [SKULL, JAW]) {
  let best: { z: number; normal: T.Vector3 } | undefined;
  for (const { centre, radii } of shapes) {
    const u =
      ((x - centre[0]) / radii[0]) ** 2 + ((y - centre[1]) / radii[1]) ** 2;
    if (u >= 1) continue;
    const z = centre[2] + radii[2] * Math.sqrt(1 - u);
    if (best && best.z >= z) continue;
    best = {
      z,
      normal: new T.Vector3(
        (x - centre[0]) / radii[0] ** 2,
        (y - centre[1]) / radii[1] ** 2,
        (z - centre[2]) / radii[2] ** 2,
      ).normalize(),
    };
  }
  return best ?? { z: 0, normal: FORWARD.clone() };
}

/** Rests `object` on the face at (x, y), `lift` out along the surface. */
export function onFace(
  object: T.Object3D,
  x: number,
  y: number,
  lift = 0,
  shapes?: Ellipsoid[],
) {
  const { z, normal } = faceAt(x, y, shapes);
  object.position.set(x, y, z).addScaledVector(normal, lift);
  object.quaternion.setFromUnitVectors(FORWARD, normal);
  return object;
}

/** A big glossy clay eye: a dark oval with two highlights. */
function eye(head: T.Group, side: number) {
  const group = new T.Group();
  onFace(group, side * 0.125, 0.31, -0.012);
  head.add(group);
  soft(group, [0.057, 0.073, 0.03], [0, 0, 0], INK).material = surface(
    INK,
    0.25,
  );
  glint ??= new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  soft(group, [0.021, 0.025, 0.01], [0.019, 0.026, 0.024], INK).material =
    glint;
  soft(group, [0.01, 0.01, 0.008], [-0.02, -0.028, 0.024], INK).material =
    glint;
  return group;
}

/** An open smile: a dark half-oval with a tongue, and teeth when asked. */
function openSmile(head: T.Group, teeth: boolean) {
  const group = new T.Group();
  onFace(group, 0, 0.17, -0.008);
  head.add(group);
  const geometry = cached(
    'smile-bowl',
    () =>
      new T.SphereGeometry(1, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
  );
  mouth ??= new T.MeshStandardMaterial({
    color: MOUTH,
    roughness: 0.5,
    side: T.DoubleSide,
  });
  add(group, new T.Mesh(geometry, mouth), [0, 0, 0]).scale.set(
    0.08,
    0.062,
    0.03,
  );
  soft(group, [0.047, 0.02, 0.02], [0, -0.043, 0.006], TONGUE);
  if (teeth)
    rounded(group, [0.1, 0.022, 0.02], [0, -0.012, 0.012], TEETH, 0.009);
  // A soft upper lip keeps the top edge of the smile from looking cut.
  strokes(
    group,
    [
      [
        [-0.082, 0.004, 0],
        [0, 0.006, 0.01],
        [0.082, 0.004, 0],
      ],
    ],
    0.008,
    SKIN_SHADE,
  );
  return group;
}

function face(head: T.Group, teeth: boolean, ears: boolean) {
  skin(head, SKULL.radii, SKULL.centre);
  skin(head, JAW.radii, JAW.centre);
  if (ears)
    for (const side of [-1, 1]) {
      skin(head, [0.05, 0.072, 0.04], [side * 0.3, 0.28, 0]);
      skin(head, [0.024, 0.04, 0.012], [side * 0.325, 0.28, 0.025], SKIN_SHADE);
    }
  const eyes = [-1, 1].map((side) => eye(head, side));
  const brows = [-1, 1].map((side) =>
    [-0.045, 0, 0.045].map((dx, i): Point => {
      const x = side * 0.125 + dx;
      const y = 0.404 + (i === 1 ? 0.014 : 0) + (dx * side > 0 ? -0.006 : 0);
      return [x, y, faceAt(x, y).z + 0.004];
    }),
  );
  strokes(head, brows, 0.011, BROW);
  for (const side of [-1, 1]) {
    onFace(
      skin(head, [0.058, 0.036, 0.012], [0, 0, 0], BLUSH),
      side * 0.178,
      0.215,
      -0.004,
    );
  }
  onFace(
    skin(head, [0.036, 0.028, 0.03], [0, 0, 0], SKIN_SHADE),
    0,
    0.25,
    -0.012,
  );
  openSmile(head, teeth);
  return eyes;
}

/** The jersey's side profile as [radius, height]; the lathe squashes depth. */
function jerseyProfile(): [number, number][] {
  return [
    [0.001, -0.005],
    [0.245, 0],
    [0.255, 0.1],
    [0.247, 0.22],
    [0.232, 0.31],
    [0.205, 0.37],
    [0.16, 0.41],
    [0.09, 0.435],
    [0.001, 0.44],
  ];
}

/** A profile's radius at `height`, straight between its points. */
function radiusAt(profile: [number, number][], height: number) {
  for (let i = 1; i < profile.length; i++) {
    const [r0, h0] = profile[i - 1];
    const [r1, h1] = profile[i];
    if (height <= h1) return r0 + ((r1 - r0) * (height - h0)) / (h1 - h0);
  }
  return 0;
}

/** The jersey's half-width at `height` above the hem. */
export function jerseyRadius(height: number) {
  return radiusAt(jerseyProfile(), height);
}

/** Piping round an armhole, lying on the jersey's side. */
function armhole(side: number) {
  const points: Point[] = [];
  for (let i = 0; i < 24; i++) {
    const turn = (i / 24) * Math.PI * 2;
    const y = 0.855 + 0.095 * Math.sin(turn);
    const z = 0.085 * Math.cos(turn);
    const half = jerseyRadius(y - HIP[1]);
    const x = half * Math.sqrt(Math.max(0, 1 - (z / (half * DEPTH)) ** 2));
    points.push([side * (x + 0.004), y, z]);
  }
  return points;
}

function shortsLegProfile(): [number, number][] {
  return [
    [0.001, -0.17],
    [0.142, -0.17],
    [0.13, -0.04],
    [0.118, 0.06],
    [0.001, 0.07],
  ];
}

/** Long trousers, for a wardrobe item worn on the legs: down to the high-tops. */
function trouserLegProfile(): [number, number][] {
  return [
    [0.001, TROUSER_HEM],
    [0.104, TROUSER_HEM],
    [0.11, -0.26],
    [0.13, -0.13],
    [0.13, -0.04],
    [0.118, 0.06],
    [0.001, 0.07],
  ];
}

/** How far out long trousers reach at `y` below the hip. */
export function trouserRadius(y: number) {
  const outline = trouserLegProfile().slice(1, -1);
  return radiusAt(outline, Math.min(0.06, Math.max(TROUSER_HEM, y)));
}

function leg(
  body: T.Group,
  side: number,
  kit: string,
  shorts: string,
  trousers: boolean,
) {
  const leg = new T.Group();
  leg.position.set(side * HIP[0], HIP[1], HIP[2]);
  body.add(leg);
  if (trousers)
    lathe(leg, 'hoop-trouser-leg', trouserLegProfile, [0, 0, 0], shorts);
  else {
    lathe(leg, 'hoop-shorts-leg', shortsLegProfile, [0, 0, 0], shorts);
    band(leg, 0.143, 0.032, [0, -0.155, 0], TRIM, 0.146);
    rounded(
      leg,
      [0.022, 0.2, 0.05],
      [side * 0.132, -0.06, 0],
      TRIM,
      0.01,
    ).rotation.z = side * 0.07;
    capsule(leg, 0.068, 0.19, [0, -0.29, 0], SKIN).material = surface(
      SKIN,
      CLAY,
    );
    band(leg, 0.076, 0.13, [0, -0.39, 0], TRIM, 0.074);
  }
  // A high-top sneaker in the kit colour, with a white toe, sole and laces.
  const foot = -HIP[1];
  band(leg, 0.086, 0.08, [0, foot + 0.165, 0.005], kit, 0.09);
  soft(leg, [0.092, 0.085, 0.155], [0, foot + 0.095, 0.04], kit);
  soft(leg, [0.086, 0.056, 0.072], [0, foot + 0.07, 0.132], TRIM);
  rounded(leg, [0.184, 0.05, 0.325], [0, foot + 0.025, 0.045], TRIM, 0.022);
  for (const [z, y] of [
    [0.055, 0.176],
    [0.1, 0.162],
  ])
    rounded(
      leg,
      [0.075, 0.014, 0.02],
      [0, foot + y, z],
      TRIM,
      0.006,
    ).rotation.x = 0.35;
  soft(leg, [0.006, 0.03, 0.075], [side * 0.089, foot + 0.1, 0.03], TRIM);
  return leg;
}

function arm(body: T.Group, side: number, kit: string) {
  const arm = new T.Group();
  arm.position.set(side * SHOULDER[0], SHOULDER[1], SHOULDER[2]);
  body.add(arm);
  const splay = new T.Group();
  splay.rotation.z = side * 0.17;
  arm.add(splay);
  skin(splay, [0.064, 0.068, 0.064], [0, -0.01, 0]);
  capsule(splay, 0.061, 0.23, [0, -0.165, 0], SKIN).material = surface(
    SKIN,
    CLAY,
  );
  band(splay, 0.072, 0.075, [0, -0.3, 0], kit);
  skin(splay, [0.072, 0.084, 0.066], [0, -0.39, 0.01]);
  skin(splay, [0.028, 0.045, 0.03], [-side * 0.058, -0.372, 0.042]).rotation.z =
    side * 0.5;
  return { arm, splay };
}

/** How a wardrobe look changes the kid: long trousers, or a hat to fit under. */
export type KidStyle = { trousers?: boolean; hat?: boolean | string };

export type HoopKid = {
  root: T.Group;
  body: T.Group;
  head: T.Group;
  /** Hair that swings as the kid runs, such as pigtails. */
  swinging: T.Group[];
};

/**
 * Builds the kid without hair. The kit is the player colour unless `outfit`
 * sets it: `shirt` is the jersey, `overalls` the shorts and `boots` the
 * sneakers, and the shorts and sneakers match the jersey by default. With
 * `trousers` the shorts reach down to the sneakers. The kid keeps the
 * worker's rig: feet at zero, facing +Z. `sleeveL` and `sleeveR` are the
 * groups each arm hangs in, a little out from the body.
 */
export function hoopKid(
  color: number,
  outfit: WorkerOutfit,
  features: { teeth: boolean; ears: boolean; trousers?: boolean },
): HoopKid {
  const kit = outfit.shirt ?? COLORS[color % COLORS.length];
  const shorts = outfit.overalls ?? kit;
  const shoes = outfit.boots ?? kit;
  const root = new T.Group(),
    body = new T.Group();
  root.add(body);

  soft(body, [0.232, 0.12, 0.172], [0, 0.545, 0], shorts);
  lathe(body, 'hoop-jersey', jerseyProfile, [0, HIP[1], 0], kit).scale.z =
    DEPTH;
  // Piping round the neck, dipping a little at the front, and the armholes.
  const collar = ring(body, 0.1, 0.017, [0, 0.975, 0.004], TRIM);
  collar.rotation.x = Math.PI / 2 + 0.16;
  collar.scale.y = 0.82;
  strokes(body, [armhole(-1), armhole(1)], 0.015, TRIM, true);
  capsule(body, 0.07, 0.07, [0, 1.02, 0.005], SKIN).material = surface(
    SKIN,
    CLAY,
  );

  const head = new T.Group();
  head.position.y = HEAD_Y;
  body.add(head);
  const eyes = face(head, features.teeth, features.ears);

  const legs = [-1, 1].map((side) =>
    leg(body, side, shoes, shorts, !!features.trousers),
  );
  const limbs = [-1, 1].map((side) => arm(body, side, kit));
  const arms = limbs.map(({ arm }) => arm);
  const swinging: T.Group[] = [];
  Object.assign(root.userData, {
    body,
    head,
    eyes,
    legs,
    arms,
    legL: legs[0],
    legR: legs[1],
    armL: arms[0],
    armR: arms[1],
    sleeveL: limbs[0].splay,
    sleeveR: limbs[1].splay,
    swinging,
  });
  return { root, body, head, swinging };
}

type KidRig = {
  body: T.Group;
  head: T.Group;
  eyes: T.Group[];
  legL: T.Group;
  legR: T.Group;
  armL: T.Group;
  armR: T.Group;
  swinging: T.Group[];
};

/**
 * A bouncy kid's run, arms pumping and hair swinging; standing, a little
 * sway, a glance about and a blink. `time` is in seconds.
 */
export function runHoopKid(model: T.Object3D, time: number, walking: boolean) {
  const rig = model.userData as KidRig;
  const swing = walking ? Math.sin(time * 9) : 0;
  rig.legL.rotation.x = swing * 0.62;
  rig.legR.rotation.x = -swing * 0.62;
  rig.armL.rotation.x = -swing * 0.75;
  rig.armR.rotation.x = swing * 0.75;
  rig.body.position.y = walking ? Math.abs(swing) * 0.05 : 0;
  rig.body.rotation.y = swing * 0.06;
  liveHoopKid(model, time, walking);
}

/**
 * Only the face and hair: a tilt and glance of the head, swinging hair and a
 * blink. For a game that poses the body and limbs itself.
 */
export function liveHoopKid(model: T.Object3D, time: number, moving: boolean) {
  const rig = model.userData as KidRig;
  const beat = time * 9;
  const swing = moving ? Math.sin(beat) : 0;
  const bounce = Math.abs(swing);
  rig.head.rotation.z = moving
    ? Math.sin(beat / 2) * 0.04
    : Math.sin(time * 1.1) * 0.035;
  rig.head.rotation.y = moving ? -swing * 0.04 : Math.sin(time * 0.6) * 0.18;
  for (const [i, hair] of rig.swinging.entries()) {
    const side = hair.userData.side as number;
    hair.rotation.z = moving
      ? side * (bounce * 0.28 - 0.08)
      : side * Math.sin(time * 1.6 + i) * 0.05;
    hair.rotation.x = moving ? swing * 0.2 : 0;
  }
  const open = blink(time, 0.8);
  for (const eye of rig.eyes) eye.scale.y = open;
}
