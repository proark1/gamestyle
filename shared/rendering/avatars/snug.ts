import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { findItem } from '../../wardrobe/catalog';
import type { Look } from '../../wardrobe/look';
import { LOOK_GROUP, wearHat } from '../cosmetics/dress';
import { CLOTH, COLORS } from '../palette';
import {
  blink,
  capsule,
  custom,
  eye,
  lathe,
  rounded,
  shade,
  smile,
  soft,
} from './soft-parts';

export type SnugKind = 'woman' | 'man';

const SKIN = '#f2c29c';
const NOSE = '#eab08a';
const BLUSH = '#ee998a';
const INK = '#2b2421';
const HAIR = '#6e4128';
const BROW = '#553020';
const LIP = '#8a4a3c';
const DENIM = CLOTH.navy;
const SOCK = CLOTH.cream;
const BOOT = '#5c3f2c';
const SOLE = '#3a2b22';
const BRASS = CLOTH.gold;

/** The jacket is squashed front to back, so the body reads wider than deep. */
const DEPTH = 0.84;
const HEM = 0.42;
const SHOULDER = 0.88;
const NECK = 1.04;
const PUFFS = 4;
const HIP = 0.44;
/** The head group sits on the collar; its ball's centre and radii within it. */
const HEAD_Y = 1.04;
const FACE_Y = 0.31;
const HEAD = [0.35, 0.31, 0.31] as const;
const FORWARD = new T.Vector3(0, 0, 1);
/**
 * A wardrobe hat is made for the worker's flat-topped head. On Snug it sits
 * this far down the round crown and this much bigger, so it covers the top.
 */
const HAT_SINK = 0.2;
const HAT_FIT = 1.4;

type Point = [number, number, number];
type Profile = [number, number][];

type SnugRig = {
  body: T.Group;
  head: T.Group;
  legL: T.Group;
  legR: T.Group;
  armL: T.Group;
  armR: T.Group;
  eyes: T.Group[];
  /** The pom-pom, bun or crown curl, which bobs as the figure walks. */
  bob?: T.Group;
};

/**
 * Knit ribs or hair strands: pushes a surface in and out around Y. Welding
 * the seam first keeps it from showing as a crease.
 */
function ribbed(shape: T.BufferGeometry, count: number, depth: number) {
  shape.deleteAttribute('normal');
  shape.deleteAttribute('uv');
  const geometry = mergeVertices(shape);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const k = 1 + depth * Math.cos(count * Math.atan2(z, x));
    position.setX(i, x * k);
    position.setZ(i, z * k);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A unit ball with a lumpy surface, for yarn and twisted hair. */
function lumpy(twist: number, depth: number) {
  let geometry: T.BufferGeometry = new T.IcosahedronGeometry(1, 4);
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  geometry = mergeVertices(geometry);
  const position = geometry.attributes.position;
  const v = new T.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).normalize();
    const turn = Math.atan2(v.z, v.x);
    const k = twist
      ? 1 + depth * Math.cos(7 * turn + twist * v.y)
      : 1 +
        depth *
          (Math.sin(11 * v.x) * Math.sin(13 * v.y) * Math.sin(12 * v.z) +
            0.6 * Math.sin(23 * v.x + 17 * v.y + 19 * v.z));
    position.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A ring turned from a circle: a torus lying flat, as a lathe profile. */
function ring(radius: number, tube: number): Profile {
  const points: Profile = [];
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + (i / 24) * Math.PI * 2;
    points.push([radius + tube * Math.cos(a), tube * Math.sin(a)]);
  }
  return points;
}

/** The puffer jacket, bottom to top: a rounded hem, quilted bands, shoulders. */
function jacketProfile(): Profile {
  const points: Profile = [[0.0001, HEM + 0.01]];
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
    points.push([0.25 + 0.05 * Math.cos(a), HEM + 0.05 + 0.05 * Math.sin(a)]);
  }
  // Each band puffs out between two stitched creases.
  const start = HEM + 0.05;
  const steps = PUFFS * 12;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const band = (t * PUFFS) % 1;
    const puff = 0.022 * Math.sqrt(Math.sin(Math.PI * band));
    points.push([
      0.3 + 0.035 * Math.sin(Math.PI * t) + puff,
      start + t * (SHOULDER - start),
    ]);
  }
  // The shoulders round in to the neck as one more puffed band.
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    const puff = 1 + 0.07 * Math.sqrt(Math.sin(2 * a));
    points.push([
      0.13 + 0.17 * Math.cos(a) * puff,
      SHOULDER + (NECK - SHOULDER) * Math.sin(a) * puff,
    ]);
  }
  points.push([0.0001, NECK]);
  return points;
}

