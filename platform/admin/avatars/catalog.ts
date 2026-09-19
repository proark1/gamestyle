import type * as T from 'three';
import type { AvatarLook } from '../../../shared/rendering/avatar-preview';
import { bumble, walkBumble } from '../../../shared/rendering/avatars/bumble';
import { hollow, walkHollow } from '../../../shared/rendering/avatars/hollow';
import { mochi, walkMochi } from '../../../shared/rendering/avatars/mochi';
import { milo, walkMilo } from '../../../shared/rendering/avatars/milo';
import { jelly, walkJelly } from '../../../shared/rendering/avatars/jelly';
import { pip, walkPip } from '../../../shared/rendering/avatars/pip';
import { pals, walkPals } from '../../../shared/rendering/avatars/pals';
import { playerKid, type KidId } from '../../../shared/rendering/avatars/kid';
import { runHoopKid } from '../../../shared/rendering/avatars/hoop-kid';
import { KIT } from '../../../shared/rendering/palette';
import {
  snug,
  walkSnug,
  type SnugKind,
} from '../../../shared/rendering/avatars/snug';
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
import { craneClashAvatars } from '../../../games/crane-clash/avatar';
import { basketballAvatars } from '../../../games/basketball/avatar';
import { bungeeDoublesAvatars } from '../../../games/bungee-doubles/avatar';
import { curlingAvatars } from '../../../games/panic-curling/avatar';
import { carryOnCarnageAvatars } from '../../../games/carry-on-carnage/avatar';
import { sampleStampedeAvatars } from '../../../games/sample-stampede/avatar';
import { driveThruAvatars } from '../../../games/drive-thru/avatar';
import { zorbAvatars } from '../../../games/zorb-clash/avatar';
import { scaffoldAvatars } from '../../../games/scaffold-scramble/avatar';
import { chainOfFoolsAvatars } from '../../../games/chain-of-fools/avatar';
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

/** A kid in one of the four kits, wearing a player's wardrobe items. */
function kidLook(kid: KidId, colour: keyof typeof KIT): AvatarLook {
  return {
    key: colour,
    label: `${colour[0].toUpperCase()}${colour.slice(1)} kit`,
    dressable: true,
    create(look) {
      const root = playerKid(kid, { jersey: KIT[colour] }, look).model;
      return { root, pose: (time, walking) => runHoopKid(root, time, walking) };
    },
  };
}

const KITS = Object.keys(KIT) as (keyof typeof KIT)[];

