import type { GameId } from '../../shared/audio/types';

export type PartyGameInfo = {
  id: GameId;
  name: string;
  tagline: string;
  teams?: boolean;
};

export const PARTY_GAMES: readonly PartyGameInfo[] = [
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
    tagline: 'Bumper sumo showdown in inflatable orbs',
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
  },
  {
    id: 'one-more-button',
    name: 'One More Button',
    tagline: 'Reactor panic sabotage & quick reflexes',
  },
  {
    id: 'siege-and-desist',
    name: 'Siege and Desist',
    tagline: 'Aim the giant trebuchet & shatter walls',
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
    tagline: 'Breakfast scramble with clumsy tools',
  },
  {
    id: 'wrong-floor',
    name: 'Wrong Floor',
    tagline: 'Scramble through hotel elevator chaos',
  },
  {
    id: 'load-bearing',
    name: 'Load Bearing',
    tagline: 'Precision wrecking ball demolitions',
  },
  {
    id: 'reel-problems',
    name: 'Reel Problems',
    tagline: 'Dockside crane fishing derby',
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
];

export function getPartyGameInfo(id: GameId): PartyGameInfo | undefined {
  return PARTY_GAMES.find((game) => game.id === id);
}

/**
 * Randomly pick `count` distinct mini-games for the party tournament playlist.
 */
export function generatePlaylist(
  count = 6,
  random: () => number = Math.random,
): GameId[] {
  const pool = PARTY_GAMES.map((g) => g.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;
  }
  return pool.slice(0, Math.min(count, pool.length));
}