const JACKET = jacketProfile().slice(1);

/** The jacket's radius at height `y`, before the front-to-back squash. */
function jacketRadius(y: number) {
  for (let i = 1; i < JACKET.length; i++) {
    const [r0, y0] = JACKET[i - 1];
    const [r1, y1] = JACKET[i];
    if (y <= y1 && y1 > y0)
      return r0 + ((r1 - r0) * Math.max(0, y - y0)) / (y1 - y0);
  }
  return 0;
}

/** Where the jacket surface is at side `x` and height `y`, front or back. */
function onJacket(x: number, y: number, side: 1 | -1, lift: number): Point {
  const r = jacketRadius(y);
  const z = DEPTH * Math.sqrt(Math.max(0, r * r - x * x));
  return [x, y, side * (z + lift)];
}

/** A puffy sleeve hanging from the shoulder, bottom to top. */
function sleeveProfile(): Profile {
  const points: Profile = [[0.0001, -0.36]];
  points.push([0.078, -0.355]);
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const band = (t * 3) % 1;
    const puff = 0.014 * Math.sqrt(Math.sin(Math.PI * band));
    points.push([0.088 + 0.012 * t + puff, -0.34 + 0.34 * t]);
  }
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    points.push([0.1 * Math.cos(a) + 0.0001, 0.1 * Math.sin(a)]);
  }
  return points;
}

/** A slouchy beanie crown, bottom to top, in head-ball coordinates. */
function beanieCrown() {
  const points: T.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * (Math.PI / 2);
    points.push(
      new T.Vector2(0.365 * Math.cos(a) + 0.0001, 0.12 + 0.28 * Math.sin(a)),
    );
  }
  return ribbed(new T.LatheGeometry(points, 96), 24, 0.03);
}

/** The beanie's folded, ribbed cuff. */
function beanieCuff() {
  const profile: Profile = [
    [0.338, 0.04],
    [0.37, 0.052],
    [0.388, 0.08],
    [0.392, 0.12],
    [0.385, 0.16],
    [0.365, 0.182],
    [0.345, 0.19],
  ];
  return ribbed(
    new T.LatheGeometry(
      profile.map(([r, y]) => new T.Vector2(r, y)),
      120,
    ),
    40,
    0.028,
  );
}

/**
 * Hair on a unit ball, strands running up: everything below a hairline is
 * folded up onto it. `line` gives the hairline's height from how far round
 * the head a point is, 1 at the brow, 0 over the ears and -1 at the nape.
 */
function hair(line: (front: number) => number) {
  return () => {
    const geometry = ribbed(
      new T.SphereGeometry(1, 64, 40, 0, Math.PI * 2, 0, 2.6),
      30,
      0.025,
    );
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const y = line(Math.cos(Math.atan2(x, z)));
      if (position.getY(i) >= y) continue;
      // Folded points face straight out, so the hairline shades smoothly.
      const k = Math.sqrt(1 - y * y) / Math.hypot(x, z);
      position.setXYZ(i, x * k, y, z * k);
      normal.setXYZ(i, x * k, y, z * k);
    }
    return geometry;
  };
}

/** Short hair: under a hat at the brow, down in front of the ears, the nape. */
const SHORT = (front: number) =>
  front > 0 ? -0.28 + 0.48 * front ** 4 : -0.28 + 0.32 * front;
/** A bob: from under the fringe, down past the cheeks to the jaw all round. */
const BOB = (front: number) => -0.62 + 0.92 * Math.max(0, front) ** 3;

/**
 * Which way the jacket faces at a point on or just off it. The slope is taken
 * across a whole quilted band, so a strap lying on it doesn't wobble.
 */
