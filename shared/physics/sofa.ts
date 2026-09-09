export type ShapeBox = {
  size: [number, number, number];
  pos: [number, number, number];
  color: string;
  rounded?: boolean;
  id?: string;
};
export const PLAYER_RADIUS = 0.34;
export const PLAYER_HEIGHT = 1.94;

/** Shared visible and physical sofa geometry. Games choose their scale and placement. */
export function sofaShapes({
  w = 2.8,
  h = 1.05,
  d = 1.25,
  color = '#d59940',
} = {}): ShapeBox[] {
  const shape = (
    size: ShapeBox['size'],
    pos: ShapeBox['pos'],
    shade: string,
    rounded = false,
  ): ShapeBox => ({ size, pos, color: shade, rounded });
  return [
    ...[-1.1, 1.1].flatMap((x) =>
      [-0.42, 0.42].map((z) =>
        shape([0.16, 0.23, 0.16], [x, 0.115, z], '#725b43'),
      ),
    ),
    shape([w, 0.4, d], [0, 0.43, 0], color, true),
    shape([w, h - 0.3, 0.3], [0, (h + 0.3) / 2, -(d - 0.3) / 2], color, true),
    ...[-1.24, 1.24].map((x) =>
      shape([0.32, 0.65, d], [x, 0.63, 0], color, true),
    ),
    ...[-0.62, 0.62].map((x) =>
      shape([1.08, 0.19, 0.86], [x, 0.7, 0.12], '#e8b453', true),
    ),
  ];
}
