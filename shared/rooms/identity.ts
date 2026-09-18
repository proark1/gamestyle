/**
 * Room codes are six characters. New codes are drawn from `ROOM_CODE_ALPHABET`,
 * which leaves out the glyphs players misread when reading a code aloud (I, O, 0
 * and 1). Validation deliberately stays looser than generation, so codes minted
 * before the alphabet narrowed still resolve.
 *
 * Everything that mints, accepts or displays a code goes through this module. The
 * shape used to be written out at every call site, which made the alphabet
 * impossible to change without missing one and turning a valid invite into an
 * intermittent join failure.
 */
export const ROOM_CODE_LENGTH = 6;

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** For an `<input pattern>` attribute, which the browser anchors for us. */
export const ROOM_CODE_PATTERN = '[A-Z2-9]{6}';

const CANONICAL = /^[A-Z2-9]{6}$/;
const ANY_CASE = /^[A-Z2-9]{6}$/i;

/** A code in the canonical upper-case form that is stored and sent on the wire. */
export const isRoomCode = (value: unknown): value is string =>
  typeof value === 'string' && CANONICAL.test(value);

/** Player-supplied input in any case, such as a typed code or an invite link. */
export const looksLikeRoomCode = (value: unknown): value is string =>
  typeof value === 'string' && ANY_CASE.test(value);

/** The canonical form of player-supplied input, or null when it is not a code. */
export function roomCode(value: unknown): string | null {
  return looksLikeRoomCode(value) ? value.toUpperCase() : null;
}

export function newRoomCode(): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH)),
    (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length],
  ).join('');
}

/** Keep the persisted token representation identical across all room adapters. */
export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function playerName(value: unknown, fallback: string) {
  return typeof value === 'string'
    ? value
        .replace(/[\p{C}<>]/gu, '')
        .trim()
        .slice(0, 18) || fallback
    : fallback;
}
