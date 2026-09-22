import { isRoomCode, roomCode } from './identity';
import { inPartyMode } from '../ui/party-mode';

export type Session = {
  peer?: true;
  verified?: true;
  ranked?: true;
  code: string;
  id: string;
  token: string;
};

/** A session that reconnects through the peer mesh rather than a room endpoint. */
export type PeerSession = Session & { peer: true };

/**
 * A stored session is usable only when every field survived the round trip.
 * Storage can return anything — a half-written value, a session from an older
 * build, or a hand-edited one — so a restore validates before trusting it.
 *
 * Solo practice sessions carry no token and a code that is not a room code, so
 * they never pass here; a game clears storage when it drops into practice.
 */
export function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<Session>;
  return (
    isRoomCode(session.code) &&
    typeof session.id === 'string' &&
    session.id.length > 0 &&
    typeof session.token === 'string' &&
    session.token.length > 0
  );
}

export const isPeerSession = (value: unknown): value is PeerSession =>
  isSession(value) && (value as Session).peer === true;

/**
 * Per-tab storage for the session a reload should rejoin.
 *
 * Every game used to inline the same read-parse-validate-attach dance and the
 * same swallowed write, once per game, with the validation spelled out slightly
 * differently each time. The key stays per-game and unchanged, because it names
 * sessions that live players are holding.
 *
 * Party rounds restore their authenticated shared seat, isolated from saved
 * standalone rooms. The party page issues the seat before mounting the game.
 */
export function sessionStore(key: string) {
  const read = (): unknown => {
    if (inPartyMode()) {
      try {
        const params = new URLSearchParams(location.search);
        const saved = JSON.parse(
          sessionStorage.getItem('jumbleyard:party-game') ?? 'null',
        );
        const game = location.pathname.split('/').filter(Boolean)[0];
        if (
          saved?.party === params.get('party') &&
          saved?.round === Number(params.get('round')) &&
          saved?.session?.game === game
        )
          return saved.session;
      } catch {
        /* No authenticated party seat. */
      }
      return null;
    }
    try {
      return JSON.parse(sessionStorage.getItem(key) ?? 'null');
    } catch {
      // No storage in a private window, or a value that is not JSON.
      return null;
    }
  };
  return {
    key,
    /** The saved session, or null when there is nothing usable to rejoin. */
    load(): Session | null {
      const saved = read();
      return isSession(saved) ? saved : null;
    },
    /** The saved session when it reconnects over the peer mesh. */
    loadPeer(): PeerSession | null {
      const saved = read();
      return isPeerSession(saved) ? saved : null;
    },
    save(session: Session): void {
      try {
        sessionStorage.setItem(key, JSON.stringify(session));
      } catch {
        // Playing without storage costs only the rejoin on reload.
      }
    },
    clear(): void {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Nothing was stored, so nothing needs clearing.
      }
    },
  };
}

export type SessionStore = ReturnType<typeof sessionStore>;

/**
 * The room code from an invite link, in canonical form. Games read `?room=` from
 * their own URL, so an invite always wins over whatever the tab last rejoined.
 */
export function inviteCode(
  search: string = typeof location === 'undefined' ? '' : location.search,
): string | null {
  try {
    return roomCode(new URLSearchParams(search).get('room'));
  } catch {
    return null;
  }
}
