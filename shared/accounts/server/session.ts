import type { GameDatabase } from '../../../db/contract';
import { SIGNED_IN_HINT, type AccountSummary } from '../types';
import { isSecureOrigin, publicOriginFor, type AccountConfig } from './config';
import { cookieName, readCookie, setCookie } from './cookies';
import { randomToken, sha256 } from './crypto';
import { accountIdentities, findSession, insertSession } from './store';

const DAY = 86_400_000;
export const SESSION_COOKIE = 'jy_session';
export const SESSION_TTL_MS = 60 * DAY;
/** Renewing at most daily keeps ordinary page loads from writing. */
export const RENEW_AFTER_MS = DAY;

export type SignedInAccount = { id: string; displayName: string | null };
export type AccountContext = {
  db: GameDatabase;
  config: AccountConfig;
  now: number;
};

export const secureRequest = (request: Request, config: AccountConfig) =>
  isSecureOrigin(publicOriginFor(request, config.publicOrigin));

/** The valid session a request carries, if any. Never writes. */
export async function readSession(
  request: Request,
  { db, config, now }: AccountContext,
) {
  const secure = secureRequest(request, config);
  const token = readCookie(request, cookieName(SESSION_COOKIE, secure));
  if (!token || !/^[\w-]{43}$/.test(token)) return null;
  const hash = await sha256(token);
  const row = await findSession(db, hash, now);
  if (!row) return null;
  const account: SignedInAccount = {
    id: row.account_id,
    displayName: row.display_name,
  };
  return { token, hash, secure, renewed: row.renewed, account };
}

export function sessionCookies(token: string, secure: boolean) {
  const maxAge = SESSION_TTL_MS / 1000;
  return [
    setCookie(cookieName(SESSION_COOKIE, secure), token, { maxAge, secure }),
    setCookie(SIGNED_IN_HINT, '1', { maxAge, secure, httpOnly: false }),
  ];
}

export function clearSessionCookies(secure: boolean) {
  return [
    setCookie(cookieName(SESSION_COOKIE, secure), '', { maxAge: 0, secure }),
    setCookie(SIGNED_IN_HINT, '', { maxAge: 0, secure, httpOnly: false }),
  ];
}

/** Starts a session and returns the cookies that carry it. */
export async function startSession(
  request: Request,
  accountId: string,
  { db, config, now }: AccountContext,
) {
  const token = randomToken();
  await insertSession(
    db,
    await sha256(token),
    accountId,
    now,
    now + SESSION_TTL_MS,
  );
  return sessionCookies(token, secureRequest(request, config));
}

export async function summarize(
  db: GameDatabase,
  account: SignedInAccount,
): Promise<AccountSummary> {
  const { results } = await accountIdentities(db, account.id);
  return {
    displayName: account.displayName,
    identities: results.map((row) => ({
      provider: row.provider,
      hint: row.email_hint,
    })),
  };
}
