import {
  FLOOR,
  PART_HITS,
  alive,
  partBottom,
  partTop,
  type LoadWorld,
  type Part,
  type PartKind,
} from './types';

/** Vertical gap still counted as contact between a part and the one under it. */
const CONTACT = 0.07;
/** Footprints must genuinely overlap; a shared edge does not carry load. */
const BITE = 0.12;

const GROUND_TOP = 3;
const BEAM_TOP = 3.3;
const SLAB_TOP = 3.7;
const UPPER_TOP = 6.2;
const ROOF_TOP = 6.5;
export const HALF_W = 5;
export const HALF_D = 4;
/** The client's piano stands on this bay of the upper floor. */
export const PIANO_BAY = { x: 3.33, z: -2 };

function part(
  id: string,
  kind: PartKind,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): Part {
  return {
    id,
    kind,
    x,
    y,
    z,
    w,
    h,
    d,
    hits: PART_HITS[kind],
    falling: false,
    vx: 0,
    vy: 0,
    vz: 0,
    strain: 0,
  };
}

export function buildHouse(): Part[] {
  const parts: Part[] = [];
  const columnXs = [-HALF_W, 0, HALF_W];
  const columnZs = [-HALF_D, HALF_D];
  for (const x of columnXs)
    for (const z of columnZs)
      parts.push(
        part(`col-${x}-${z}`, 'column', x, GROUND_TOP / 2, z, 0.5, GROUND_TOP, 0.5),
      );
  // Ground walls fill the bays between columns, front, back and both sides.
  for (const z of columnZs)
    for (const x of [-HALF_W / 2, HALF_W / 2])
      parts.push(
        part(`wall-${x}-${z}`, 'wall', x, 1.4, z, HALF_W - 0.5, 2.8, 0.3),
      );
  for (const x of [-HALF_W, HALF_W])
    parts.push(
      part(`wall-side-${x}`, 'wall', x, 1.4, 0, 0.3, 2.8, HALF_D * 2 - 0.5),
    );
  // Ring beams sit on the columns and carry the upper floor.
  for (const z of columnZs)
    parts.push(
      part(
        `beam-z-${z}`,
        'beam',
        0,
        (GROUND_TOP + BEAM_TOP) / 2,
        z,
        HALF_W * 2,
        BEAM_TOP - GROUND_TOP,
        0.5,
      ),
    );
  for (const x of [-HALF_W, HALF_W])
    parts.push(
      part(
        `beam-x-${x}`,
        'beam',
        x,
        (GROUND_TOP + BEAM_TOP) / 2,
        0,
        0.5,
        BEAM_TOP - GROUND_TOP,
        HALF_D * 2,
      ),
    );
  // Six slab panels, so the upper floor can drop one bay at a time.
  for (const x of [-3.33, 0, 3.33])
    for (const z of [-2, 2])
      parts.push(
        part(
          `slab-${x}-${z}`,
          'slab',
          x,
          (BEAM_TOP + SLAB_TOP) / 2,
          z,
          3.33,
          SLAB_TOP - BEAM_TOP,
          4,
        ),
      );
  for (const x of [-HALF_W, HALF_W])
    for (const z of columnZs)
      parts.push(
        part(
          `up-col-${x}-${z}`,
          'column',
          x,
          (SLAB_TOP + UPPER_TOP) / 2,
          z,
          0.5,
          UPPER_TOP - SLAB_TOP,
          0.5,
        ),
      );
  for (const z of columnZs)
    parts.push(
      part(`up-wall-z-${z}`, 'wall', 0, 4.85, z, HALF_W * 2 - 0.5, 2.3, 0.3),
    );
  for (const x of [-HALF_W, HALF_W])
    parts.push(
      part(`up-wall-x-${x}`, 'wall', x, 4.85, 0, 0.3, 2.3, HALF_D * 2 - 0.5),
    );
  for (const z of [-2, 2])
    parts.push(
      part(
        `roof-${z}`,
        'roof',
        0,
        (UPPER_TOP + ROOF_TOP) / 2,
        z,
        HALF_W * 2,
        ROOF_TOP - UPPER_TOP,
        4,
      ),
    );
  return parts;
}

export const grounded = (p: Part) => partBottom(p) <= FLOOR + CONTACT;

/** True when `upper` is carried by `lower`: touching, and footprints bite. */
export function restsOn(lower: Part, upper: Part) {
  if (Math.abs(partTop(lower) - partBottom(upper)) > CONTACT) return false;
  return (
    Math.abs(lower.x - upper.x) < (lower.w + upper.w) / 2 - BITE &&
    Math.abs(lower.z - upper.z) < (lower.d + upper.d) / 2 - BITE
  );
}

/**
 * Flood fill upward from the ground. Anything the fill cannot reach has lost
 * its path to the footings and is no longer holding itself up.
 */
export function supported(parts: Part[]): Set<string> {
  const standing = parts.filter((p) => alive(p) && !p.falling);
  const held = new Set<string>();
  for (const p of standing) if (grounded(p)) held.add(p.id);
  for (let pass = 0; pass < standing.length; pass++) {
    let added = false;
    for (const upper of standing) {
      if (held.has(upper.id)) continue;
      if (standing.some((lower) => held.has(lower.id) && restsOn(lower, upper))) {
        held.add(upper.id);
        added = true;
      }
    }
    if (!added) break;
  }
  return held;
}

/**
 * Recompute support and release everything that just lost the ground. Returns
 * the parts that started falling in this pass so callers can report them.
 */
export function releaseUnsupported(world: LoadWorld): Part[] {
  const held = supported(world.parts);
  const released: Part[] = [];
  for (const p of world.parts) {
    if (!alive(p) || p.falling) continue;
    if (!held.has(p.id)) {
      p.falling = true;
      p.sleeping = false;
      p.idle = 0;
      released.push(p);
    }
  }
  return released;
}

/**
 * Load a standing part carries beyond its own bay, used for the creak and the
 * strain shading. A part with fewer neighbours below is closer to going.
 */
export function strainOf(parts: Part[], target: Part) {
  if (!alive(target) || target.falling || grounded(target)) return 0;
  const below = parts.filter(
    (p) => alive(p) && !p.falling && restsOn(p, target),
  ).length;
  const above = parts.filter(
    (p) => alive(p) && !p.falling && restsOn(target, p),
  ).length;
  if (!below) return 1;
  return Math.min(1, Math.max(0, (above + 1) / (below * 2)) );
}

export function pianoSupport(world: LoadWorld) {
  return world.parts.find(
    (p) =>
      alive(p) &&
      !p.falling &&
      Math.abs(p.x - world.piano.x) < p.w / 2 + 0.4 &&
      Math.abs(p.z - world.piano.z) < p.d / 2 + 0.4 &&
      Math.abs(partTop(p) - (world.piano.y - 0.55)) < 0.5,
  );
}
