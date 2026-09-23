import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WorkerOutfit } from '../worker';
import {
  SKULL,
  dome,
  hoopKid,
  inClay,
  runHoopKid,
  type KidStyle,
} from './hoop-kid';
import { surface } from './soft-parts';
import { nicoHatSeat } from './hat-fit';

/** Three browns, so the curls read as separate clumps. */
const SHADES = ['#3f261b', '#4d2f21', '#5b3928'];
const UNDER = '#2f1c14';
/** How far the mop tips back from upright, and how far round the head it reaches. */
const TILT = 0.65;
const REACH = 1.45;
const CURLS = 200;

const mops = new Map<number, T.BufferGeometry[]>();

/**
 * The curls, merged into one shared buffer per shade so a crowd of Nicos
 * stays cheap. Points spread evenly over a sphere (a Fibonacci lattice) and
 * keep those inside the hair's reach: tall on top, close-cropped low down.
 * Hats compress the crown, while the fringe and side curls keep their volume.
 */
function curlyMop(hat: boolean | string) {
  const seat = hat ? nicoHatSeat(hat) : 0;
  const cached = mops.get(seat);
  if (cached) return cached;
  const axis = new T.Vector3(0, Math.cos(TILT), -Math.sin(TILT));
  const centre = new T.Vector3(...SKULL.centre);
  const radii = new T.Vector3(...SKULL.radii);
  const ball = new T.SphereGeometry(1, 14, 10);
  const parts: T.BufferGeometry[][] = SHADES.map(() => []);
  for (let i = 0; i < CURLS; i++) {
    const y = 1 - (2 * (i + 0.5)) / CURLS;
    const around = i * Math.PI * (3 - Math.sqrt(5));
    const ring = Math.sqrt(1 - y * y);
    const dir = new T.Vector3(
      ring * Math.cos(around),
      y,
      ring * Math.sin(around),
    );
    if (dir.dot(axis) < Math.cos(REACH)) continue;
    const top = Math.max(0, dir.y);
    const jitter = Math.abs(Math.sin(i * 91.7)) % 1;
    const radius = 0.05 + jitter * 0.02 + top * 0.02;
    const position = dir
      .clone()
      .multiply(radii)
      .multiplyScalar(1.03 + 0.16 * top ** 1.5)
      .add(centre);
    // Keep every curl. Flatten only the upper crown into the hat; deleting
    // centres above the brim also deleted the curls framing the forehead.
    const crown = hat && position.y > seat - 0.08;
    if (crown) position.y = seat - 0.08 + (position.y - seat + 0.08) * 0.22;
    const curl = ball.clone();
    curl.applyMatrix4(
      new T.Matrix4().compose(
        position,
        new T.Quaternion().setFromAxisAngle(dir, jitter * Math.PI),
        new T.Vector3(radius, radius * (crown ? 0.5 : 0.9), radius),
      ),
    );
    // Enclosing headwear must contain the entire curl, not just its centre.
    if (hat === 'viking-helmet' || hat === 'skipper-cap') {
      const vertices = curl.getAttribute('position');
      const brim = seat - (hat === 'viking-helmet' ? 0.045 : 0);
      for (let v = 0; v < vertices.count; v++) {
        const y = vertices.getY(v);
        if (y <= brim - 0.04) continue;
        const blend = Math.min(1, (y - brim + 0.04) / 0.04);
        const inset = hat === 'viking-helmet' ? 0.24 * blend : 0;
        vertices.setXYZ(
          v,
          vertices.getX(v) * (1 - inset),
          Math.min(y, brim - 0.008),
          vertices.getZ(v) * (1 - inset),
        );
      }
      curl.computeVertexNormals();
    }
    parts[i % SHADES.length].push(curl);
  }
  ball.dispose();
  const mop = parts.map((list) => {
    const merged = mergeGeometries(list)!;
    for (const part of list) part.dispose();
    merged.userData.shared = true;
    return merged;
  });
  mops.set(seat, mop);
  return mop;
}

/**
 * Nico, the boy from the court picture, going up for the dunk: the clay
 * basketball kid with a mop of dark curls, ears showing and a toothy grin.
 * The kit (`outfit`), `style` and rig are the kid's; see `hoopKid`.
 */
export function nico(
  color = 0,
  outfit: WorkerOutfit = {},
  style: KidStyle = {},
) {
  const kid = hoopKid(color, outfit, {
    teeth: true,
    ears: true,
    trousers: style.trousers,
  });
  // A dark cap under the curls, so no scalp shows between them.
  if (!style.coveredHair)
    dome(kid.head, REACH - 0.08, [0.318, 0.3, 0.29], TILT, SKULL.centre, UNDER);
  if (style.hat) kid.root.userData.hatSeat = nicoHatSeat(style.hat);
  for (const [i, geometry] of (style.coveredHair
    ? []
    : curlyMop(style.hat ?? false)
  ).entries()) {
    const curls = new T.Mesh(geometry, surface(SHADES[i], 0.6));
    curls.castShadow = true;
    curls.receiveShadow = true;
    kid.head.add(curls);
  }
  return inClay(kid.root);
}

/** Nico runs like every hoop kid. */
export const walkNico = runHoopKid;
