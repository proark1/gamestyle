import type { Piece } from './types';
export function previewPieces(): Piece[] {
  const list: [Piece['kind'], number, number, number, number][] = [
    ['crate', -0.7, 0, 1, 0],
    ['sofa', -0.3, 1.3, 1, 0],
    ['pallet', -0.4, 2.35, 1, 0],
    ['fridge', -0.85, 2.8, 0.9, 0],
    ['crate', 0.1, 4.6, 1, 0],
    ['plank', 0.35, 5.9, 1, 0],
    ['bathtub', 0.4, 6.15, 1, 0],
    ['crate', 3, 0, 3, 0],
    ['pallet', -3.2, 0, 3, 1],
    ['bathtub', -4, 0, -1, 1],
    ['sofa', 4, 0, -1, 1],
    ['fridge', -5, 0, 5, 0],
    ['plank', 3, 0, 6, 1],
    ['crate', -4, 0, -4, 0],
    ['pallet', 5, 0, -4, 0],
    ['crate', 5, 0, 4.5, 0],
  ];
  return list.map(([kind, x, y, z, rotation], i) => ({
    id: `preview-${i}`,
    kind,
    x,
    y,
    z,
    rotation,
    vy: 0,
    tilt: 0,
    unstable: 0,
  }));
}
