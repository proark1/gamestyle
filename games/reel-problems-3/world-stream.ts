import { derivedSeed } from './random';
import type { AdventureWorld, StreamCell } from './types';

export const CELL_SIZE = 48;
export const ACTIVE_RADIUS = 1;

export function cellId(x: number, z: number) {
  return `${x}:${z}`;
}

export function cellAt(seed: number, x: number, z: number): StreamCell {
  const cellSeed = derivedSeed(seed, x, z);
  const roll = cellSeed % 13;
  const kind: StreamCell['kind'] =
    x === 0 && z === 0
      ? 'harbor'
      : roll <= 1
        ? 'rocks'
        : roll === 2
          ? 'islet'
          : roll <= 6
            ? 'fishing-ground'
            : 'open-water';
  return { id: cellId(x, z), x, z, seed: cellSeed, kind };
}

export function updateStream(world: AdventureWorld) {
  const centerX = Math.floor(world.boat.x / CELL_SIZE);
  const centerZ = Math.floor(world.boat.z / CELL_SIZE);
  const cells: StreamCell[] = [];
  for (let z = centerZ - ACTIVE_RADIUS; z <= centerZ + ACTIVE_RADIUS; z++)
    for (let x = centerX - ACTIVE_RADIUS; x <= centerX + ACTIVE_RADIUS; x++)
      cells.push(cellAt(world.round.seed, x, z));
  world.cells = cells;
}

export function cellCenter(cell: StreamCell) {
  return {
    x: (cell.x + 0.5) * CELL_SIZE,
    z: (cell.z + 0.5) * CELL_SIZE,
  };
}
