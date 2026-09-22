import { looksLikeRoomCode } from '../rooms/identity';

/**
 * Whether this page is playing a party-tournament round.
 *
 * Detected the way the party ribbon does: a `?party=` room code in the URL, or
 * the `jumbleyard-party-mode` class the ribbon puts on `<body>`. The ribbon
 * identifies the shared round while the peer adapter configures party rules
 * so idle matches still end on their own. Normal play never sees them.
 */
export function inPartyMode(
  search: string = typeof location === 'undefined' ? '' : location.search,
  body: {
    classList: { contains(token: string): boolean };
  } | null = typeof document === 'undefined' ? null : document.body,
): boolean {
  if (body?.classList.contains('jumbleyard-party-mode')) return true;
  try {
    return looksLikeRoomCode(new URLSearchParams(search).get('party'));
  } catch {
    return false;
  }
}

/**
 * How long a party round may run in a game that has no clock of its own: long
 * enough for a proper go, short enough that the tournament moves on.
 */
export const PARTY_TIME_LIMIT_MS = 4 * 60_000;
