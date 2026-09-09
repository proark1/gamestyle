import type { GiantItem, ItemKind } from './types';

/** Rattle and bulk, rather than gold value: metal is hardest to carry quietly. */
export const ITEM_BURDEN: Record<ItemKind, number> = {
  coin: 0.35,
  cup: 0.8,
  necklace: 0.55,
  gem: 0.3,
  pouch: 0.25,
  crown: 1.1,
  pillow: 0,
  spoon: 1.1,
};

export function landingNoise(
  impact: number,
  item: GiantItem | undefined,
  crouch: boolean,
  softness: number,
) {
  const fallHeight = (impact * impact) / 36;
  const thud =
    Math.max(0, impact - 3) * 0.8 + Math.max(0, fallHeight - 1.6) * 5;
  return (
    thud *
    (1 + (item ? ITEM_BURDEN[item.kind] : 0) * 1.4) *
    (crouch ? 0.6 : 1) *
    softness
  );
}

export function itemImpactNoise(
  impact: number,
  item: GiantItem,
  softness: number,
) {
  if (item.kind === 'pillow') return 0;
  const fallHeight = (impact * impact) / 36;
  return Math.min(
    85,
    (Math.max(0, impact - 1.8) * 1.2 + fallHeight * 5) *
      (0.65 + ITEM_BURDEN[item.kind]) *
      softness,
  );
}
