import * as T from 'three';
import { COLORS } from '../palette';
import type { WorkerOutfit } from '../worker';
import {
  SKULL,
  dome,
  hoopKid,
  inClay,
  onFace,
  ring,
  runHoopKid,
  strokes,
  type KidStyle,
} from './hoop-kid';
import { soft, surface } from './soft-parts';

const HAIR = '#55311f';
const HAIR_LIGHT = '#673d28';
const GROOVE = '#40271b';
/** The hair cap's centre and radii, before it is tipped back. */
const CAP = {
  centre: new T.Vector3(0, 0.31, -0.015),
  radii: new T.Vector3(0.335, 0.32, 0.31),
};
/** Where each pigtail is tied, for the right side. */
const TIE = new T.Vector3(0.29, 0.44, -0.09);

/** Hair is clay too: a little sheen, like the skin. */
function lock(parent: T.Object3D, radii: [number, number, number]) {
  const mesh = soft(parent, radii, [0, 0, 0], HAIR);
  mesh.material = surface(HAIR, 0.6);
  return mesh;
}

/** Strands pressed into the cap, combed from the parting to a pigtail tie. */
function grooves(side: number, radii = CAP.radii) {
  const tie = TIE.clone()
    .multiply(new T.Vector3(side, 1, 1))
    .sub(CAP.centre);
  const end = tie.divide(radii).normalize();
  // From the front hairline over the crown, then round the back to the nape.
  return [-0.62, -0.28, 0.1, 0.5, 0.95, 1.45, 1.95].map((angle) => {
    const start = new T.Vector3(0, Math.cos(angle), -Math.sin(angle));
    const points: [number, number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const along = start
        .clone()
        .lerp(end, (i / 8) * 0.86)
        .normalize();
      const point = along.multiply(radii).multiplyScalar(1.004).add(CAP.centre);
      points.push([point.x, point.y, point.z]);
    }
    return points;
  });
}

/** A pigtail from a tie at the side of the head, flicking up at its end. */
function pigtail(head: T.Group, side: number, tie: string) {
  const base = new T.Group();
  base.position.set(side * TIE.x, TIE.y, TIE.z);
  base.rotation.z = side * 0.8;
  head.add(base);
  const swing = new T.Group();
  swing.userData.side = side;
  base.add(swing);
  ring(swing, 0.04, 0.02, [0, -0.015, 0], tie).rotation.x = Math.PI / 2;
  const clumps: [number, number, number, number, number][] = [
    // radius x, radius y, x, y, tilt
    [0.074, 0.1, 0, -0.09, 0],
    [0.07, 0.1, 0.004, -0.2, 0.06],
    [0.061, 0.095, 0.018, -0.3, 0.16],
    [0.049, 0.08, 0.046, -0.39, 0.36],
    [0.035, 0.058, 0.086, -0.45, 0.85],
  ];
  for (const [rx, ry, x, y, tilt] of clumps) {
    const clump = lock(swing, [rx, ry, rx * 0.92]);
    clump.position.set(side * x, y, 0);
    clump.rotation.z = side * tilt;
  }
  return swing;
}

/**
 * Lola, the girl from the court picture: the clay basketball kid with a
 * brown bob of bangs and two pigtails in ties that match her kit. The kit
 * (`outfit`), `style` and rig are the kid's; see `hoopKid`.
 */
export function lola(
  color = 0,
  outfit: WorkerOutfit = {},
  style: KidStyle = {},
) {
  const kid = hoopKid(color, outfit, {
    teeth: false,
    ears: false,
    trousers: style.trousers,
  });
  const { head } = kid;
  const tie = outfit.shirt ?? COLORS[color % COLORS.length];

  if (style.coveredHair) return inClay(kid.root);

  // A clay cap of hair, tipped back so it frames the face and covers the nape.
  // Under a hat it lies flatter, so the crown stays inside the hat.
  const radii = CAP.radii.clone();
  if (style.hat) radii.add(new T.Vector3(0, -0.06, -0.02));
  dome(head, Math.PI * 0.56, radii.toArray(), 0.7, CAP.centre.toArray(), HAIR);
  // Swept bangs across the forehead, then a lock down each cheek.
  const bangs: [number, number, number][] = [
    [-0.14, 0.47, 0.42],
    [-0.015, 0.495, 0.2],
    [0.12, 0.48, -0.08],
  ];
  // Under a hat they sit lower and flatter, just showing below its brim.
  const tuck = style.hat ? 0.035 : 0;
  for (const [i, [x, y, roll]] of bangs.entries()) {
    const bang = lock(head, [0.115, 0.062, 0.036 - tuck / 3]);
    onFace(bang, x, y - tuck, 0.012 - tuck / 5, [SKULL]);
    bang.rotateZ(roll);
    if (i % 2) bang.material = surface(HAIR_LIGHT, 0.6);
  }
  for (const side of [-1, 1]) {
    const cheek = lock(head, [0.05, 0.12, 0.055]);
    cheek.position.set(side * 0.285, 0.25, 0.05);
    cheek.rotation.z = side * 0.12;
  }
  strokes(head, [...grooves(-1, radii), ...grooves(1, radii)], 0.0045, GROOVE);
  kid.swinging.push(...[-1, 1].map((side) => pigtail(head, side, tie)));
  return inClay(kid.root);
}

/** Lola runs like every hoop kid, her pigtails bouncing. */
export const walkLola = runHoopKid;
