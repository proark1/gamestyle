import { ITEMS, SLOTS, type Slot } from './catalog';

/** The item a player wears in each slot, by id. An empty slot shows the game's own clothes. */
export type Look = Partial<Record<Slot, string>>;

/** Keeps only catalog items in their own slots, and drops everything else. */
export function parseLook(raw: unknown): Look | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const look: Look = {};
  for (const slot of SLOTS) {
    if (!Object.hasOwn(raw, slot)) continue;
    const id = (raw as Record<string, unknown>)[slot];
    if (
      typeof id === 'string' &&
      ITEMS.some((item) => item.id === id && item.slot === slot)
    )
      look[slot] = id;
  }
  return Object.keys(look).length ? look : undefined;
}
