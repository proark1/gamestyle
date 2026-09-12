import type * as T from 'three';
import type { AvatarLook } from '../../../shared/rendering/avatar-preview';
import { bumble, walkBumble } from '../../../shared/rendering/avatars/bumble';
import { hollow, walkHollow } from '../../../shared/rendering/avatars/hollow';
import { mochi, walkMochi } from '../../../shared/rendering/avatars/mochi';
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

export type AvatarCard = {
  id: string;
  name: string;
  /** A one-word mood shown beside the name. */
  tag?: string;
  /** Anything a reader needs to compare this avatar fairly. */
  note?: string;
  looks: readonly AvatarLook[];
};

function potential(
  key: string,
  label: string,
  build: (color: number) => T.Group,
  walk: (model: T.Object3D, time: number, walking: boolean) => void,
): AvatarLook {
  return {
    key,
    label,
    create() {
      const root = build(0);
      return { root, pose: (time, walking) => walk(root, time, walking) };
    },
  };
}

/** New characters to compare before other games adopt one. */
export const POTENTIAL_AVATARS: readonly AvatarCard[] = [
  {
    id: 'funny',
    name: 'Bumble',
    tag: 'Funny',
    note: 'A pear-shaped goof with googly eyes, a red nose and a propeller cap. It waddles in giant shoes, arms flailing. Player colour: shirt.',
    looks: [potential('bumble', 'Bumble', bumble, walkBumble)],
  },
  {
    id: 'cute',
    name: 'Mochi',
    tag: 'Cute',
    note: 'A round little one in a bunny-eared hood. It hops, flops its ears and blinks. Player colour: hood.',
    looks: [potential('mochi', 'Mochi', mochi, walkMochi)],
  },
  {
    id: 'scary',
    name: 'Hollow',
    tag: 'Scary',
    note: 'A tall hooded wraith with a stitched mask and long claws. It limps, and its head snaps sideways. Player colour: glowing eyes.',
    looks: [potential('hollow', 'Hollow', hollow, walkHollow)],
  },
];

const SHARED = 'The shared worker model, unchanged.';
const AVATARS: Record<string, Omit<AvatarCard, 'id' | 'name'>> = {
  'siege-and-desist': { looks: siegeAvatars },
  'stack-or-sink': {
    looks: stackAvatars,
    note: 'The shared worker in its cap: the template the other games follow.',
  },
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
    note: 'The shared worker in a striped hard hat and a tool belt.',
  },
  'first-person': {
    looks: siteAvatars,
    note: 'Played in first person: other players see this builder.',
  },
  'wrong-floor': {
    looks: hotelAvatars,
    note: 'The shared worker in a knitted beanie and brown shoes.',
  },
  'one-more-button': {
    looks: buttonAvatars,
    note: 'The shared worker with a sweatband, sneakers and a contestant card.',
  },
  'four-brain-cells': {
    looks: breakfastAvatars,
    note: 'One robot for the whole team; each player steers a limb.',
  },
  'reel-problems': {
    looks: reelAvatars,
    note: 'The shared worker with a bucket hat, a life vest and a rod. Height includes the rod.',
  },
  'shelf-control': {
    looks: shelfAvatars,
    note: 'The shared worker in wood; the guard adds a badge and a torch.',
  },
  'load-bearing': { looks: loadBearingAvatars, note: SHARED },
};

/** Every game's player avatars, in the order the admin lists the games. */
export const AVATAR_GAMES: readonly AvatarCard[] = GAMES.flatMap((game) => {
  const avatars = AVATARS[game.id];
  return avatars ? [{ id: game.id, name: game.name, ...avatars }] : [];
});

/** The lineup opens against the shared worker that six games build on. */
export const DEFAULT_TEMPLATE = 'stack-or-sink:stacker';
