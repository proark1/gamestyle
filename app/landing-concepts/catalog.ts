import { GAME_IDS, type Game } from '@/shared/games/identity';
import {
  CARDS_TRANSLATIONS,
  type CardTranslation,
} from '@/shared/language/translations/cards';

interface GameAsset {
  image: string;
  alt: string;
}

export interface LandingGame extends GameAsset {
  slug: Game;
  href: string;
  title: string;
  copy: CardTranslation;
}

const GAME_ASSETS = {
  'act-natural': {
    image: '/images/court-cast-v1/boys/blend-business.jpg',
    alt: 'Four clay friends in cow disguises sneak a ladder toward a pasture gate behind a distracted farmer.',
  },
  basketball: {
    image: '/images/court-cast-v1/boys/court-clash.jpg',
    alt: 'Four clay basketball players in red and blue jerseys jump and reach for a dunk on an outdoor court.',
  },
  'bouncy-castle-royale': {
    image: '/images/court-cast-v1/boys/bouncy-castle-royale-v2.png',
    alt: 'Two red-team clay boys and two blue-team boys leap beside a volleyball net in an inflatable castle.',
  },
  'bungee-doubles': {
    image: '/images/court-cast-v1/boys/bungee-doubles.jpg',
    alt: 'Four clay players compete at padel, with the red pair linked by a stretching bungee cord.',
  },
  'cage-clash': {
    image: '/images/court-cast-v1/cage-clash-v2.jpg',
    alt: 'Two clay boys grapple inside a green octagonal cage as boys cheer behind the fence.',
  },
  'carry-on-carnage': {
    image: '/images/court-cast-v1/boys/carry-on-carnage.jpg',
    alt: 'Four clay travelers squash an overstuffed suitcase beside an airport luggage sizer as toys pop out.',
  },
  'chain-of-fools': {
    image: '/images/court-cast-v1/boys/chain-of-fools.jpg',
    alt: 'Four clay demolition workers linked by a chain haul a dangling teammate onto a girder.',
  },
  chaos: {
    image: '/images/court-cast-v1/boys/permit-pending.jpg',
    alt: 'Four clay builders carry a sofa and guide a crane lifting a bathtub onto a half-built house.',
  },
  'course-correction': {
    image: '/images/court-cast-v1/boys/course-correction.png',
    alt: 'Four clay boys putt colored golf balls through a rotating wall, tipping bridge, and moving cup.',
  },
  'crane-clash': {
    image: '/images/court-cast-v1/boys/crane-clash.jpg',
    alt: 'Four clay workers use red and blue cranes to stack crates into competing towers.',
  },
  'dont-wake-the-giant': {
    image: '/images/court-cast-v1/boys/tiptoe-thieves.jpg',
    alt: 'Four tiny clay adventurers steal a golden necklace from a sleeping giant in a cozy cottage.',
  },
  'drive-thru': {
    image: '/images/court-cast-v1/boys/drive-thru.jpg',
    alt: 'Three clay travelers reach from a car for a wobbling burger tray served by their friend at a drive-thru.',
  },
  'first-person': {
    image: '/images/court-cast-v1/boys/brick-by-hand.jpg',
    alt: 'Clay hands lay a brick with a trowel while three familiar friends work beyond the wall.',
  },
  'four-brain-cells': {
    image: '/images/court-cast-v1/boys/four-brain-cells.jpg',
    alt: 'Four clay friends pilot a clumsy robot that pours coffee, flips pancakes, and kicks the breakfast table.',
  },
  'load-bearing': {
    image: '/images/court-cast-v1/boys/load-bearing.jpg',
    alt: 'Four clay workers protect an upright piano as a wrecking ball breaks a house wall.',
  },
  'on-the-ropes': {
    image: '/images/court-cast-v1/on-the-ropes-v2.jpg',
    alt: 'Four clay boys box in red and blue teams, with teammates waiting in the ring corners.',
  },
  'one-more-button': {
    image: '/images/court-cast-v1/boys/one-more-button.jpg',
    alt: 'One clay contestant presses a red button, launching a boxing glove toward three surprised friends.',
  },
  'panic-curling': {
    image: '/images/court-cast-v1/boys/panic-curling.jpg',
    alt: 'Four clay friends sweep a curling rink as a teammate rides a laundry basket toward the target.',
  },
  'reel-problems': {
    image: '/images/court-cast-v1/boys/reel-problems.jpg',
    alt: 'Four clay friends in life jackets reel in an enormous fish from a rocking orange boat.',
  },
  'reel-problems-2': {
    image: '/images/court-cast-v1/boys/reel-problems.jpg',
    alt: 'Four clay friends in life jackets reel in an enormous fish from a rocking orange boat.',
  },
  'reel-problems-3': {
    image: '/images/court-cast-v1/boys/reel-problems-3.png',
    alt: 'First-person hands brace on a clay fishing boat while three friends follow a glowing legendary fish.',
  },
  'reel-problems-4': {
    image: '/images/court-cast-v1/boys/reel-problems.jpg',
    alt: 'Four clay friends upgrade a rocking orange fishing boat for an open-sea voyage.',
  },
  'sample-stampede': {
    image: '/images/court-cast-v1/boys/sample-stampede.jpg',
    alt: 'Four clay friends race two loaded shopping carts toward a tray of supermarket samples.',
  },
  'scaffold-scramble': {
    image: '/images/court-cast-v1/boys/scaffold-scramble.jpg',
    alt: 'Four clay window cleaners cling to a tilted suspended scaffold as a bucket spills soapy water.',
  },
  'shelf-control': {
    image: '/images/court-cast-v1/boys/shelf-control.jpg',
    alt: 'Four familiar clay-faced display mannequins sneak a ladder through a furniture showroom behind a guard.',
  },
  'siege-and-desist': {
    image: '/images/court-cast-v1/boys/siege-and-desist.jpg',
    alt: 'Four clay medieval crew members struggle with a trebuchet beside a distant sandstone castle.',
  },
  slopewreck: {
    image: '/images/court-cast-v1/boys/slopewreck.png',
    alt: 'Four riders race down a snowy mountain as ramps and rails appear behind them.',
  },
  'stack-or-sink': {
    image: '/images/court-cast-v1/boys/stack-or-sink.jpg',
    alt: 'Four clay friends stack furniture and crates above rising turquoise floodwater.',
  },
  'uphill-delivery': {
    image: '/images/court-cast-v1/boys/uphill-delivery.jpg',
    alt: 'Four clay friends in work overalls carry a yellow sofa up village steps beside a goat and rope bridge.',
  },
  'wrong-floor': {
    image: '/images/court-cast-v1/boys/wrong-floor.jpg',
    alt: 'Four clay hotel guests approach an elevator while one spots a shadow down the corridor.',
  },
  'zorb-clash': {
    image: '/images/court-cast-v1/boys/zorb-clash.jpg',
    alt: 'Four clay players in clear zorb bubbles collide and tumble around a soccer ball.',
  },
} satisfies Record<Game, GameAsset>;

