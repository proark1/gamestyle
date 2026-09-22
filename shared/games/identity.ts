/**
 * The one place the collection is enumerated.
 *
 * Every folder under `games/` appears here exactly once, in directory order, and
 * `shared/games/identity.test.ts` fails when the two drift apart. Registries that
 * list games for a purpose — routes, analytics, audio catalogs, the party playlist,
 * the collection cards — are checked against this list by
 * `platform/games/registry.test.ts`, so a new game cannot be half-wired: either it
 * is registered or it is named in one of the exemptions below with a reason.
 *
 * This module holds identity only. It must stay free of imports from `games/`,
 * `platform/` and `app/` so that any layer can read it.
 */
export const GAME_IDS = [
  'act-natural',
  'basketball',
  'bungee-doubles',
  'carry-on-carnage',
  'chain-of-fools',
  'chaos',
  'crane-clash',
  'dont-wake-the-giant',
  'drive-thru',
  'first-person',
  'four-brain-cells',
  'load-bearing',
  'on-the-ropes',
  'one-more-button',
  'panic-curling',
  'reel-problems',
  'reel-problems-2',
  'sample-stampede',
  'scaffold-scramble',
  'shelf-control',
  'siege-and-desist',
  'stack-or-sink',
  'uphill-delivery',
  'wrong-floor',
  'zorb-clash',
] as const;

/** Any game in the collection, including the two Handwerker titles. */
export type Game = (typeof GAME_IDS)[number];

const GAMES = new Set<string>(GAME_IDS);

export const isGame = (value: unknown): value is Game =>
  typeof value === 'string' && GAMES.has(value);

/**
 * Handwerker titles. They sit in the `app/(handwerker)/` route group, build their
 * sounds in the construction workshop, and stay out of the party playlist.
 */
export const HANDWERKER_GAMES = ['chaos', 'first-person'] as const;

export type HandwerkerGame = (typeof HANDWERKER_GAMES)[number];

const HANDWERKER = new Set<string>(HANDWERKER_GAMES);

export const isHandwerkerGame = (value: unknown): value is HandwerkerGame =>
  typeof value === 'string' && HANDWERKER.has(value);

/**
 * Games that play another game's recordings instead of owning an audio catalog.
 * Their sounds are edited in the workshop of the game they borrow from.
 */
export const BORROWED_AUDIO = {
  'shelf-control': 'act-natural',
} as const satisfies Partial<Record<Game, Game>>;

/**
 * Games that do not appear in the party playlist, with the reason. Party rounds
 * need the peer engine and a short round, so a game is excluded when it cannot
 * provide both — not merely because nobody has added it yet.
 */
export const PARTY_EXCLUDED = {
  'reel-problems-2':
    'Experimental copy for style tests; not part of the party rotation',
  chaos: 'Handwerker title with its own long-form session',
  'first-person': 'Handwerker title with its own long-form session',
  'shelf-control': 'server-authoritative rooms, no peer adapter',
} as const satisfies Partial<Record<Game, string>>;

/** The game that owns the workshop editing this game's sounds. */
export function workshopOf(game: Game): Game {
  return game in BORROWED_AUDIO
    ? BORROWED_AUDIO[game as keyof typeof BORROWED_AUDIO]
    : game;
}
