import { Quaternion, Vec3 } from 'cannon-es';
import type { Vec } from './types';

export type LevelBox = {
  id: string;
  size: [number, number, number];
  position: Vec;
  quaternion: { x: number; y: number; z: number; w: number };
  color: string;
  ice?: boolean;
  bridge?: boolean;
};
export const ROUTE: Vec[] = [
  { x: -12, y: 0, z: 13 },
  { x: 10, y: 3, z: 13 },
  { x: 10, y: 4, z: 6 },
  { x: -10, y: 7, z: 6 },
  { x: -10, y: 8, z: -1 },
  { x: 10, y: 11, z: -1 },
  { x: 10, y: 12, z: -8 },
  { x: -10, y: 15, z: -8 },
  { x: -10, y: 16, z: -15 },
  { x: 10, y: 19, z: -15 },
  { x: 10, y: 20, z: -23 },
  { x: 2, y: 22, z: -23 },
];
export const GATE = { x: 1, y: 9.65, z: -1 };
export const DOOR = { x: -3, y: 22, z: -24.85 };
export const GOATS = [
  { x: 4, y: 2.45, z: 13 },
  { x: -5.8, y: 14.65, z: -8 },
];
const identity = { x: 0, y: 0, z: 0, w: 1 };
export function block(
  id: string,
  size: LevelBox['size'],
  x: number,
  y: number,
  z: number,
  color = '#a4ad8a',
): LevelBox {
  return {
    id,
    size,
    position: { x, y, z },
    quaternion: { ...identity },
    color,
  };
}
function ramp(
  id: string,
  a: Vec,
  b: Vec,
  width = 4.6,
  color = '#d6c69e',
): LevelBox {
  const direction = new Vec3(b.x - a.x, b.y - a.y, b.z - a.z);
  const length = direction.length();
  direction.normalize();
  const q = new Quaternion().setFromAxisAngle(
    new Vec3(0, 1, 0),
    Math.atan2(-direction.z, direction.x),
  );
  q.mult(
    new Quaternion().setFromAxisAngle(
      new Vec3(0, 0, 1),
      Math.atan2(direction.y, Math.hypot(direction.x, direction.z)),
    ),
    q,
  );
  return {
    id,
    size: [length + 0.18, 0.5, width],
    position: {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2 - 0.25,
      z: (a.z + b.z) / 2,
    },
    quaternion: { x: q.x, y: q.y, z: q.z, w: q.w },
    color,
  };
}
const mix = (a: Vec, b: Vec, t: number): Vec => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
function roadPoint(a: Vec, b: Vec, t: number): Vec {
  const distance = Math.hypot(b.x - a.x, b.z - a.z),
    landing = 2.45 / distance;
  return {
    ...mix(a, b, t),
    y:
      a.y +
      (b.y - a.y) * Math.max(0, Math.min(1, (t - landing) / (1 - landing * 2))),
  };
}
export const LEVEL: LevelBox[] = [
  block('bottom', [46, 1, 62], 0, -1.1, -4, '#a5b396'),
  block('depot', [10, 0.6, 8], -12, -0.3, 13, '#cbbd95'),
];
for (let i = 0; i < ROUTE.length - 1; i++) {
  const a = ROUTE[i],
    b = ROUTE[i + 1];
  if (i === 2) {
    // Individually moving planks retain their state through a deterministic clock.
    for (let j = 0; j < 25; j++)
      LEVEL.push({
        ...ramp(
          `bridge-${j}`,
          roadPoint(a, b, j / 25),
          roadPoint(a, b, (j + 0.92) / 25),
          3.5,
          '#a98759',
        ),
        bridge: true,
      });
  } else if (i === 6) {
    const edge = 2.45 / 20;
    LEVEL.push(ramp('gap-start', a, roadPoint(a, b, edge)));
    LEVEL.push(
      ramp('gap-before', roadPoint(a, b, edge), roadPoint(a, b, 0.43)),
    );
    LEVEL.push(
      ramp('gap-after', roadPoint(a, b, 0.57), roadPoint(a, b, 1 - edge)),
    );
    LEVEL.push(ramp('gap-end', roadPoint(a, b, 1 - edge), b));
  } else if (i === 8) {
    for (let j = 0; j < 20; j++) {
      const p = roadPoint(a, b, (j + 0.5) / 20);
      LEVEL.push({
        ...block(
          `ice-${j}`,
          [1.03, 0.5, 4.3],
          p.x,
          p.y - 0.175,
          p.z,
          '#b6d3cd',
        ),
        ice: true,
      });
    }
  } else {
    const edge = 2.45 / Math.hypot(b.x - a.x, b.z - a.z);
    LEVEL.push(ramp(`road-${i}-start`, a, roadPoint(a, b, edge)));
    LEVEL.push(
      ramp(`road-${i}`, roadPoint(a, b, edge), roadPoint(a, b, 1 - edge)),
    );
    LEVEL.push(ramp(`road-${i}-end`, roadPoint(a, b, 1 - edge), b));
  }
  if (i > 0)
    LEVEL.push(
      block(`turn-${i}`, [4.65, 0.5, 4.65], a.x, a.y - 0.45, a.z, '#c8bc97'),
    );
}
LEVEL.push(
  block('porch', [6, 0.6, 6], -1.1, 21.7, -23, '#d8c9a4'),
  block('customer-floor', [6.2, 0.6, 7], -6.1, 21.7, -23, '#d6ba89'),
  block('customer-back', [0.4, 3.3, 7], -9.1, 23.65, -23, '#c2cba5'),
  block('customer-side-a', [6.2, 3.3, 0.35], -6.1, 23.65, -26.4, '#c2cba5'),
  block('customer-side-b', [6.2, 3.3, 0.35], -6.1, 23.65, -19.6, '#c2cba5'),
  // A narrow village lane forces the crew to turn the sofa lengthways.
  block('alley-left', [6.5, 2.8, 1.25], -4.5, 10.1, -3.15, '#c5b291'),
  block('alley-right', [6.5, 2.8, 1.25], -4.5, 10.1, 1.15, '#adbd9c'),
);
export function bridgePose(box: LevelBox, clock: number) {
  const index = Number(box.id.slice(7));
  const envelope = Math.sin((Math.PI * (index + 0.5)) / 25);
  return {
    y:
      box.position.y -
      envelope * (0.25 + Math.sin(clock / 800 + index * 0.22) * 0.08),
    roll: Math.sin(clock / 1100 + index * 0.27) * 0.035 * envelope,
  };
}
export function goatPose(index: number, elapsed: number) {
  const home = GOATS[index],
    phase = elapsed / 1500 + index * 2.4;
  const x = home.x + Math.sin(phase) * 1.8;
  const a = ROUTE[index === 0 ? 0 : 6],
    b = ROUTE[index === 0 ? 1 : 7];
  return {
    x,
    y: roadPoint(a, b, (x - a.x) / (b.x - a.x)).y,
    z: home.z + Math.cos(phase * 0.7) * 1.45,
    angle: Math.atan2(Math.cos(phase), -Math.sin(phase * 0.7) * 0.56),
  };
}
export function routeStage(height: number) {
  if (height < 3.5) return 'The long way up';
  if (height < 7.5) return 'Rope bridge · mind the wobble';
  if (height < 11.5) return 'Village alley · someone get the gate';
  if (height < 15.5) return 'Broken path · the sofa is your bridge';
  if (height < 20) return 'Icy stairs · small steps';
  return 'No. 4 · the door opens outward';
}
