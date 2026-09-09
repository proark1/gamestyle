import type { ItemKind } from './model';

export const PAINTS = [
  { id: 'original', name: 'Original', hex: '#d9b38b' },
  { id: 'chalk', name: 'Chalk', hex: '#f3f2df' },
  { id: 'sunflower', name: 'Sunflower', hex: '#f5c447' },
  { id: 'coral', name: 'Coral', hex: '#e78268' },
  { id: 'brick', name: 'Brick red', hex: '#b95a4b' },
  { id: 'rose', name: 'Rose', hex: '#e7a4bd' },
  { id: 'lavender', name: 'Lavender', hex: '#a69cdb' },
  { id: 'ocean', name: 'Ocean', hex: '#548dc5' },
  { id: 'mint', name: 'Mint', hex: '#7bc9b0' },
  { id: 'forest', name: 'Forest', hex: '#527e65' },
  { id: 'slate', name: 'Slate', hex: '#596977' },
] as const;
export type PaintId = (typeof PAINTS)[number]['id'];
export type Finish = 'classic' | 'plaster' | 'brickwork' | 'tiles' | 'checker';
export type Appearance = { paint?: PaintId; finish?: Finish };
export function finishesFor(kind: ItemKind) {
  if (kind === 'floor')
    return [
      { id: 'classic', name: 'Wood planks' },
      { id: 'tiles', name: 'Square tiles' },
      { id: 'checker', name: 'Checkerboard' },
    ] as const;
  if (kind === 'wall' || kind === 'window' || kind === 'door')
    return [
      { id: 'classic', name: 'Timber frame' },
      { id: 'plaster', name: 'Smooth plaster' },
      { id: 'brickwork', name: 'Brickwork' },
    ] as const;
  return [{ id: 'classic', name: 'Classic' }] as const;
}
export function validateAppearance(
  kind: ItemKind,
  value: Appearance,
): Appearance {
  if (value.paint !== undefined && !PAINTS.some((p) => p.id === value.paint))
    throw new Error('Choose a color from the paint box.');
  if (
    value.finish !== undefined &&
    !finishesFor(kind).some((f) => f.id === value.finish)
  )
    throw new Error('Choose a finish that fits this part.');
  return {
    ...(value.paint !== undefined ? { paint: value.paint } : {}),
    ...(value.finish !== undefined ? { finish: value.finish } : {}),
  };
}
export const appearanceKey = (value: Appearance) =>
  `${value.paint || 'original'}:${value.finish || 'classic'}`;
export const paintHex = (value: Appearance) =>
  PAINTS.find((p) => p.id === value.paint && p.id !== 'original')?.hex;
