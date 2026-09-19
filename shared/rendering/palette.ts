/** Player colours, in join order: amber, teal, coral and plum. */
export const COLORS = ['#eaa43c', '#679e99', '#d97863', '#8b81af'];

/** Every team game plays red against blue, in these two colours. */
export const TEAM = { red: '#c8553d', blue: '#4d7ab0' } as const;

/**
 * The kids' kits: the two team colours and two more, so that in a game
 * where everyone plays for themselves each of the four seats wears its own.
 */
export const KIT = { ...TEAM, green: '#5a9a55', yellow: '#e2b43c' } as const;

/** The kit of each seat in a game without teams, in join order. */
export const SEAT_KITS: readonly string[] = [
  KIT.red,
  KIT.blue,
  KIT.green,
  KIT.yellow,
];

/** The kit a player wears in a game without teams: no two seats match. */
export function seatKit(seat: number) {
  return SEAT_KITS[((seat % 4) + 4) % 4];
}

/**
 * The clothes every costume is made from. A game may dress the worker in a
 * whole outfit, but its shirt, trousers, shoes and hat take their colours
 * from the player colours, the team colours or this list, so every game looks
 * like the same collection.
 */
export const CLOTH = {
  /** The worker's own overalls. */
  teal: '#385d63',
  slate: '#44525a',
  navy: '#354350',
  denim: '#4a6283',
  /** The worker's own boots. */
  charcoal: '#4c4840',
  ink: '#2e3632',
  brown: '#73543d',
  leather: '#91623f',
  tan: '#c9ad79',
  sand: '#f2d49b',
  cream: '#f4ead2',
  white: '#f7f2e8',
  gold: '#ebc35f',
  hivis: '#e58e38',
  /** Foil and steel, for silly states such as Carry-On Carnage's tin foil. */
  silver: '#aab3b6',
} as const;

/** Every colour a costume may use: players, kits and cloth. */
export const WARDROBE_COLOURS: readonly string[] = [
  ...COLORS,
  ...Object.values(KIT),
  ...Object.values(CLOTH),
];
