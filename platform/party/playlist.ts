import type { GameId } from '../../shared/audio/types';
import { PARTY_GUIDES } from './guides';
import { hasGameAccess } from '../../shared/commerce/catalog';

export type PartyGameInfo = {
  id: GameId;
  name: string;
  tagline: string;
  teams?: boolean;
  scoring: 'team' | 'individual' | 'cooperative';
  minutes: number;
  complexity: 'easy' | 'medium' | 'tricky';
  quick: boolean;
  image: string;
};

const GAMES = [
  {
    id: 'on-the-ropes',
    name: 'On the Ropes',
    tagline: 'Swing, wobble and tag your corner partner',
    teams: true,
  },
  {
    id: 'crane-clash',
    name: 'Crane Clash',
    tagline: 'Swing from cables & stack crates highest',
    teams: true,
  },
  {
    id: 'basketball',
    name: 'Court Clash',
    tagline: 'Slam dunks, interceptions & alley-oops',
    teams: true,
  },
  {
    id: 'bungee-doubles',
    name: 'Bungee Doubles',
    tagline: 'Elastic cord padel frenzy',
    teams: true,
  },
  {
    id: 'panic-curling',
    name: 'Panic Curling',
    tagline: 'Laundry basket curling on slippery ice',
    teams: true,
  },
  {
    id: 'zorb-clash',
    name: 'Zorb Clash',
    tagline: 'Bumper football: roll, bump and score with the ball',
    teams: true,
  },
  {
    id: 'carry-on-carnage',
    name: 'Carry-On Carnage',
    tagline: 'Dogpile to pack the runaway suitcase',
  },
  {
    id: 'sample-stampede',
    name: 'Sample Stampede',
    tagline: 'Grocery cart dash to snatch tasty bites',
    teams: true,
  },
  {
    id: 'one-more-button',
    name: 'One More Button',
    tagline: 'Press for a bigger prize, survive the hazards and cash out',
  },
  {
    id: 'siege-and-desist',
    name: 'Siege and Desist',
    tagline: 'Aim the giant trebuchet & shatter walls',
    // Party mode launches the default 2v2 clash, not classic siege.
    teams: true,
  },
  {
    id: 'stack-or-sink',
    name: 'Stack or Sink',
    tagline: 'Stack salvage high before the flood rises',
  },
  {
    id: 'dont-wake-the-giant',
    name: 'Tiptoe Thieves',
    tagline: 'Sneak past the sleeping giant with loot',
  },
  {
    id: 'drive-thru',
    name: 'Drive-Thru Static',
    tagline: 'Chaotic short-order kitchen orders',
  },
  {
    id: 'act-natural',
    name: 'Blend Business',
    tagline: 'Blend in as an NPC and spot the human',
  },
  {
    id: 'four-brain-cells',
    name: 'Four Brain Cells',
    tagline: 'Four limbs, one robot: cook breakfast together',
  },
  {
    id: 'wrong-floor',
    name: 'Wrong Floor',
    tagline: 'Scramble through hotel elevator chaos',
  },
  {
    id: 'load-bearing',
    name: 'Load Bearing',
    tagline: 'Bring down the building. Save the piano!',
  },
  {
    id: 'reel-problems',
    name: 'Reel Problems',
    tagline: 'Fish from a wobbly boat, untangle lines and rescue friends',
  },
  {
    id: 'uphill-delivery',
    name: 'Uphill Delivery',
    tagline: 'Haul an enormous sofa up a mountain trail',
  },
  {
    id: 'scaffold-scramble',
    name: 'Scaffold Scramble',
    tagline: 'Crank winches & wipe windows 80 stories up',
  },
  {
    id: 'chain-of-fools',
    name: 'Chain of Fools',
    tagline: 'Four workers, one safety line, no unclipping',
  },
] satisfies { id: GameId; name: string; tagline: string; teams?: boolean }[];

export const PARTY_GAMES: readonly PartyGameInfo[] = GAMES.map((game) => ({
  ...game,
  scoring:
    'teams' in game && game.teams
      ? 'team'
      : ['one-more-button', 'act-natural'].includes(game.id)
        ? 'individual'
        : 'cooperative',
  minutes: PARTY_GUIDES[game.id].minutes,
  complexity: PARTY_GUIDES[game.id].complexity,
  quick: PARTY_GUIDES[game.id].quick,
  image:
    game.id === 'on-the-ropes'
      ? '/images/on-the-ropes.png'
      : `/images/party-gameplay/${game.id}.webp`,
}));

export function getPartyGameInfo(id: GameId): PartyGameInfo | undefined {
  return PARTY_GAMES.find((game) => game.id === id);
}

/**
 * Randomly pick `count` distinct mini-games for the party tournament playlist.
 */
export function generatePlaylist(
  count = 6,
  random: () => number = Math.random,
  format: 'quick' | 'classic' = 'classic',
  accessScope: 'free' | 'full' = 'full',
): GameId[] {
  const pool = PARTY_GAMES.filter(
    (g) =>
      (format !== 'quick' || g.quick) &&
      (accessScope === 'full' || hasGameAccess(g.id, false)),
  ).map((g) => g.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;
  }
  const opener = pool.findIndex(
    (id) => getPartyGameInfo(id)?.complexity === 'easy',
  );
  if (opener > 0) [pool[0], pool[opener]] = [pool[opener], pool[0]];
  if (!pool.length) return [];
  return accessScope === 'free'
    ? Array.from({ length: count }, (_, index) => pool[index % pool.length])
    : pool.slice(0, Math.min(count, pool.length));
}
