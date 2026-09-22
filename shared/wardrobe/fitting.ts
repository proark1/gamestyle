import type { Item, Slot } from './catalog';
import type { Look } from './look';

export type TryOn = Partial<Record<Slot, string | null>>;

/** Clicking an active try-on restores the saved slot; an equipped item can
 * also be temporarily hidden without taking it off in the saved outfit. */
export function toggleTryOn(look: Look, draft: TryOn, item: Item): TryOn {
  const next = { ...draft };
  const current =
    draft[item.slot] === undefined ? look[item.slot] : draft[item.slot];
  if (current !== item.id) {
    if (look[item.slot] === item.id) delete next[item.slot];
    else next[item.slot] = item.id;
  } else if (draft[item.slot] !== undefined) {
    delete next[item.slot];
  } else {
    next[item.slot] = null;
  }
  return next;
}
