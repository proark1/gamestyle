import type { CourseState, PivotWall, Vec2 } from './types';

export const STARTS: readonly Vec2[] = [
  { x: -1.2, z: 0.7 },
  { x: -0.4, z: 0.25 },
  { x: 0.4, z: 0.25 },
  { x: 1.2, z: 0.7 },
];

const wall = (
  id: string,
  x: number,
  z: number,
  angle: number,
  width = 3.4,
): PivotWall => ({
  id,
  x,
  z,
  width,
  depth: 0.24,
  angle,
  velocity: 0,
  min: angle - Math.PI * 0.42,
  max: angle + Math.PI * 0.42,
});

export function createCourse(hole: number): CourseState {
  if (hole === 0)
    return {
      id: 'pivot-alley',
      width: 8,
      length: 15,
      startZ: 0,
      cup: { x: 0, z: 13.1 },
      walls: [
        wall('gate-a', -1.5, 5.3, 0.55),
        wall('gate-b', 1.55, 8.3, -0.52),
      ],
      obstacles: [
        { id: 'cone', kind: 'cone', x: -2.6, z: 10.6, radius: 0.4 },
        { id: 'pan', kind: 'pan', x: 2.3, z: 6.8, radius: 0.62 },
      ],
      bridge: null,
      platform: null,
    };
  if (hole === 1)
    return {
      id: 'tipping-point',
      width: 8.6,
      length: 16,
      startZ: 0,
      cup: { x: 2.1, z: 14.1 },
      walls: [wall('switchback', -1.6, 5.2, 0.38, 3.8)],
      obstacles: [
        { id: 'cone', kind: 'cone', x: -2.6, z: 3.2, radius: 0.4 },
        { id: 'pan', kind: 'pan', x: 2.3, z: 6.8, radius: 0.62 },
      ],
      bridge: { x: 0.4, z: 9.4, width: 4.6, depth: 2.7, angle: 0, velocity: 0 },
      platform: null,
    };
  return {
    id: 'moving-target',
    width: 9,
    length: 17,
    startZ: 0,
    cup: { x: 0, z: 15.2 },
    walls: [
      wall('fork', 0, 4.6, Math.PI / 2, 4.2),
      wall('bank', -1.8, 10.8, 0.45, 3.5),
    ],
    obstacles: [
      { id: 'cone', kind: 'cone', x: -2.6, z: 3.2, radius: 0.4 },
      { id: 'pan', kind: 'pan', x: 2.3, z: 11.8, radius: 0.62 },
      { id: 'washer', kind: 'washer', x: -3, z: 7.7, radius: 0.72 },
    ],
    bridge: { x: 1.5, z: 8.1, width: 4.2, depth: 2.4, angle: 0, velocity: 0 },
    platform: {
      baseX: 0,
      z: 15.2,
      offset: 0,
      velocity: 0,
      min: -2.2,
      max: 2.2,
    },
  };
}

export function cupPosition(course: CourseState): Vec2 {
  return {
    x: course.platform
      ? course.platform.baseX + course.platform.offset
      : course.cup.x,
    z: course.platform?.z ?? course.cup.z,
  };
}
