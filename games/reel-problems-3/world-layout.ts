import type { RoundPhase } from './types';

export const NICO_EYE_HEIGHT = 1.56;
export const BOAT_DECK_HEIGHT = 1.05;
export const DOCK_HEIGHT = 0.95;
export const SHORE_HEIGHT = 0.86;

export const HARBOR_LAYOUT = {
  gangway: { x: 3.65, z: 0, width: 1.8, depth: 2.2 },
  bell: { x: 6.65, z: -2.9, width: 2.15, depth: 0.55 },
  tower: { x: 9.15, z: -3.35, radius: 1.38 },
  shed: { x: 8.65, z: 3.45, width: 2.45, depth: 1.7 },
  trees: [
    { x: 10.05, z: 1.55, radius: 0.42 },
    { x: 9.8, z: 4.65, radius: 0.38 },
  ],
  rocks: [
    { x: 10.1, z: -0.15, radius: 0.55 },
    { x: 9.85, z: -5.1, radius: 0.48 },
  ],
  posts: [
    { x: 4.6, z: -4.2, radius: 0.25 },
    { x: 4.6, z: 4.2, radius: 0.25 },
    { x: 9.8, z: 0, radius: 0.25 },
  ],
} as const;

export function localSurfaceHeight(
  phase: RoundPhase,
  x: number,
  z: number,
) {
  if (phase === 'preparing') {
    if (x >= 8.9) return SHORE_HEIGHT;
    if (x >= 4.4 || (x >= 2.75 && Math.abs(z) <= 1.15)) return DOCK_HEIGHT;
  }
  return BOAT_DECK_HEIGHT;
}
