import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SLOTS, type Slot } from '../../wardrobe/catalog';
import type { Look } from '../../wardrobe/look';
import {
  DEPTH,
  HAT_BRIM,
  HEAD_Y,
  HIP,
  JAW,
  SKULL,
  faceAt,
  jerseyRadius,
  trouserRadius,
} from '../avatars/hoop-kid';
import { material } from '../primitives';
import { KID_ITEMS } from './kid-items';
import { shoeSole } from '../avatars/soft-parts';
import { addPart, lookGroup, modelsOf, partTop, type Worn } from './dress';
import { PLAYER, type ItemModel, type Part } from './items';

/**
 * Wardrobe items are modelled on the worker's blocky body. This puts the same
 * items on the clay kids: each part keeps its shape and colour and moves from
 * where it sat on the worker to the same place on the kid, scaled to the
 * kid's size there. Panels lie on the kid's round body, bands and wide
 * panels curve round it, and hats are rounded to sit over the hair.
 */
type Vec = [number, number, number];
type Box = Extract<Part, { shape: 'box' }>;

/** A slice through the body or a limb: its centre and half-widths. */
type Section = { x: number; z: number; w: number; d: number };

/** How one of the worker's body parts maps onto the same part of a kid. */
type Frame = {
  /** The kid's height for the worker's height `y`. */
  y(y: number): number;
  /** How much heights stretch from worker to kid. */
  stretch: number;
  /** The worker's slice at the worker's height `y`. */
  worker(y: number): Section;
  /** The kid's slice at the kid's height `y`. */
  kid(y: number): Section;
  /**
   * Shoes are blocks on both: their parts are only scaled, apart from bands
   * round the ankle, above this height on the kid.
   */
  blocky?: { ankle: number };
};

/** The worker's shirt, 0.54 to 1.2 high, onto the kid's jersey. */
const TORSO: Frame = {
  y: (y) => HIP[1] + (y - 0.54) * 0.64,
  stretch: 0.64,
  worker: () => ({ x: 0, z: 0, w: 0.335, d: 0.215 }),
  kid(y) {
    const w = Math.max(0.075, jerseyRadius(Math.max(0, y - HIP[1])));
    return { x: 0, z: 0, w, d: w * DEPTH };
  },
};

/** A trouser leg, from the hip; the kid wears long trousers with any legs item. */
const TROUSERS: Frame = {
  y: (y) => y * 1.125,
  stretch: 1.125,
  worker: () => ({ x: 0, z: 0, w: 0.12, d: 0.14 }),
  kid(y) {
    const r = trouserRadius(y);
    return { x: 0, z: 0, w: r, d: r };
  },
};

/** The kid's ankle, where the high-top's collar is, starts this far below the hip. */
const ANKLE = -0.43;

/** The worker's boot and the leg above it, onto the kid's high-top. */
const SHOES: Frame = {
  y: (y) => -HIP[1] + (y + 0.5) * 1.14,
  stretch: 1.14,
  worker: (y) =>
    y > -0.32
      ? { x: 0, z: 0, w: 0.12, d: 0.14 }
      : { x: 0, z: 0.065, w: 0.15, d: 0.215 },
  kid: (y) =>
    y > ANKLE
      ? { x: 0, z: 0.005, w: 0.09, d: 0.09 }
      : { x: 0, z: 0.045, w: 0.092, d: 0.163 },
  blocky: { ankle: ANKLE },
};

/** A sleeve, from the shoulder; the kid's bare arm is much slimmer. */
const SLEEVES: Frame = {
  y: (y) => y * 0.87,
  stretch: 0.87,
  worker: () => ({ x: 0, z: 0, w: 0.11, d: 0.14 }),
  kid: () => ({ x: 0, z: 0, w: 0.066, d: 0.066 }),
};

/** Parts on a surface keep this much of their thickness and stand-off. */
const THICK = 0.8;
/** Bands round a limb or the body stand this far off it, and are this thick. */
const GAP = 0.006;
const BAND = 0.016;
/**
 * The worker's flat front covers the quarter of the way round the kid that
 * faces forward, and so for its back and sides.
 */
const QUARTER = Math.PI / 4;

/**
 * Face parts grow by this much: the kid's eyes are far bigger than the
 * worker's, and glasses must still frame them.
 */
const FACE_SCALE = 1.2;
const FACE_SPREAD = 1.05;
/**
 * The worker's face heights (from the centre of its face) against the kid's
 * (in head space): mid-chest, chin, mouth, eyes, brows and the top of the head.
 */