export const FEATURED_GAMES = {
  cinematic: ['stack-or-sink', 'reel-problems-4', 'chain-of-fools'],
  broadcast: ['bouncy-castle-royale', 'slopewreck', 'cage-clash'],
  arcade: ['panic-curling', 'zorb-clash', 'one-more-button'],
} as const satisfies Record<string, readonly Game[]>;

export function gameTitle(copy: CardTranslation) {
  return `${copy.titleMain}${copy.titleHighlight ?? ''}${copy.titleSuffix ?? ''}`.replace(
    /\.$/,
    '',
  );
}

export function getLandingGames(language: string): LandingGame[] {
  return GAME_IDS.map((slug) => {
    const dictionary = CARDS_TRANSLATIONS[slug];
    const copy = dictionary?.[language] ?? dictionary?.en;
    const asset = GAME_ASSETS[slug];

    if (!copy) {
      throw new Error(`Missing landing-card translation for ${slug}`);
    }

    return {
      slug,
      href: `/${slug}`,
      image: asset.image,
      alt: asset.alt,
      title: gameTitle(copy),
      copy,
    };
  });
}

export function selectGames(
  games: LandingGame[],
  slugs: readonly Game[],
): LandingGame[] {
  const bySlug = new Map(games.map((game) => [game.slug, game]));
  return slugs.flatMap((slug) => {
    const game = bySlug.get(slug);
    return game ? [game] : [];
  });
}
