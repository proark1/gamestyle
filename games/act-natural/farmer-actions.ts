import { distance, GATE, LADDER_EXIT, PANEL, type FarmWorld } from './types';

export const ITEM_HOMES: Record<string, { x: number; z: number }> = {
  'barn-key': { x: -7, z: -6 },
  'shed-key': { x: 7, z: -6 },
  ladder: { x: 6, z: 4 },
};

export function farmerRepair(
  w: Pick<
    FarmWorld,
    'phase' | 'farmer' | 'powerOff' | 'keysDelivered' | 'ladderPlaced'
  >,
) {
  if (w.phase !== 'playing') return null;
  if (w.powerOff && distance(w.farmer, PANEL) < 2)
    return { kind: 'power' as const, label: 'Restore power' };
  if (w.keysDelivered > 0 && distance(w.farmer, GATE) < 2)
    return { kind: 'gate' as const, label: 'Relock gate' };
  if (w.ladderPlaced && distance(w.farmer, LADDER_EXIT) < 2)
    return { kind: 'ladder' as const, label: 'Put ladder away' };
  return null;
}
