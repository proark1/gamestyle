import { isGame } from '../games/identity';

/** US reference prices in cents. Checkout uses the storefront's localized price. */
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
  grants: readonly string[];
  usdCents: number;
};

/** Premium cosmetics enter this catalog only when their actual assets are ready. */
export const COMMERCE_OFFERS: readonly CommerceOffer[] = [
  {
    id: 'full-game',
    grants: [FULL_GAME_ENTITLEMENT],
    usdCents: COMMERCE_PRICES.fullGame,
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
