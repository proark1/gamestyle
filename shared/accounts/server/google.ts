import type { GameDatabase } from '../../../db/contract';
import {
  fromBase64url,
  pkceChallenge,
  randomToken,
  sameText,
  seal,
} from './crypto';
import { emailSubject, maskEmail, normalizeEmail } from './email';
import {
  createAccount,
  findIdentity,
  linkIdentity,
  touchIdentity,
  type Identity,
} from './store';

export const GOOGLE_FLOW_COOKIE = 'jy_google_flow';
export const FLOW_TTL_MS = 10 * 60_000;
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const CLOCK_SKEW_MS = 60_000;

export type GoogleClient = { clientId: string; clientSecret: string };
export type GoogleFlow = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  popup: boolean;
  expires: number;
};
export type GoogleClaims = {
  sub: string;
  email?: string;
  emailVerified: boolean;
  hd?: string;
};

export const callbackUrl = (origin: string) =>
  `${origin}/api/account/google/callback`;

/** A path on this site only: no scheme, no `//host`, no backslash or control character. */
export function safeReturnPath(value: unknown) {
  return typeof value === 'string' &&
    value.length <= 512 &&
    /^\/(?!\/)[^\\\p{Cc}]*$/u.test(value)
    ? value
    : '/';
}

export async function beginGoogle(
  client: GoogleClient,
  secret: string,
  origin: string,
  returnTo: string,
  popup: boolean,
  now: number,
) {
  const flow: GoogleFlow = {
    state: randomToken(),
    nonce: randomToken(),
    verifier: randomToken(),
    returnTo,
    popup,
    expires: now + FLOW_TTL_MS,
  };
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: callbackUrl(origin),
    response_type: 'code',
    scope: 'openid email',
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: await pkceChallenge(flow.verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return { url: url.toString(), cookie: await seal(secret, 'google', flow) };
}

export function parseFlow(value: Record<string, unknown> | null, now: number) {
  if (
    !value ||
    typeof value.state !== 'string' ||
    typeof value.nonce !== 'string' ||
    typeof value.verifier !== 'string' ||
    typeof value.returnTo !== 'string' ||
    typeof value.popup !== 'boolean' ||
    typeof value.expires !== 'number' ||
    value.expires <= now
  )
    return null;
  return value as GoogleFlow;
}

/**
 * The ID token's claims. The token comes straight from Google's token endpoint
 * over TLS, so its signature needs no separate check (OpenID Connect Core
 * 3.1.3.7). A token handed over by a browser must never reach this function.
 */
export function tokenClaims(idToken: unknown) {
  if (typeof idToken !== 'string') return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const claims: unknown = JSON.parse(
      new TextDecoder().decode(fromBase64url(parts[1])),
    );
    return claims && typeof claims === 'object'
      ? (claims as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function checkClaims(
  claims: Record<string, unknown>,
  clientId: string,
  nonce: string,
  now: number,
): GoogleClaims | null {
  const { aud, azp, exp, iat, iss, sub } = claims;
  if (typeof iss !== 'string' || !ISSUERS.includes(iss)) return null;
  if (!(aud === clientId || (Array.isArray(aud) && aud.includes(clientId))))
    return null;
  if (azp !== undefined && azp !== clientId) return null;
  if (typeof exp !== 'number' || exp * 1000 < now - CLOCK_SKEW_MS) return null;
  if (typeof iat !== 'number' || iat * 1000 > now + CLOCK_SKEW_MS) return null;
  if (typeof claims.nonce !== 'string' || !sameText(claims.nonce, nonce))
    return null;
  if (typeof sub !== 'string' || !sub || sub.length > 255) return null;
  return {
    sub,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    emailVerified: claims.email_verified === true,
    hd: typeof claims.hd === 'string' ? claims.hd : undefined,
  };
}

/** Trades the authorization code for the ID token's claims. */
export async function exchangeCode(
  client: GoogleClient,
  origin: string,
  code: string,
  verifier: string,
  fetcher: typeof fetch,
) {
  const response = await fetcher(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: callbackUrl(origin),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { id_token?: unknown } | null;
  return tokenClaims(body?.id_token);
}

/** Google speaks for an address only when it hosts it: Gmail, or the Workspace domain. */
export function googleOwnsEmail({ email, emailVerified, hd }: GoogleClaims) {
  if (!email || !emailVerified) return false;
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  return domain === 'gmail.com' || (!!hd && domain === hd.toLowerCase());
}

/**
 * Signs in to the account that holds this Google identity. A new Google
 * identity joins the account with the same email address only when Google
 * hosts that address; otherwise it gets its own account. Existing accounts
 * are never merged.
 */
export async function signInWithGoogle(
  db: GameDatabase,
  secret: string,
  claims: GoogleClaims,
  now: number,
) {
  const email = normalizeEmail(claims.email);
  const google: Identity = {
    provider: 'google',
    subject: claims.sub,
    hint: email ? maskEmail(email) : 'Google account',
  };
  const existing = await findIdentity(db, 'google', claims.sub);
  if (existing) {
    await touchIdentity(db, google, now);
    return existing.account_id;
  }
  if (!email || !googleOwnsEmail(claims))
    return createAccount(db, [google], now);
  const byEmail: Identity = {
    provider: 'email',
    subject: await emailSubject(secret, email),
    hint: google.hint,
  };
  const owner = await findIdentity(db, 'email', byEmail.subject);
  if (!owner) return createAccount(db, [google, byEmail], now);
  await linkIdentity(db, owner.account_id, google, now);
  return owner.account_id;
}
