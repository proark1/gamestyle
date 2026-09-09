import * as T from 'three';
import type { Materials } from './world-view';
import { bakeModel, mesh, type XYZ } from './detail-geometry';

export type HandGrip = 'handle' | 'bucket' | 'support';
// Grip coordinates are shared by the hand and the held prop. The handle runs along X.
export const HAND_GRIP: XYZ = [0, -0.025, -0.05];

/** A smooth, tapered surface, rather than cylinders with separate balls at each joint. */
function loft(
  points: XYZ[],
  widths: number[],
  depths: number[],
  rows = 26,
  sides = 16,
) {
  const curve = new T.CatmullRomCurve3(
    points.map((p) => new T.Vector3(...p)),
    false,
    'centripetal',
  );
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const interpolate = (values: number[], t: number) => {
    const n = t * (values.length - 1),
      i = Math.min(values.length - 2, Math.floor(n));
    return T.MathUtils.lerp(values[i], values[i + 1], n - i);
  };
  for (let row = 0; row <= rows; row++) {
    const t = row / rows,
      center = curve.getPoint(t),
      tangent = curve.getTangent(t);
    const across = new T.Vector3(1, 0, 0)
      .addScaledVector(tangent, -tangent.x)
      .normalize();
    const normal = new T.Vector3().crossVectors(across, tangent).normalize();
    for (let side = 0; side <= sides; side++) {
      const a = (side / sides) * Math.PI * 2;
      const p = center
        .clone()
        .addScaledVector(across, Math.cos(a) * interpolate(widths, t))
        .addScaledVector(normal, Math.sin(a) * interpolate(depths, t));
      positions.push(p.x, p.y, p.z);
      uv.push(side / sides, t);
      if (row < rows && side < sides) {
        const a = row * (sides + 1) + side,
          b = a + sides + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, curve };
}

function nail(
  parent: T.Group,
  curve: T.CatmullRomCurve3,
  width: number,
  depth: number,
  m: Materials,
) {
  const t = 0.84,
    center = curve.getPoint(t),
    tangent = curve.getTangent(t);
  const across = new T.Vector3(1, 0, 0)
    .addScaledVector(tangent, -tangent.x)
    .normalize();
  const outward = new T.Vector3().crossVectors(across, tangent).normalize();
  // A very shallow curved nail plate follows the last phalanx, with no protruding white blocks.
  const plate = new T.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  plate.scale(width * 0.64, 0.0007, width * 0.91);
  const transform = new T.Matrix4().makeBasis(
    across,
    outward,
    tangent.clone().negate(),
  );
  transform.setPosition(center.addScaledVector(outward, depth * 0.92));
  plate.applyMatrix4(transform);
  mesh(parent, plate, m.nails);
}

export function makeWorkerHand(
  m: Materials,
  left = false,
  grip: HandGrip = 'handle',
) {
  const g = new T.Group();
  g.name = left ? 'left-hand' : 'right-hand';
  // The wrist flares gradually into the metacarpals; the palm is only 28 mm thick.
  const palm = loft(
    [
      [0, -0.003, 0.099],
      [0, 0, 0.065],
      [-0.001, 0.001, 0.032],
      [0, 0, -0.005],
      [0.002, -0.002, -0.039],
    ],
    [0.025, 0.027, 0.038, 0.043, 0.032],
    [0.012, 0.014, 0.017, 0.014, 0.008],
    30,
    20,
  );
  mesh(g, palm.geometry, m.skin);
  const radius = grip === 'bucket' ? 0.011 : 0.021;
  for (let i = 0; i < 4; i++) {
    const x = [-0.031, -0.0105, 0.0105, 0.03][i],
      r = [0.009, 0.0096, 0.009, 0.0078][i];
    const offset = [0, -0.006, -0.003, 0.007][i];
    const points: XYZ[] =
      grip === 'support'
        ? [
            [x, -0.004, -0.025],
            [x, -0.012, -0.05 + offset],
            [x, -0.015, -0.079 + offset],
            [x, -0.006, -0.098 + offset],
            [x, 0.003, -0.103 + offset],
          ]
        : [
            [x, 0, -0.025],
            [x, -0.001, -0.049 + offset],
            [x, -0.023, -0.052 - radius + offset],
            [x, -0.028 - radius, -0.055 + offset],
            [x, -0.033 - radius, -0.032 + offset],
          ];
    const finger = loft(
      points,
      [r * 1.08, r, r * 0.98, r * 0.84, 0.001],
      [r * 0.88, r * 0.92, r * 0.85, r * 0.81, 0.001],
      22,
      12,
    );
    mesh(g, finger.geometry, m.skin);
    nail(g, finger.curve, r, r * 0.84, m);
  }
  // Broad thenar root and opposing thumb, angled across the index finger.
  const thumbPoints: XYZ[] =
    grip === 'support'
      ? [
          [-0.024, -0.003, 0.03],
          [-0.045, -0.004, 0.009],
          [-0.056, 0.004, -0.025],
          [-0.052, 0.023, -0.057],
          [-0.043, 0.03, -0.068],
        ]
      : [
          [-0.023, -0.002, 0.028],
          [-0.041, -0.002, 0.006],
          [-0.043, 0.012, -0.024],
          [-0.025, 0.01, -0.045],
          [-0.011, 0.003, -0.055],
        ];
  const thumb = loft(
    thumbPoints,
    [0.019, 0.014, 0.0115, 0.0095, 0.001],
    [0.012, 0.012, 0.01, 0.0085, 0.001],
    26,
    16,
  );
  mesh(g, thumb.geometry, m.skin);
  nail(g, thumb.curve, 0.011, 0.009, m);

  const sleeve = loft(
    [
      [0, -0.004, 0.081],
      [0.006, -0.02, 0.128],
      [0.043, -0.108, 0.25],
      [0.106, -0.27, 0.46],
    ],
    [0.035, 0.039, 0.047, 0.059],
    [0.025, 0.031, 0.041, 0.052],
    24,
    20,
  );
  mesh(g, sleeve.geometry, m.sleeve);
  const cuff = loft(
    [
      [0, -0.003, 0.073],
      [0.002, -0.008, 0.089],
      [0.005, -0.017, 0.114],
    ],
    [0.031, 0.035, 0.036],
    [0.021, 0.025, 0.027],
    8,
    24,
  );
  mesh(g, cuff.geometry, m.cuff);
  // Mirror the complete anatomy, including finger lengths and thumb opposition.
  if (left)
    for (const child of g.children) {
      if (!(child instanceof T.Mesh)) continue;
      child.geometry.scale(-1, 1, 1);
      const index = child.geometry.index;
      if (index)
        for (let i = 0; i < index.count; i += 3) {
          const a = index.getX(i);
          index.setX(i, index.getX(i + 2));
          index.setX(i + 2, a);
        }
    }
  return bakeModel(g);
}
