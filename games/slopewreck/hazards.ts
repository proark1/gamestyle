import type { Collider } from './collision';
import { HALF_WIDTH } from './types';

export type SnowballHazard = {
  id: string;
  type: 'snowball';
  z: number;
  phase: number;
  speed: number;
  radius: number;
};

export type GateHazard = {
  id: string;
  type: 'gate';
  z: number;
  x: number;
  gap: number;
};

export type SnowbankHazard = {
  id: string;
  type: 'snowbank';
  z: number;
  x: number;
  halfX: number;
};

export type Hazard = SnowballHazard | GateHazard | SnowbankHazard;

export const HAZARDS: readonly Hazard[] = [
  {
    id: 'snowball-starter',
    type: 'snowball',
    z: 38,
    phase: 1.4,
    speed: 0.76,
    radius: 1.35,
  },
  { id: 'gate-one', type: 'gate', z: 84, x: -2.5, gap: 3.1 },
  {
    id: 'snowball-one',
    type: 'snowball',
    z: 126,
    phase: 0.3,
    speed: 0.82,
    radius: 1.45,
  },
  { id: 'bank-one', type: 'snowbank', z: 184, x: -5.8, halfX: 3.4 },
  { id: 'gate-two', type: 'gate', z: 252, x: 3.4, gap: 2.9 },
  {
    id: 'snowball-two',
    type: 'snowball',
    z: 326,
    phase: 2.2,
    speed: 0.94,
    radius: 1.55,
  },
  { id: 'bank-two', type: 'snowbank', z: 390, x: 5.7, halfX: 3.5 },
  { id: 'gate-three', type: 'gate', z: 454, x: -1.4, gap: 2.7 },
  {
    id: 'snowball-three',
    type: 'snowball',
    z: 510,
    phase: 4.1,
    speed: 1.06,
    radius: 1.45,
  },
] as const;

export function snowballX(hazard: SnowballHazard, clock: number) {
  return (
    Math.sin(clock * 0.001 * hazard.speed + hazard.phase) *
    (HALF_WIDTH - hazard.radius - 0.6)
  );
}

export function hazardColliders(
  hazard: Hazard,
  clock: number,
  collapsed: readonly string[],
): Collider[] {
  if (hazard.type === 'snowball')
    return [
      {
        id: hazard.id,
        shape: 'circle',
        x: snowballX(hazard, clock),
        z: hazard.z,
        radius: hazard.radius,
        height: hazard.radius * 2,
        source: 'snowball',
      },
    ];
  if (hazard.type === 'gate')
    return [-1, 1].map((side) => ({
      id: `${hazard.id}-${side < 0 ? 'left' : 'right'}`,
      shape: 'circle' as const,
      x: hazard.x + side * hazard.gap * 0.5,
      z: hazard.z,
      radius: 0.22,
      height: 2.1,
      source: 'gate' as const,
    }));
  if (collapsed.includes(hazard.id)) return [];
  return [
    {
      id: hazard.id,
      shape: 'box',
      x: hazard.x,
      z: hazard.z,
      halfX: hazard.halfX,
      halfZ: 0.62,
      height: 0.95,
      source: 'snowbank',
    },
  ];
}

export function allHazardColliders(
  clock: number,
  collapsed: readonly string[],
) {
  return HAZARDS.flatMap((hazard) => hazardColliders(hazard, clock, collapsed));
}
