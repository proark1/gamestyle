import {
  clamp,
  dimensions,
  FLOOR,
  snapped,
  type Part,
  type PartKind,
  type Placement,
} from './model';

/** Mesh bevels never participate in snapping: contacts use the shared construction dimensions. */
export function placementAtSurface(
  point: { x: number; y: number; z: number },
  normal: { x: number; y: number; z: number },
  kind: PartKind,
  rotation: number,
  part?: Part,
): Placement {
  const d = dimensions(kind, rotation);
  let x = point.x,
    z = point.z,
    y = FLOOR + d.h / 2;
  if (part) {
    const support = dimensions(part.kind, part.rotation);
    y = part.y + support.h / 2 + d.h / 2;
    if ((kind !== 'roof' || part.kind === 'roof') && Math.abs(normal.y) < 0.5) {
      y = part.y - support.h / 2 + d.h / 2;
      if (Math.abs(normal.x) > 0.5) {
        x = part.x + (Math.sign(normal.x) * (support.w + d.w)) / 2;
        if (kind === 'brick' && part.kind === 'brick')
          z =
            part.z +
            (rotation !== part.rotation
              ? ((point.z >= part.z ? 1 : -1) * (support.d - d.d)) / 2
              : 0);
      }
      if (Math.abs(normal.z) > 0.5) {
        z = part.z + (Math.sign(normal.z) * (support.d + d.d)) / 2;
        if (kind === 'brick' && part.kind === 'brick')
          x =
            part.x +
            (rotation !== part.rotation
              ? ((point.x >= part.x ? 1 : -1) * (support.w - d.w)) / 2
              : 0);
      }
    }
  } else {
    x = clamp(x, -4 + d.w / 2, 4 - d.w / 2);
    z = clamp(z, -3 + d.d / 2, 3 - d.d / 2);
  }
  return snapped({ x, y, z, rotation }, kind);
}

export function previewShape(tool: string, p: Placement, dryBrick?: Part) {
  const d = dimensions(
    tool === 'mortar' ? 'brick' : (tool as PartKind),
    p.rotation,
  );
  return {
    w: d.w,
    h: tool === 'mortar' ? 0.024 : d.h,
    d: d.d,
    y:
      tool === 'mortar'
        ? dryBrick
          ? dryBrick.y + 0.125 + 0.01
          : p.y - 0.125 + 0.015
        : p.y,
  };
}