/** Snug in player colour `color`, wearing a player's hat and no other item. */
function snugLook(kind: SnugKind, label: string, color: number): AvatarLook {
  return {
    key: kind,
    label,
    dressable: true,
    slots: ['hat'],
    create(look) {
      const root = snug(color, kind, look);
      return { root, pose: (time, walking) => walkSnug(root, time, walking) };
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
  {
    id: 'human',
    name: 'Milo',
    tag: 'Human',
    note: 'A soft, rounded human with swept hair, a crooked smile and easygoing steps. Wears a sweater and sneakers. Player colour: sweater.',
    looks: [potential('milo', 'Milo', milo, walkMilo)],
  },
  {
    id: 'bean',
    name: 'Jelly',
    tag: 'Party',
    note: 'A soft jellybean with a face window, big eyes and stubby limbs, in the style of current party games. Wears the worker outfit, and its round top sits at the worker head top. Player colour: the bean.',
    looks: [potential('jelly', 'Jelly', jelly, walkJelly)],
  },
  {
    id: 'chibi',
    name: 'Pip',
    tag: 'Co-op',
    note: 'A chibi crewmate with a big head, worker overalls and floating hands, like couch co-op games. Reads well from far overhead cameras. Player colour: shirt and cap.',
    looks: [potential('pip', 'Pip', pip, walkPip)],
  },
  {
    id: 'animals',
    name: 'Pals',
    tag: 'Animals',
    note: 'Chubby party animals in hoodies: a bear, cat, fox or bunny by player colour. Ears replace the cap. Player colour: hoodie.',
    looks: [potential('pals', 'Pals', pals, walkPals)],
  },
  {
    id: 'hoop-girl',
    name: 'Lola',
    tag: 'Girl',
    note: 'The girl from the clay basketball picture: big glossy eyes, rosy cheeks, an open smile, swept bangs and two pigtails. Sleeveless jersey and shorts with white piping, wristbands and high-tops. Players are Nico for now, but she is built and dressed the same way, ready if the owner wants a choice of kid. Player colour: kit and hair ties.',
    looks: KITS.map((kit) => kidLook('lola', kit)),
  },
  {
    id: 'hoop-boy',
    name: 'Nico',
    tag: 'Boy',
    note: 'The boy dunking in the clay basketball picture: a mop of dark curls, ears showing and a toothy grin. He is the player in Court Clash, the first game on the kids. Team games dress him in red or blue; a game without teams gives each of four seats its own kit, adding green and yellow. Every wardrobe item fits, and under a hat his curls show only below the brim. Player colour: kit.',
    looks: KITS.map((kit) => kidLook('nico', kit)),
  },
  {
    id: 'toy',
    name: 'Snug',
    tag: 'Cosy',
    note: 'Chunky vinyl-toy travellers from the hotel concept art: a big round face, quilted puffer, jeans, woolly socks, boots and a backpack. She wears a twisted bun, he short hair. Hats come from the wardrobe: the Bobble Beanie is the knit beanie from the art, and any other hat fits the round head. Shown in plum and amber, like the art. Player colour: puffer.',
    looks: [snugLook('woman', 'Woman', 3), snugLook('man', 'Man', 0)],
  },
];

const SHARED = 'The shared worker model, unchanged.';
const AVATARS: Record<string, Omit<AvatarCard, 'id' | 'name'>> = {
  'siege-and-desist': {
    looks: siegeAvatars,
    note: 'The shared worker with a conical helmet and a nasal bar.',
  },
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
  'crane-clash': {
    looks: craneClashAvatars,
    note: 'The shared worker wearing team-colored hard hat and safety harness.',
  },
  basketball: {
    looks: basketballAvatars,
    note: 'The first game on the clay kids: every player is Nico in the team kit, wearing their own wardrobe items. The fans on the bleachers are kids too.',
  },
  'bungee-doubles': {
    looks: bungeeDoublesAvatars,
    note: 'The shared worker in team polo, tennis shorts, sweatband and sneakers.',
  },
  'panic-curling': {
    looks: curlingAvatars,
    note: 'The shared worker in winter parka and curling shoes.',
  },
  'carry-on-carnage': {
    looks: carryOnCarnageAvatars,
    note: 'The shared worker as an anxious tourist with bright shirt and denim jeans.',
  },
  'sample-stampede': {
    looks: sampleStampedeAvatars,
    note: 'The shared worker dressed in wholesale club apron and cap, operating carts and grabbers.',
  },
  'drive-thru': {
    looks: driveThruAvatars,
    note: 'The shared worker as drive-thru driver with cap and kitchen cook with paper hat and apron.',
  },
  'zorb-clash': {
    looks: zorbAvatars,
    note: 'The shared worker strapped inside a transparent bumper sphere, one per team.',
  },
  'scaffold-scramble': {
    looks: scaffoldAvatars,
    note: 'The shared worker in high-rise cleaning gear on a suspended platform.',
  },
  'chain-of-fools': {
    looks: chainOfFoolsAvatars,
    note: 'The shared worker in a yellow hard hat and hi-vis harness with a back D-ring for the safety line.',
  },
};

/** Every game's player avatars, in the order the admin lists the games. */
export const AVATAR_GAMES: readonly AvatarCard[] = GAMES.flatMap((game) => {
  const avatars = AVATARS[game.id];
  return avatars ? [{ id: game.id, name: game.name, ...avatars }] : [];
});

/** The lineup opens against the shared worker that six games build on. */
export const DEFAULT_TEMPLATE = 'stack-or-sink:stacker';