const FACE_HEIGHTS: [number, number][] = [
  [-0.55, -0.27],
  [-0.25, 0.03],
  [-0.155, 0.175],
  [0.02, 0.31],
  [0.092, 0.4],
  [0.25, 0.59],
];
/** Below the chin, a beard hangs in front of the neck, as far out as this. */
const CHIN = 0.06;

/** Where the top of the worker's head sits on the kid's, and how much hats grow. */
const HAT_AT: Vec = [0, HAT_BRIM, -0.035];
const HAT_FIT = 1.12;
/** A dome's straight side, as a share of its height, below the rounded top. */
const DOME_SKIRT = 0.35;

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

function colourOf(part: Part, player: string) {
  return part.colour === PLAYER ? player : part.colour;
}

/** The part as the worker's other side wears it. */
function mirrored(part: Part, side: number): Part {
  if (side === 1) return part;
  const [x, y, z] = part.at;
  const turn = part.turn;
  return {
    ...part,
    at: [-x, y, z],
    turn: turn && [turn[0], -turn[1], -turn[2]],
  };
}

function shaded(mesh: T.Mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds `part` at `at`, stretched by `scale` along the worker's own axes and
 * then turned by `yaw`, so a flat panel can lie along a round surface.
 */
function put(
  parent: T.Object3D,
  part: Part,
  at: Vec,
  scale: Vec,
  yaw: number,
  player: string,
) {
  const holder = new T.Group();
  holder.position.set(...at);
  holder.rotation.y = yaw;
  holder.scale.set(...scale);
  parent.add(holder);
  addPart(holder, { ...part, at: [0, 0, 0] }, [0, 0, 0], 1, player);
}

/**
 * A thick band round the vertical axis, `radius` to its inside, squashed front
 * to back by `depth`. `arc` is the angle it covers, centred on the front.
 */
function band(
  parent: T.Object3D,
  radius: number,
  depth: number,
  height: number,
  thickness: number,
  colour: string,
  arc = Math.PI * 2,
) {
  const outline = [
    [radius, -height / 2],
    [radius + thickness, -height / 2],
    [radius + thickness, height / 2],
    [radius, height / 2],
    [radius, -height / 2],
  ].map(([x, y]) => new T.Vector2(x, y));
  const whole = arc >= Math.PI * 2;
  const mesh = new T.Mesh(
    new T.LatheGeometry(outline, whole ? 36 : 24, whole ? 0 : -arc / 2, arc),
    material(colour),
  );
  mesh.scale.z = depth;
  parent.add(shaded(mesh));
  return mesh;
}

/** The widest the kid gets between two heights, through `frame`. */
function widest(frame: Frame, low: number, high: number) {
  const slices = [low, (low + high) / 2, high].map((y) => frame.kid(y));
  return {
    w: Math.max(...slices.map((slice) => slice.w)),
    d: Math.max(...slices.map((slice) => slice.d)),
  };
}

/** Follow the changing torso radius on both faces, including the side joins. */
function sash(
  parent: T.Object3D,
  frame: Frame,
  height: number,
  width: number,
  colour: string,
) {
  const vertices: number[] = [],
    indices: number[] = [];
  const steps = 96;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    for (const [edge, out] of [
      [-1, GAP],
      [1, GAP],
      [1, GAP + BAND],
      [-1, GAP + BAND],
    ]) {
      let low = HIP[1],
        high = HIP[1] + 0.43;
      for (let n = 0; n < 24; n++) {
        const mid = (low + high) / 2;
        const target =
          height - frame.kid(mid).w * Math.sin(angle) + (edge * width) / 2;
        if (mid < target) low = mid;
        else high = mid;
      }
      const y = (low + high) / 2;
      const section = frame.kid(y);
      vertices.push(
        (section.w + out) * Math.sin(angle),
        y,
        (section.d + out) * Math.cos(angle),
      );
    }
    if (i < steps)
      for (let e = 0; e < 4; e++) {
        const a = i * 4 + e,
          b = i * 4 + ((e + 1) % 4);
        indices.push(a, b, a + 4, b, b + 4, a + 4);
      }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  parent.add(shaded(new T.Mesh(geometry, material(colour))));
}

/** Places a body, leg or sleeve part through `frame`. */
function placeOn(parent: T.Object3D, part: Part, frame: Frame, player: string) {
  const [x, y, z] = part.at;
  const height = frame.y(y);
  const worker = frame.worker(y);
  const kid = frame.kid(height);
  const sx = kid.w / worker.w;
  const sz = kid.d / worker.d;
  const u = (x - worker.x) / worker.w;
  const v = (z - worker.z) / worker.d;
  const colour = colourOf(part, player);
  const blocky = !!frame.blocky;

  if (part.shape === 'box') {
    const [w, h, d] = part.size;
    const [tilt, , roll] = part.turn ?? [0, 0, 0];
    const tall = h * frame.stretch;
    const span = widest(frame, height - tall / 2, height + tall / 2);

    if (blocky && h <= 0.08 && y < -0.44 && w > 0.25 && z < 0.15) {
      parent.parent?.getObjectByName('shoe-sole')?.removeFromParent();
      shoeSole(
        parent,
        [w * sx, tall, d * sz],
        [
          kid.x + (x - worker.x) * sx,
          -HIP[1] + tall / 2,
          kid.z + (z - worker.z) * sz,
        ],
        colour,
      );
      return;
    }

    // A band that went all round the worker goes all round the kid.
    if (
      (!frame.blocky || height > frame.blocky.ankle) &&
      !tilt &&
      !roll &&
      Math.abs(u) < 0.35 &&
      Math.abs(v) < 0.6 &&
      w >= 0.7 * worker.w &&
      d >= 0.7 * worker.d
    ) {
      if (blocky)
        parent.parent?.getObjectByName('shoe-collar')?.removeFromParent();
      const ring = band(
        parent,
        span.w + GAP,
        (span.d + GAP) / (span.w + GAP),
        blocky ? Math.min(tall, 0.085) : tall,
        BAND,
        colour,
      );
      ring.position.set(kid.x, blocky ? -HIP[1] + 0.18 : height, kid.z);
      return;
    }

    // A sash through the body wraps round it, slanting as it did.
    if (
      !blocky &&
      roll &&
      Math.abs(u) < 0.35 &&
      Math.abs(v) < 0.35 &&
      d >= 1.4 * worker.d
    ) {
      sash(parent, frame, height, w * sx, colour);
      return;
    }

    // A panel across the whole front or back curves round that half.
    if (
      !blocky &&
      !roll &&
      Math.abs(v) >= 0.7 &&
      Math.abs(u) < 0.35 &&
      w >= 1.4 * worker.w
    ) {
      const out = Math.max(0, (Math.abs(z - worker.z) - worker.d) * THICK);
      const panel = band(
        parent,
        span.w + GAP + out,
        (span.d + GAP + out) / (span.w + GAP + out),
        tall,
        Math.max(BAND, d * THICK),
        colour,
        Math.PI * Math.min(1, w / (2 * worker.w)),
      );
      panel.position.set(kid.x, height, kid.z);
      panel.rotation.set(v > 0 ? -tilt : tilt, v > 0 ? 0 : Math.PI, 0);
      return;
    }
  }

  // A part on the surface moves to the same spot on the kid's round surface,
  // turned to face straight out from it: the worker's flat front becomes the
  // quarter of the kid facing forward, and so round the other sides.
  if (!blocky && Math.max(Math.abs(u), Math.abs(v)) >= 0.7) {
    const front = Math.abs(v) >= Math.abs(u);
    const along = clamp(front ? u : v);
    const angle = front
      ? v > 0
        ? along * QUARTER
        : Math.PI - along * QUARTER
      : u > 0
        ? Math.PI / 2 - along * QUARTER
        : -Math.PI / 2 + along * QUARTER;
    const px = kid.w * Math.sin(angle);
    const pz = kid.d * Math.cos(angle);
    const normal = new T.Vector2(
      Math.sin(angle) / kid.w,
      Math.cos(angle) / kid.d,
    ).normalize();
    const out =
      (front
        ? Math.abs(z - worker.z) - worker.d
        : Math.abs(x - worker.x) - worker.w) * THICK;
    const facing = front ? (v > 0 ? 0 : Math.PI) : (Math.sign(u) * Math.PI) / 2;
    put(
      parent,
      part,
      [kid.x + px + normal.x * out, height, kid.z + pz + normal.y * out],
      front
        ? [QUARTER * sx, frame.stretch, THICK]
        : [THICK, frame.stretch, QUARTER * sz],
      Math.atan2(normal.x, normal.y) - facing,
      player,
    );
    return;
  }

  // Anything else, such as a shoe's sole, is scaled in place.
  put(
    parent,
    part,
    [kid.x + (x - worker.x) * sx, height, kid.z + (z - worker.z) * sz],
    [sx, frame.stretch, sz],
    0,
    player,
  );
}

/** The kid's height in head space for a height on the worker's face. */
function faceHeight(y: number) {
  const knots = FACE_HEIGHTS;
  const last = knots.length - 1;
  let i = 1;
  while (i < last && y > knots[i][0]) i++;
  const [y0, k0] = knots[i - 1];
  const [y1, k1] = knots[i];
  return k0 + ((k1 - k0) * (y - y0)) / (y1 - y0);
}

/** How far the head reaches to each side and to the front at `y`, in head space. */
function headSlice(y: number) {
  let w = 0;
  for (const { centre, radii } of [SKULL, JAW]) {
    const t = (y - centre[1]) / radii[1];
    if (Math.abs(t) < 1) w = Math.max(w, radii[0] * Math.sqrt(1 - t * t));
  }
  return { w: Math.max(w, 0.05), d: Math.max(faceAt(0, y).z, 0.05) };
}

/**
 * Places a glasses, mask or beard part on the kid's face. Wide straps and
 * frames curve round the head rather than standing out from it like a plank.
 */
function placeOnFace(
  head: T.Object3D,
  part: Part,
  player: string,
  beard = false,
) {
  const [x, y, z] = part.at;
  const height =
    faceHeight(y) -
    (beard ? 0.035 * Math.min(1, Math.max(0, (y + 0.46) / 0.16)) : 0);
  const across = x * FACE_SPREAD;
  if (part.shape === 'box' && part.size[0] * FACE_SCALE > 0.45) {
    const slice = headSlice(height);
    const out = Math.max(0, z * FACE_SCALE) + 0.004;
    const tilt = new T.Group();
    tilt.position.set(across, height, 0);
    if (part.turn) tilt.rotation.set(part.turn[0], 0, part.turn[2]);
    head.add(tilt);
    band(
      tilt,
      slice.w + out,
      (slice.d + out) / (slice.w + out),
      part.size[1] * FACE_SCALE,
      part.size[2] * FACE_SCALE,
      colourOf(part, player),
      (part.size[0] * FACE_SCALE) / (slice.w + out),
    );
    return;
  }
  const { z: surface, normal } = faceAt(across, Math.max(height, CHIN));
  put(
    head,
    part,
    [across, height, surface + z * FACE_SCALE],
    [FACE_SCALE, FACE_SCALE, FACE_SCALE],
    Math.atan2(normal.x, normal.z) * 0.7,
    player,
  );
}

/** A dome: a short straight skirt under a rounded top, standing on `bottom`. */
function dome(
  parent: T.Object3D,
  radii: Vec,
  bottom: number,
  at: [number, number],
  colour: string,
) {
  const [w, h, d] = radii;
  const skirt = h * DOME_SKIRT;
  const skirtGeometry = new T.CylinderGeometry(1, 1, skirt, 32, 1, true);
  const topGeometry = new T.SphereGeometry(
    1,
    32,
    12,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  const geometry = mergeGeometries([
    skirtGeometry.translate(0, skirt / 2, 0),
    topGeometry.scale(1, h - skirt, 1).translate(0, skirt, 0),
  ])!;
  skirtGeometry.dispose();
  topGeometry.dispose();
  const mesh = new T.Mesh(geometry, material(colour));
  mesh.position.set(at[0], bottom, at[1]);
  mesh.scale.set(w, 1, d);
  parent.add(shaded(mesh));
}

/** A dome's half-width at `y`, as a share of its full width; 0 off it. */
function domeWidth(bottom: number, height: number, y: number) {
  const skirt = height * DOME_SKIRT;
  if (y < bottom || y > bottom + height) return 0;
  if (y <= bottom + skirt) return 1;
  const t = (y - bottom - skirt) / (height - skirt);
  return Math.sqrt(1 - t * t);
}

/**
 * Puts a hat on the kid. The worker's hats are blocks for its flat head; on
 * the kid's round one a rounded block becomes a dome, a flat one a round brim
 * or band, and a band round a dome hugs it. Anything else is kept as it is.
 */
function wearKidHat(
  head: T.Object3D,
  hat: ItemModel,
  player: string,
  seat: number,
) {
  const group = new T.Group();
  group.position.set(...HAT_AT);
  group.position.y = seat;
  group.scale.setScalar(HAT_FIT);
  head.add(group);
  const centred = (part: Part): part is Box =>
    part.shape === 'box' &&
    !part.turn &&
    Math.abs(part.at[0]) < 0.05 &&
    Math.abs(part.at[2]) < 0.06;
  const parts = hat.parts.filter((part) => part.on === 'head');
  const domes = parts.filter(
    (part): part is Box =>
      centred(part) &&
      !!part.rounded &&
      part.size[1] > 0.08 &&
      part.size[2] >= 0.5,
  );
  for (const part of parts) {
    // The helmet shell starts at the rim; a full ellipsoid narrows below it
    // and lets forehead curls poke through the metal.
    if (part.shape === 'ball' && part.size[0] >= 0.29 && part.at[1] === 0) {
      dome(
        group,
        [part.size[0], part.size[1] + 0.04, part.size[2]],
        -0.04,
        [part.at[0], part.at[2]],
        colourOf(part, player),
      );
      continue;
    }
    if (part.shape !== 'box' || !centred(part)) {
      addPart(group, part, [0, 0, 0], 1, player);
      continue;
    }
    const [w, h, d] = part.size;
    const colour = colourOf(part, player);
    if (domes.includes(part)) {
      dome(
        group,
        [w / 2, h, d / 2],
        part.at[1] - h / 2,
        [part.at[0], part.at[2]],
        colour,
      );
      continue;
    }
    if (w < 0.5) {
      addPart(group, part, [0, 0, 0], 1, player);
      continue;
    }
    // A band round a dome hugs it; a brim below every dome keeps its size.
    let across = 0,
      deep = 0;
    for (const other of domes) {
      const [ow, oh, od] = other.size;
      const share = domeWidth(other.at[1] - oh / 2, oh, part.at[1]);
      if (!share) continue;
      across = Math.max(across, (ow / 2) * share + 0.015);
      deep = Math.max(deep, (od / 2) * share + 0.015);
    }
    const disc = new T.Mesh(
      new T.CylinderGeometry(1, 1, h, 32),
      material(colour),
    );
    disc.position.set(...part.at);
    disc.scale.set(across || w / 2, 1, deep || d / 2);
    group.add(shaded(disc));
  }
}

/**
 * Puts a look's items on a kid built by `lola` or `nico`, and says which slots
 * it filled. Build the kid with long trousers when the look has a legs item,
 * and with room under a hat when it has a hat; `playerKid` does both.
 */
export function dressKid(model: T.Object3D, player: string, look?: Look): Worn {
  const models = modelsOf(look);
  const rig = model.userData as Record<string, T.Object3D>;
  if (look?.face === 'snorkel-mask' && models.face) {
    const path = new T.CatmullRomCurve3([
      new T.Vector3(0.07, 0.185, 0.32),
      new T.Vector3(0.25, 0.185, 0.34),
      new T.Vector3(0.37, 0.25, 0.27),
      new T.Vector3(0.38, 0.48, 0.17),
      new T.Vector3(0.38, 0.73, 0.17),
      new T.Vector3(0.34, 0.77, 0.17),
    ]);
    lookGroup(rig.head).add(
      shaded(
        new T.Mesh(
          new T.TubeGeometry(path, 40, 0.025, 12, false),
          material('#f2d14b'),
        ),
      ),
    );
  }
  for (const [slot, item] of Object.entries(models) as [Slot, ItemModel][]) {
    // The sash uses the shared surface-following fit; retain native clothing elsewhere.
    const own =
      look?.[slot] === 'badge-sash' ? undefined : KID_ITEMS[look?.[slot] ?? ''];
    if (own) {
      own({
        body: lookGroup(rig.body),
        legs: [lookGroup(rig.legL), lookGroup(rig.legR)],
        sleeves: [lookGroup(rig.sleeveL), lookGroup(rig.sleeveR)],
        head: lookGroup(rig.head),
        player,
      });
      continue;
    }
    for (const part of item.parts) {
      if (
        look?.face === 'snorkel-mask' &&
        slot === 'face' &&
        (part.shape === 'taper' || (part.shape === 'box' && part.size[0] < 0.2))
      )
        continue;
      if (part.on === 'face')
        placeOnFace(
          lookGroup(rig.head),
          part,
          player,
          slot === 'beard' && look?.beard !== 'big-moustache',
        );
      else if (part.on === 'body')
        placeOn(lookGroup(rig.body), part, TORSO, player);
      else if (part.on === 'legs' || part.on === 'arms') {
        const arms = part.on === 'arms';
        const frame = arms ? SLEEVES : slot === 'shoes' ? SHOES : TROUSERS;
        for (const [side, limb] of [
          [-1, arms ? rig.sleeveL : rig.legL],
          [1, arms ? rig.sleeveR : rig.legR],
        ] as const)
          placeOn(lookGroup(limb), mirrored(part, side), frame, player);
      }
    }
  }
  if (models.hat) {
    const seat = (model.userData.hatSeat as number | undefined) ?? HAT_AT[1];
    wearKidHat(lookGroup(rig.head), models.hat, player, seat);
    const top = Math.max(
      ...models.hat.parts.filter((p) => p.on === 'head').map(partTop),
    );
    model.userData.hatTop = HEAD_Y + seat + HAT_FIT * top;
  }
  return Object.fromEntries(
    SLOTS.map((slot) => [slot, !!models[slot]]),
  ) as Worn;
}
