/**
 * The wardrobe: every item a player can wear on the shared worker, and the
 * goals that unlock the few that cannot be bought. Data only, so the server
 * and the browser can both import it. Item ids are never reused.
 */
export const SLOTS = ['hat', 'top', 'legs', 'shoes', 'face', 'beard'] as const;
export type Slot = (typeof SLOTS)[number];

export type Goal = {
  id: string;
  label: string;
  /** Different games played, hours played, or every game in the collection. */
  measure: 'games' | 'hours' | 'every-game';
  target?: number;
};

export type Item = {
  id: string;
  slot: Slot;
  name: string;
  /** Coins to buy it. An item has either a price or a goal. */
  price?: number;
  /** The goal that unlocks it instead. */
  goal?: string;
};

/** Raise when an item changes meaning, so an old shop page cannot buy the wrong thing. */
export const CATALOG_VERSION = 1;

export const GOALS: readonly Goal[] = [
  {
    id: 'three-games',
    label: 'Play 3 different games',
    measure: 'games',
    target: 3,
  },
  {
    id: 'five-games',
    label: 'Play 5 different games',
    measure: 'games',
    target: 5,
  },
  {
    id: 'ten-games',
    label: 'Play 10 different games',
    measure: 'games',
    target: 10,
  },
  { id: 'every-game', label: 'Play every game', measure: 'every-game' },
  { id: 'ten-hours', label: 'Play for 10 hours', measure: 'hours', target: 10 },
  {
    id: 'twenty-hours',
    label: 'Play for 20 hours',
    measure: 'hours',
    target: 20,
  },
  {
    id: 'fifty-hours',
    label: 'Play for 50 hours',
    measure: 'hours',
    target: 50,
  },
];

export const ITEMS: readonly Item[] = [
  // Hats
  { id: 'bobble-beanie', slot: 'hat', name: 'Bobble Beanie', price: 80 },
  { id: 'party-cone', slot: 'hat', name: 'Party Cone', price: 150 },
  { id: 'top-hat', slot: 'hat', name: 'Top Hat', price: 250 },
  { id: 'viking-helmet', slot: 'hat', name: 'Viking Helmet', price: 350 },
  { id: 'crown-of-greed', slot: 'hat', name: 'Crown of Greed', price: 450 },
  { id: 'skipper-cap', slot: 'hat', name: 'Skipper’s Cap', price: 180 },
  { id: 'sleepcap', slot: 'hat', name: 'Giant’s Sleepcap', price: 220 },
  {
    id: 'knight-helmet',
    slot: 'hat',
    name: 'Knight’s Kettle Helmet',
    price: 320,
  },
  {
    id: 'miner-helmet',
    slot: 'hat',
    name: 'Demolition Hard Hat',
    goal: 'ten-games',
  },
  {
    id: 'champion-hard-hat',
    slot: 'hat',
    name: 'Champion Hard Hat',
    goal: 'every-game',
  },

  // Tops
  { id: 'striped-tee', slot: 'top', name: 'Striped Tee', price: 60 },
  { id: 'bow-tie', slot: 'top', name: 'Collar and Bow Tie', price: 120 },
  { id: 'hero-cape', slot: 'top', name: 'Hero Cape', price: 300 },
  { id: 'bellhop-jacket', slot: 'top', name: 'Bellhop Uniform', price: 240 },
  { id: 'safety-vest', slot: 'top', name: 'Hi-Vis Safety Vest', price: 150 },
  { id: 'game-show-blazer', slot: 'top', name: 'Game Show Blazer', price: 350 },
  { id: 'canvas-apron', slot: 'top', name: 'Craft Apron', goal: 'three-games' },
  { id: 'badge-sash', slot: 'top', name: 'Badge Sash', goal: 'five-games' },

  // Legs
  { id: 'denim-overalls', slot: 'legs', name: 'Denim Overalls', price: 80 },
  { id: 'cargo-trousers', slot: 'legs', name: 'Cargo Trousers', price: 120 },
  { id: 'plaid-trousers', slot: 'legs', name: 'Plaid Trousers', price: 200 },
  {
    id: 'fisherman-waders',
    slot: 'legs',
    name: 'Fisherman Waders',
    price: 180,
  },
  { id: 'knight-greaves', slot: 'legs', name: 'Knight Greaves', price: 280 },

  // Shoes
  { id: 'rain-boots', slot: 'shoes', name: 'Rain Boots', price: 60 },
  { id: 'high-tops', slot: 'shoes', name: 'High-Tops', price: 100 },
  { id: 'clown-shoes', slot: 'shoes', name: 'Clown Shoes', price: 250 },
  {
    id: 'roller-skates',
    slot: 'shoes',
    name: 'Retro Roller Skates',
    price: 260,
  },
  { id: 'bunny-slippers', slot: 'shoes', name: 'Bunny Slippers', price: 160 },
  { id: 'scuba-flippers', slot: 'shoes', name: 'Scuba Flippers', price: 220 },
  {
    id: 'golden-kicks',
    slot: 'shoes',
    name: 'Golden Kicks',
    goal: 'twenty-hours',
  },
  {
    id: 'rocket-boots',
    slot: 'shoes',
    name: 'Rocket Boots',
    goal: 'fifty-hours',
  },

  // Glasses & Eye Accessories
  { id: 'round-glasses', slot: 'face', name: 'Round Glasses', price: 60 },
  { id: 'snorkel-mask', slot: 'face', name: 'Snorkel Mask', price: 200 },
  {
    id: 'master-disguise',
    slot: 'face',
    name: 'The Master Disguise',
    price: 240,
  },
  { id: 'pirate-eyepatch', slot: 'face', name: 'Pirate Eyepatch', price: 90 },
  { id: 'monocle-goatee', slot: 'face', name: 'Dapper Monocle', price: 180 },
  { id: 'pixel-shades', slot: 'face', name: 'Pixel Shades', price: 140 },
  { id: 'welding-goggles', slot: 'face', name: 'Welding Goggles', price: 210 },
  { id: 'star-shades', slot: 'face', name: 'Star Shades', goal: 'ten-hours' },

  // Beards & Facial Hair
  { id: 'big-moustache', slot: 'beard', name: 'Big Moustache', price: 120 },
  { id: 'trimmed-beard', slot: 'beard', name: 'Trimmed Beard', price: 150 },
  { id: 'wizard-beard', slot: 'beard', name: 'Wizard Beard', price: 200 },
];

export function findItem(id: string) {
  return ITEMS.find((item) => item.id === id);
}
