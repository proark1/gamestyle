import {
  BODY_RADIUS,
  CAGE_RADIUS,
  STEP,
  type Fighter,
  type World,
} from './types';
export const cageVertices = () =>
  Array.from({ length: 8 }, (_, i) => ({
    x: Math.cos((i * Math.PI) / 4 + Math.PI / 8) * CAGE_RADIUS,
    z: Math.sin((i * Math.PI) / 4 + Math.PI / 8) * CAGE_RADIUS,
  }));
export function cageDistance(p: { x: number; z: number }) {
  let distance = Infinity;
  for (let i = 0; i < 8; i++)
    distance = Math.min(
      distance,
      CAGE_RADIUS * Math.cos(Math.PI / 8) -
        p.x * Math.cos((i * Math.PI) / 4) -
        p.z * Math.sin((i * Math.PI) / 4),
    );
  return distance;
}
export function contain(p: Fighter) {
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < 8; i++) {
      const nx = Math.cos((i * Math.PI) / 4),
        nz = Math.sin((i * Math.PI) / 4);
      const outside =
        p.x * nx +
        p.z * nz -
        (CAGE_RADIUS * Math.cos(Math.PI / 8) - BODY_RADIUS);
      if (outside > 0) {
        p.x -= nx * outside;
        p.z -= nz * outside;
        const into = p.vx * nx + p.vz * nz;
        if (into > 0) {
          p.vx -= nx * into;
          p.vz -= nz * into;
        }
      }
    }
}
export function physicsStep(w: World) {
  for (const p of w.players) {
    p.x += p.vx * STEP;
    p.z += p.vz * STEP;
    contain(p);
  }
  if (w.grapple && w.grapple.mode !== 'clinch') return;
  const [a, b] = w.players,
    dx = b.x - a.x,
    dz = b.z - a.z,
    distance = Math.hypot(dx, dz);
  if (distance < BODY_RADIUS * 2) {
    const nx = distance > 0.001 ? dx / distance : 1,
      nz = distance > 0.001 ? dz / distance : 0;
    const push = (BODY_RADIUS * 2 - distance) / 2;
    a.x -= nx * push;
    a.z -= nz * push;
    b.x += nx * push;
    b.z += nz * push;
    contain(a);
    contain(b);
  }
}