function jacketNormal(at: T.Vector3, into: T.Vector3) {
  const slope = (jacketRadius(at.y + 0.05) - jacketRadius(at.y - 0.05)) / 0.1;
  return into
    .set(at.x, -jacketRadius(at.y) * slope, at.z / (DEPTH * DEPTH))
    .normalize();
}

/** A flat, padded strap along `curve`, lying flat on the jacket throughout. */
function strap(curve: T.Curve<T.Vector3>, width: number, thick: number) {
  const steps = 64;
  const positions: number[] = [];
  const indices: number[] = [];
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const out = new T.Vector3();
  const across = new T.Vector3();
  for (let i = 0; i <= steps; i++) {
    const at = curve.getPointAt(i / steps);
    jacketNormal(at, out);
    across.crossVectors(curve.getTangentAt(i / steps), out).normalize();
    for (const [a, b] of corners)
      positions.push(
        at.x + (across.x * a * width + out.x * b * thick) / 2,
        at.y + (across.y * a * width + out.y * b * thick) / 2,
        at.z + (across.z * a * width + out.z * b * thick) / 2,
      );
  }
  for (let i = 0; i < steps; i++)
    for (let k = 0; k < 4; k++) {
      const a = i * 4 + k;
      const b = i * 4 + ((k + 1) % 4);
      indices.push(a, a + 4, b + 4, a, b + 4, b);
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Where the face surface is at (x, y), and which way the skin faces there. */
function onHead(x: number, y: number) {
  const u = x / HEAD[0];
  const v = (y - FACE_Y) / HEAD[1];
  const w = Math.sqrt(Math.max(0, 1 - u * u - v * v));
  return {
    at: new T.Vector3(x, y, HEAD[2] * w),
    normal: new T.Vector3(u / HEAD[0], v / HEAD[1], w / HEAD[2]).normalize(),
  };
}

/** Lays a part flat onto the face at (x, y), its front along the skin's. */
function stick<O extends T.Object3D>(
  part: O,
  x: number,
  y: number,
  lift = 0,
  spin = 0,
) {
  const { at, normal } = onHead(x, y);
  part.position.copy(at).addScaledVector(normal, lift);
  part.quaternion.setFromUnitVectors(FORWARD, normal);
  if (spin) part.rotateZ(spin);
  return part;
}

function face(head: T.Group, kind: SnugKind) {
  soft(head, [...HEAD], [0, FACE_Y, 0], SKIN);
  const eyes = [-1, 1].map((side) => {
    const group = stick(
      eye(head, [0.037, 0.05, 0.022], [0, 0, 0], INK),
      side * 0.135,
      0.215,
      -0.008,
    );
    if (kind === 'woman')
      for (const [x, y, tilt] of [
        [0.034, 0.041, 0.6],
        [0.047, 0.023, 1],
      ])
        soft(
          group,
          [0.016, 0.006, 0.006],
          [side * x, y, 0.004],
          INK,
        ).rotation.z = side * tilt;
    const brow = soft(
      head,
      [0.046, kind === 'man' ? 0.014 : 0.01, 0.012],
      [0, 0, 0],
      BROW,
    );
    stick(brow, side * 0.135, 0.292, 0.002, side * 0.1);
    return group;
  });
  stick(soft(head, [0.032, 0.026, 0.024], [0, 0, 0], NOSE), 0, 0.155, -0.004);
  for (const side of [-1, 1])
    stick(
      soft(head, [0.052, 0.032, 0.012], [0, 0, 0], BLUSH),
      side * 0.215,
      0.145,
      -0.004,
    );
  smile(
    head,
    (
      [
        [-0.047, 0.11],
        [-0.018, 0.095],
        [0.018, 0.095],
        [0.047, 0.11],
      ] as const
    ).map(([x, y]): Point => [x, y, onHead(x, y).at.z + 0.003]),
    LIP,
  );
  return eyes;
}

/**
 * Short hair with a chunky fringe. Under a hat it lies flat; bareheaded it
 * stands up a little, with big locks swept over the brow and a curl on top.
 */
function shortHair(head: T.Group, bare: boolean) {
  custom(head, 'snug-hair-short', hair(SHORT), [0, FACE_Y, 0], HAIR).scale.set(
    HEAD[0] + 0.014,
    HEAD[1] + (bare ? 0.035 : 0.012),
    HEAD[2] + 0.014,
  );
  for (const [x, y, spin] of [
    [-0.23, 0.36, 1.25],
    [-0.14, 0.365, 1.1],
    [-0.045, 0.37, 1.0],
    [0.05, 0.37, 0.95],
    [0.145, 0.365, 0.9],
    [0.23, 0.36, 0.85],
  ])
    stick(soft(head, [0.075, 0.042, 0.03], [0, 0, 0], HAIR), x, y, 0.004, spin);
  for (const side of [-1, 1])
    stick(
      soft(head, [0.045, 0.085, 0.04], [0, 0, 0], HAIR),
      side * 0.305,
      0.29,
      0.004,
      side * 0.2,
    );
  if (!bare) return undefined;
  for (const [x, y, size, spin] of [
    [-0.13, 0.5, [0.18, 0.075, 0.045], -0.3],
    [0.09, 0.52, [0.16, 0.07, 0.045], -0.42],
    [0.22, 0.44, [0.1, 0.06, 0.04], -0.75],
  ] as const)
    stick(
      soft(head, [...size], [0, 0, 0], HAIR),
      x,
      y,
      x > 0.2 ? 0.018 : 0.028,
      spin,
    );
  const curl = new T.Group();
  curl.position.set(0.02, FACE_Y + HEAD[1] + 0.02, 0.04);
  head.add(curl);
  custom(
    curl,
    'snug-curl',
    () =>
      new T.TubeGeometry(
        new T.CatmullRomCurve3(
          (
            [
              [0, -0.02, 0],
              [0, 0.05, -0.01],
              [0.02, 0.1, 0.02],
              [0.03, 0.1, 0.07],
              [0.02, 0.07, 0.08],
            ] as const
          ).map((p) => new T.Vector3(...p)),
        ),
        24,
        0.026,
        10,
        false,
      ),
    [0, 0, 0],
    HAIR,
  );
  soft(curl, [0.026, 0.026, 0.026], [0.02, 0.07, 0.08], HAIR);
  return curl;
}

/**
 * The wardrobe's Bobble Beanie as Snug wears it: the knit beanie from the
 * concept art, its cuff folded up and a pom-pom on top, in the player colour.
 */
function knitBeanie(head: T.Group, colour: string) {
  const hat = new T.Group();
  hat.name = LOOK_GROUP;
  hat.position.set(0, FACE_Y, 0);
  hat.rotation.x = -0.08;
  head.add(hat);
  custom(hat, 'snug-beanie', beanieCrown, [0, 0, 0], colour).scale.z = 0.9;
  custom(
    hat,
    'snug-cuff',
    beanieCuff,
    [0, 0, 0],
    shade(colour, -0.04),
  ).scale.z = 0.9;
  const pom = new T.Group();
  pom.position.set(0, 0.38, 0);
  hat.add(pom);
  custom(
    pom,
    'snug-pom',
    () => lumpy(0, 0.06),
    [0, 0.07, 0],
    colour,
  ).scale.setScalar(0.095);
  return pom;
}

/** Any other wardrobe hat, made for the worker, fitted to the round head. */
function fittedHat(head: T.Group, player: string, look: Look) {
  const hat = new T.Group();
  hat.position.set(0, FACE_Y + HEAD[1] - HAT_SINK, 0);
  hat.scale.setScalar(HAT_FIT);
  head.add(hat);
  wearHat(hat, player, look);
}

/** The hat a look puts on, when it names a real one. */
function hatOf(look?: Look) {
  const id = look?.hat;
  return id && findItem(id)?.slot === 'hat' ? id : undefined;
}

/** A bob with a side-swept fringe; bareheaded, a twisted bun and scrunchie. */
function bobHair(head: T.Group, colour: string, bare: boolean) {
  const size = [HEAD[0] + 0.016, HEAD[1] + 0.016, HEAD[2] + 0.016] as const;
  custom(head, 'snug-hair-bob', hair(BOB), [0, FACE_Y, 0], HAIR).scale.set(
    ...size,
  );
  // A side-swept fringe and locks framing the cheeks.
  stick(
    soft(head, [0.21, 0.075, 0.035], [0, 0, 0], HAIR),
    0.05,
    0.415,
    0.004,
    -0.38,
  );
  stick(
    soft(head, [0.13, 0.06, 0.032], [0, 0, 0], HAIR),
    -0.2,
    0.4,
    0.004,
    0.62,
  );
  for (const side of [-1, 1])
    stick(
      soft(head, [0.055, 0.14, 0.05], [0, 0, 0], HAIR),
      side * 0.3,
      0.22,
      0.006,
      side * 0.1,
    );

  if (!bare) return undefined;
  const top = new T.Group();
  top.position.set(0, FACE_Y + HEAD[1], -0.02);
  head.add(top);
  lathe(top, 'snug-scrunchie', () => ring(0.085, 0.03), [0, 0.02, 0], colour);
  custom(
    top,
    'snug-bun',
    () => lumpy(9, 0.07),
    [0, 0.1, 0],
    HAIR,
  ).scale.setScalar(0.12);
  return top;
}

/** A backpack on the jacket's back, its straps over both shoulders. */
function backpack(body: T.Group, colour: string, kind: SnugKind) {
  const trim = shade(colour, -0.06);
  rounded(body, [0.42, 0.46, 0.2], [0, 0.72, -0.37], colour, 0.08);
  rounded(body, [0.44, 0.17, 0.225], [0, 0.9, -0.37], trim, 0.06);
  rounded(body, [0.3, 0.17, 0.08], [0, 0.6, -0.47], colour, 0.035);
  for (const side of [-1, 1]) {
    rounded(
      body,
      [0.045, 0.13, 0.016],
      [side * 0.1, 0.81, -0.485],
      trim,
      0.007,
    );
    rounded(
      body,
      [0.055, 0.035, 0.02],
      [side * 0.1, kind === 'man' ? 0.77 : 0.79, -0.49],
      BRASS,
      0.008,
    );
  }
  for (const side of [-1, 1] as const) {
    const x = side * 0.21;
    let top = SHOULDER;
    while (top < NECK && jacketRadius(top) > Math.abs(x)) top += 0.004;
    // From the bottom of the pack, under the arm, up the chest, over the
    // shoulder and back into the top of the pack.
    const points = [
      [side * 0.17, 0.6, -0.34] as Point,
      onJacket(side * 0.28, 0.58, -1, 0.024),
      [side * (jacketRadius(0.58) + 0.024), 0.58, 0] as Point,
      onJacket(side * 0.27, 0.64, 1, 0.024),
      onJacket(side * 0.235, 0.72, 1, 0.024),
      onJacket(x, 0.82, 1, 0.026),
      onJacket(x, 0.93, 1, 0.028),
      [x, top + 0.028, 0] as Point,
      onJacket(x, 0.95, -1, 0.028),
      [side * 0.19, 0.88, -0.36] as Point,
    ].map((p) => new T.Vector3(...p));
    const curve = new T.CatmullRomCurve3(points);
    custom(
      body,
      `snug-strap:${side}`,
      () => strap(curve, 0.075, 0.022),
      [0, 0, 0],
      trim,
    );
  }
}

/**
 * Snug, a chunky vinyl-toy traveller from the hotel concept art: a big round
 * face, a quilted puffer jacket, jeans, woolly socks, boots and a backpack.
 * The woman wears a twisted bun and a plum-dark backpack, the man short hair
 * and a leather one. The jacket takes the player colour. Only the hat of a
 * wardrobe `look` shows: the Bobble Beanie as the art's knit beanie, any
 * other hat fitted to the round head. It keeps the worker's rig, feet at
 * zero, facing +Z.
 */
export function snug(color = 0, kind: SnugKind = 'woman', look?: Look) {
  const jacket = COLORS[color % COLORS.length];
  const root = new T.Group();
  const body = new T.Group();
  root.add(body);

  lathe(body, 'snug-jacket', jacketProfile, [0, 0, 0], jacket).scale.z = DEPTH;
  const zip = shade(jacket, -0.2);
  smile(
    body,
    [0.43, 0.55, 0.67, 0.79, 0.9, 0.97, 1.01].map((y) =>
      onJacket(0, y, 1, 0.004),
    ),
    zip,
  );
  rounded(body, [0.03, 0.055, 0.014], onJacket(0, 0.96, 1, 0.012), zip, 0.006);
  lathe(
    body,
    'snug-collar',
    () => ring(0.165, 0.072),
    [0, NECK - 0.02, 0],
    jacket,
  ).scale.z = DEPTH * 1.05;
  if (kind === 'woman') {
    soft(body, [0.23, 0.085, 0.12], [0, 1.06, -0.2], jacket);
  }
  backpack(body, kind === 'man' ? CLOTH.brown : shade(jacket, -0.12), kind);

  const head = new T.Group();
  head.position.set(0, HEAD_Y, 0);
  body.add(head);
  const eyes = face(head, kind);
  const hat = hatOf(look);
  let bob =
    kind === 'man' ? shortHair(head, !hat) : bobHair(head, jacket, !hat);
  if (hat === 'bobble-beanie') bob = knitBeanie(head, jacket);
  else if (hat) fittedHat(head, jacket, { hat });

  const legs = [-1, 1].map((side) => {
    const leg = new T.Group();
    leg.position.set(side * 0.14, HIP, 0);
    capsule(leg, 0.12, 0.18, [0, -0.17, 0], DENIM);
    custom(
      leg,
      'snug-sock',
      () => ribbed(new T.CylinderGeometry(0.128, 0.132, 0.075, 48), 22, 0.05),
      [0, 0.17 - HIP, 0],
      SOCK,
    );
    custom(
      leg,
      'snug-boot',
      () => new T.CylinderGeometry(0.125, 0.13, 0.11, 32),
      [0, 0.1 - HIP, 0],
      BOOT,
    );
    soft(leg, [0.13, 0.085, 0.18], [0, 0.09 - HIP, 0.05], BOOT);
    rounded(leg, [0.27, 0.05, 0.38], [0, 0.025 - HIP, 0.045], SOLE, 0.022);
    body.add(leg);
    return leg;
  });

  const arms = [-1, 1].map((side) => {
    const arm = new T.Group();
    arm.position.set(side * 0.31, 0.86, 0);
    const splay = new T.Group();
    splay.rotation.z = side * 0.2;
    lathe(splay, 'snug-sleeve', sleeveProfile, [0, 0, 0], jacket);
    custom(
      splay,
      'snug-wrist',
      () => ribbed(new T.CylinderGeometry(0.078, 0.072, 0.05, 32), 14, 0.06),
      [0, -0.37, 0],
      shade(jacket, -0.06),
    );
    soft(splay, [0.075, 0.082, 0.072], [0, -0.44, 0.01], SKIN);
    soft(splay, [0.03, 0.042, 0.034], [-side * 0.052, -0.42, 0.045], SKIN);
    arm.add(splay);
    body.add(arm);
    return arm;
  });

  Object.assign(root.userData, {
    body,
    head,
    eyes,
    bob,
    legs,
    arms,
    legL: legs[0],
    legR: legs[1],
    armL: arms[0],
    armR: arms[1],
    kind,
  });
  return root;
}

/**
 * A chunky toddle with a little sway, the pom-pom or bun bobbing along;
 * standing, it breathes, looks about and blinks. `time` is in seconds.
 */
export function walkSnug(model: T.Object3D, time: number, walking: boolean) {
  const rig = model.userData as SnugRig;
  const beat = time * 8;
  const swing = walking ? Math.sin(beat) : 0;
  const bounce = Math.abs(swing);
  rig.legL.rotation.x = swing * 0.5;
  rig.legR.rotation.x = -swing * 0.5;
  rig.armL.rotation.x = -swing * 0.55;
  rig.armR.rotation.x = swing * 0.55;
  rig.body.position.y = walking ? bounce * 0.045 : 0;
  rig.body.rotation.z = swing * 0.04;
  const breath = walking ? 0 : Math.sin(time * 2) * 0.01;
  rig.body.scale.set(1 - breath / 2, 1 + breath, 1 - breath / 2);
  rig.head.rotation.y = walking ? swing * 0.06 : Math.sin(time * 0.6) * 0.25;
  rig.head.rotation.z = walking ? -swing * 0.05 : Math.sin(time * 1.1) * 0.03;
  if (rig.bob)
    rig.bob.rotation.x = walking ? -bounce * 0.22 : Math.sin(time * 2) * 0.03;
  for (const e of rig.eyes) e.scale.y = blink(time, 1.1);
}
