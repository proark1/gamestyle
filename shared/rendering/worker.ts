import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS } from './palette';

/** What a game may change about its worker: the clothes and hat, never the body. */
export type WorkerOutfit = {
  /** Shirt and sleeves, and the cap while it is worn; the player colour by default. */
  shirt?: string;
  /** Hips, bib, braces and trouser legs. */
  overalls?: string;
  boots?: string;
  /** False leaves the head bare for the game's own hat. */
  cap?: boolean;
};

/** The top of the worker's head, where a game's own hat sits. */
export const WORKER_HEAD_TOP = 1.68;

/** The centre of each hand below its shoulder joint, where held props go. */
export const WORKER_HAND_Y = -0.45;

const SKIN = '#e6b58b';
const SKIN_SHADE = '#d49670';
const INK = '#283b34';
const BROW = '#5b3b2a';
const HAIR = '#7a5438';
const BLUSH = '#e8998a';
const BADGE = '#f4ead2';
const GLINT = '#fbf7ee';

// The worker has its own smooth, softly rounded parts; scenery keeps the
// faceted look of `primitives`. Both caches are shared by every worker.
const materials = new Map<string, T.MeshStandardMaterial>();
const geometries = new Map<string, T.BufferGeometry>();

function surface(color: string) {
  let material = materials.get(color);
  if (!material) {
    material = new T.MeshStandardMaterial({ color, roughness: 0.78 });
    materials.set(color, material);
  }
  return material;
}

function shape(size: number[], rounded: boolean) {
  const key = `${rounded ? 'r' : 'b'}:${size.join(':')}`;
  let geometry = geometries.get(key);
  if (!geometry) {
    const [x, y, z] = size;
    geometry = rounded
      ? new RoundedBoxGeometry(x, y, z, 3, 0.1)
      : new T.BoxGeometry(x, y, z);
    geometry.userData.shared = true;
    geometries.set(key, geometry);
  }
  return geometry;
}

function part(
  parent: T.Object3D,
  size: number[],
  position: number[],
  color: string,
  rounded = false,
) {
  const mesh = new T.Mesh(shape(size, rounded), surface(color));
  mesh.position.set(...(position as [number, number, number]));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** The same hue, lighter or darker, for stitching, soles and cap buttons. */
function shade(hex: string, lightness: number) {
  const colour = new T.Color(hex);
  colour.offsetHSL(0, 0, lightness);
  return `#${colour.getHexString()}`;
}

/**
 * The collection's player character. Games dress it through `outfit`, but its
 * body, face and joints are the same everywhere: `userData.body`, `legL`,
 * `legR`, `armL` and `armR` (also as `legs` and `arms`), feet at the origin,
 * facing +Z.
 */
export function worker(color: number, outfit: WorkerOutfit = {}) {
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);
  g.userData.body = body;
  const c = outfit.shirt ?? COLORS[color % 4];
  const overalls = outfit.overalls ?? '#385d63';
  const boots = outfit.boots ?? '#4c4840';
  part(body, [0.67, 0.66, 0.43], [0, 0.87, 0], c, true);
  part(body, [0.59, 0.25, 0.45], [0, 0.54, 0], overalls, true);
  part(body, [0.34, 0.44, 0.06], [0, 0.81, 0.25], overalls);
  for (const x of [-0.23, 0.23]) {
    part(body, [0.09, 0.5, 0.06], [x, 0.94, 0.24], overalls);
    part(body, [0.1, 0.08, 0.03], [x, 1.07, 0.285], '#ebc35f');
  }
  const head = part(body, [0.52, 0.5, 0.5], [0, 1.43, 0], SKIN, true);
  head.name = 'worker-head';
  if (outfit.cap !== false) {
    part(body, [0.71, 0.13, 0.65], [0, 1.68, 0.03], c, true);
    part(body, [0.57, 0.22, 0.53], [0, 1.81, 0], c, true);
    part(body, [0.2, 0.1, 0.02], [0, 1.83, 0.272], BADGE, true);
    part(body, [0.1, 0.04, 0.1], [0, 1.935, 0], shade(c, -0.08), true);
  }
  // Eyes with a glint, brows, cheeks, a small smile and ears.
  for (const x of [-0.12, 0.12]) {
    part(body, [0.074, 0.112, 0.025], [x, 1.45, 0.261], INK);
    part(body, [0.026, 0.03, 0.01], [x + 0.012, 1.472, 0.276], GLINT);
    part(body, [0.09, 0.026, 0.02], [x, 1.522, 0.262], BROW);
    part(body, [0.07, 0.04, 0.012], [x * 1.46, 1.365, 0.256], BLUSH);
    part(body, [0.05, 0.12, 0.1], [x * 2.36, 1.42, 0.01], SKIN_SHADE, true);
    part(body, [0.028, 0.022, 0.02], [x * 0.43, 1.286, 0.262], INK);
  }
  part(body, [0.08, 0.022, 0.02], [0, 1.275, 0.262], INK);
  part(body, [0.17, 0.08, 0.13], [0, 1.35, 0.29], SKIN_SHADE, true);
  // A little hair shows under the brim at the back, never above the head top.
  part(body, [0.46, 0.08, 0.04], [0, 1.575, -0.25], HAIR, true);
  for (const x of [-0.263, 0.263])
    part(body, [0.03, 0.08, 0.16], [x, 1.575, -0.12], HAIR);
  // A stitched bib pocket.
  part(body, [0.17, 0.11, 0.016], [0, 0.9, 0.286], shade(overalls, 0.05));
  part(body, [0.17, 0.014, 0.018], [0, 0.945, 0.29], shade(overalls, 0.12));
  const legs: T.Group[] = [];
  const arms: T.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(side * 0.19, 0.5, 0);
    part(leg, [0.24, 0.38, 0.28], [0, -0.18, 0], overalls, true);
    part(leg, [0.3, 0.18, 0.43], [0, -0.41, 0.065], boots, true);
    part(leg, [0.14, 0.02, 0.1], [0, -0.315, 0.21], shade(boots, 0.18));
    body.add(leg);
    g.userData[side === 1 ? 'legR' : 'legL'] = leg;
    legs.push(leg);
    const arm = new T.Group();
    arm.position.set(side * 0.43, 1.08, 0);
    part(arm, [0.22, 0.44, 0.28], [0, -0.16, 0], c, true);
    const hand = part(
      arm,
      [0.22, 0.21, 0.25],
      [0, WORKER_HAND_Y, 0],
      SKIN,
      true,
    );
    hand.name = 'worker-hand';
    body.add(arm);
    g.userData[side === 1 ? 'armR' : 'armL'] = arm;
    arms.push(arm);
  }
  g.userData.legs = legs;
  g.userData.arms = arms;
  return g;
}
