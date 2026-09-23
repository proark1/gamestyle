import { isGame } from '../games/identity';

/** Web launch prices in USD cents. */
export const COMMERCE_PRICES = {
  fullGame: 499,
  standard: 99,
  special: 199,
  bundle: 499,
} as const;

/** Provisional launch selection; keep existing live access unchanged until launch. */
export const FREE_GAME_IDS = [
  'stack-or-sink',
  'crane-clash',
  'basketball',
] as const;

export const FULL_GAME_ENTITLEMENT = 'entitlement:full-game';

export type CommerceOffer = {
  id: string;
  name: string;
  grants: readonly string[];
  usdCents: number;
};

export const COMMERCE_OFFERS: readonly CommerceOffer[] = [
  {
    id: 'full-game',
    name: 'Full game pass',
    grants: [FULL_GAME_ENTITLEMENT],
    usdCents: COMMERCE_PRICES.fullGame,
  },
  {
    id: 'neon-visor',
    name: 'Neon Visor',
    grants: ['neon-visor'],
    usdCents: COMMERCE_PRICES.standard,
  },
  {
    id: 'confetti-shades',
    name: 'Confetti Shades',
    grants: ['confetti-shades'],
    usdCents: COMMERCE_PRICES.standard,
  },
  {
    id: 'comet-cape',
    name: 'Comet Cape',
    grants: ['comet-cape'],
    usdCents: COMMERCE_PRICES.special,
  },
  {
    id: 'disco-boots',
    name: 'Disco Boots',
    grants: ['disco-boots'],
    usdCents: COMMERCE_PRICES.special,
  },
  {
    id: 'party-style-bundle',
    name: 'Party Style Bundle',
    grants: ['neon-visor', 'confetti-shades', 'comet-cape', 'disco-boots'],
    usdCents: COMMERCE_PRICES.bundle,
  },
];

export function hasGameAccess(game: string, fullGame: boolean): boolean {
  return isGame(game) && (fullGame || FREE_GAME_IDS.some((id) => id === game));
}

/** A host's license never substitutes for a guest's license. */
export function partyCanPlay(game: string, owners: readonly boolean[]) {
  return (
    owners.length > 0 && owners.every((owned) => hasGameAccess(game, owned))
  );
}
