import type { BrainWorld, Vec } from './types';

export function handPosition(w: BrainWorld, i: number): Vec {
  const l = w.limbs[i];
  return {
    x: w.robot.x + l.x,
    y: l.y + (w.robot.fallenUntil > w.clock ? -0.65 : 0),
    z: w.robot.z + l.z,
  };
}
export function platePosition(w: BrainWorld): Vec {
  return { x: w.table.x - 0.6, y: 1.8, z: w.table.z };
}
export function cupPosition(w: BrainWorld): Vec {
  return { x: w.table.x + 0.6, y: 1.95, z: w.table.z - 0.4 };
}
