export type CourseSide = -1 | 1;

export const BENCH_ROWS = [3.5, 9.2, 14.8] as const;
export const BENCH_LENGTH = 3.05;
export const BENCH_SEAT_HEIGHT = 0.18;
export const BENCH_SEAT_CENTER_Y = 0.42;
export const BENCH_ROOT_Y = -0.3;
export const BENCH_SEAT_TOP =
  BENCH_ROOT_Y + BENCH_SEAT_CENTER_Y + BENCH_SEAT_HEIGHT / 2;
export const BENCH_STANDING_OFFSET = BENCH_LENGTH / 2 + 0.42;

export type BenchLayout = {
  x: number;
  z: number;
  rotation: number;
  facing: number;
  seats: readonly { x: number; z: number }[];
};

export function benchLayout(side: CourseSide, z: number): BenchLayout {
  const rotation = -side * (Math.PI / 2);
  const x = side * 6.35;
  const seatOffsets = [-0.78, 0.78];
  return {
    x,
    z,
    rotation,
    facing: rotation,
    seats: seatOffsets.map((offset) => ({
      x: x + Math.sin(rotation) * 0.02,
      z: z + Math.cos(rotation) * 0.02 - side * offset,
    })),
  };
}
