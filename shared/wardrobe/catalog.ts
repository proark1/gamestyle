/**
 * The wardrobe: every item a player can wear on the shared worker, and the
 * goals that unlock the few that cannot be bought. Data only, so the server
 * and the browser can both import it. Item ids are never reused.
 */
export const SLOTS = ['hat', 'top', 'legs', 'shoes', 'face'] as const;
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
    id: 'five-games',
    label: 'Play 5 different games',
    measure: 'games',
    target: 5,
  },
  { id: 'ten-hours', label: 'Play for 10 hours', measure: 'hours', target: 10 },
  { id: 'every-game', label: 'Play every game', measure: 'every-game' },
  {
    id: 'fifty-hours',
    label: 'Play for 50 hours',
    measure: 'hours',
    target: 50,
  },
];

export const ITEMS: readonly Item[] = [
  { id: 'bobble-beanie', slot: 'hat', name: 'Bobble Beanie', price: 80 },
  { id: 'party-cone', slot: 'hat', name: 'Party Cone', price: 150 },
  { id: 'top-hat', slot: 'hat', name: 'Top Hat', price: 250 },
  { id: 'viking-helmet', slot: 'hat', name: 'Viking Helmet', price: 350 },
  {
    id: 'champion-hard-hat',
    slot: 'hat',
    name: 'Champion Hard Hat',
    goal: 'every-game',
  },
  { id: 'striped-tee', slot: 'top', name: 'Striped Tee', price: 60 },
  { id: 'bow-tie', slot: 'top', name: 'Collar and Bow Tie', price: 120 },
  { id: 'hero-cape', slot: 'top', name: 'Hero Cape', price: 300 },
  { id: 'badge-sash', slot: 'top', name: 'Badge Sash', goal: 'five-games' },
  { id: 'denim-overalls', slot: 'legs', name: 'Denim Overalls', price: 80 },
  { id: 'cargo-trousers', slot: 'legs', name: 'Cargo Trousers', price: 120 },
  { id: 'plaid-trousers', slot: 'legs', name: 'Plaid Trousers', price: 200 },
  { id: 'rain-boots', slot: 'shoes', name: 'Rain Boots', price: 60 },
  { id: 'high-tops', slot: 'shoes', name: 'High-Tops', price: 100 },
  { id: 'clown-shoes', slot: 'shoes', name: 'Clown Shoes', price: 250 },
  {
    id: 'rocket-boots',
    slot: 'shoes',
    name: 'Rocket Boots',
    goal: 'fifty-hours',
  },
  { id: 'round-glasses', slot: 'face', name: 'Round Glasses', price: 60 },
  { id: 'big-moustache', slot: 'face', name: 'Big Moustache', price: 120 },
  { id: 'snorkel-mask', slot: 'face', name: 'Snorkel Mask', price: 200 },
  { id: 'star-shades', slot: 'face', name: 'Star Shades', goal: 'ten-hours' },
];

export function findItem(id: string) {
  return ITEMS.find((item) => item.id === id);
}
