export const MAPS = [
  {
    id: 'small',
    name: 'Small',
    description: 'The original close-knit site',
    scale: 1,
  },
  {
    id: 'medium',
    name: 'Medium',
    description: 'Twice the building space',
    scale: Math.SQRT2,
  },
  {
    id: 'large',
    name: 'Large',
    description: 'Four times the building space',
    scale: 2,
  },
] as const;
export type MapId = (typeof MAPS)[number]['id'];
export const mapConfig = (id?: MapId) =>
  MAPS.find((map) => map.id === id) ?? MAPS[0];
export const validMap = (id: unknown): id is MapId =>
  MAPS.some((map) => map.id === id);
export const mapBounds = (id?: MapId) => {
  const { scale } = mapConfig(id);
  return {
    buildX: 8 * scale,
    buildZ: 7 * scale,
    x: 11.1 * scale,
    back: -8.35 * scale,
    front: 8.65 * scale,
  };
};
export const onFoundation = (
  p: { x: number; z: number },
  id?: MapId,
  inset = 0,
) => {
  const { scale } = mapConfig(id);
  return (
    Math.abs(p.x) <= 4.7 * scale - inset &&
    p.z >= -5.2 * scale + inset &&
    p.z <= 4.2 * scale - inset
  );
};
