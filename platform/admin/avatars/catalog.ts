import type { AvatarLook } from '../../../shared/rendering/avatar-preview';
import { farmAvatars } from '../../../games/act-natural/avatar';
import { chaosAvatars } from '../../../games/chaos/avatar';
import { giantAvatars } from '../../../games/dont-wake-the-giant/avatar';
import { siteAvatars } from '../../../games/first-person/avatar';
import { breakfastAvatars } from '../../../games/four-brain-cells/avatar';
import { loadBearingAvatars } from '../../../games/load-bearing/avatar';
import { buttonAvatars } from '../../../games/one-more-button/avatar';
import { reelAvatars } from '../../../games/reel-problems/avatar';
import { shelfAvatars } from '../../../games/shelf-control/avatar';
import { siegeAvatars } from '../../../games/siege-and-desist/avatar';
import { stackAvatars } from '../../../games/stack-or-sink/avatar';
import { deliveryAvatars } from '../../../games/uphill-delivery/avatar';
import { hotelAvatars } from '../../../games/wrong-floor/avatar';
import { GAMES } from '../../analytics/catalog';

export type AvatarGame = {
  id: string;
  name: string;
  /** Anything a reader needs to compare this avatar fairly. */
  note?: string;
  looks: readonly AvatarLook[];
};

const SHARED = 'The shared worker model, unchanged.';
const AVATARS: Record<string, Omit<AvatarGame, 'id' | 'name'>> = {
  'siege-and-desist': { looks: siegeAvatars },
  'stack-or-sink': { looks: stackAvatars, note: SHARED },
  'act-natural': {
    looks: farmAvatars,
    note: 'Players are cows or the farmer, who is the shared worker with a torch.',
  },
  'uphill-delivery': {
    looks: deliveryAvatars,
    note: 'The shared worker, merged into fewer meshes.',
  },
  'dont-wake-the-giant': {
    looks: giantAvatars,
    note: 'The shared worker at about half size, with a mask.',
  },
  chaos: {
    looks: chaosAvatars,
    note: 'Its own worker model, not the shared one.',
  },
  'first-person': {
    looks: siteAvatars,
    note: 'Played in first person: other players see this builder.',
  },
  'wrong-floor': { looks: hotelAvatars },
  'one-more-button': { looks: buttonAvatars },
  'four-brain-cells': {
    looks: breakfastAvatars,
    note: 'One robot for the whole team; each player steers a limb.',
  },
  'reel-problems': {
    looks: reelAvatars,
    note: 'Height includes the fishing rod. Anglers sway rather than step.',
  },
  'shelf-control': {
    looks: shelfAvatars,
    note: 'The shared worker in wood; the guard adds a badge and a torch.',
  },
  'load-bearing': { looks: loadBearingAvatars, note: SHARED },
};

/** Every game's player avatars, in the order the admin lists the games. */
export const AVATAR_GAMES: readonly AvatarGame[] = GAMES.flatMap((game) => {
  const avatars = AVATARS[game.id];
  return avatars ? [{ id: game.id, name: game.name, ...avatars }] : [];
});

/** The lineup opens against the shared worker that six games build on. */
export const DEFAULT_TEMPLATE = 'stack-or-sink:stacker';
