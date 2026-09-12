import type { GameDatabase } from '../../../db/contract';
import { readJsonObject } from '../../http/json-request';
import { RequestBudget, budgetError } from '../../http/request-budget';
import { hasAllowedOrigin } from '../../http/request-origin';
import { playerName } from '../../rooms/identity';
import { RoomError } from '../../rooms/types';
import { SIGNED_IN_HINT } from '../types';
import {
  isSecureOrigin,
  publicOriginFor,
  signInMethods,
  type AccountConfig,
} from './config';
import { cookieName, readCookie, setCookie } from './cookies';
import { randomToken, sameText, sha256, unseal } from './crypto';
import {
  CODE_TTL_MS,
  EMAIL_FLOW_COOKIE,
  confirmCode,
  maskEmail,
  normalizeEmail,
  resendSender,
  sendCode,
  signInWithEmail,
  type SendCode,
} from './email';
import { AccountError } from './errors';
import {
  FLOW_TTL_MS,
  GOOGLE_FLOW_COOKIE,
  beginGoogle,
  checkClaims,
  exchangeCode,
  parseFlow,
  safeReturnPath,
  signInWithGoogle,
  type GoogleClaims,
} from './google';
import {
  RENEW_AFTER_MS,
  SESSION_TTL_MS,
  clearSessionCookies,
  readSession,
  secureRequest,
  sessionCookies,
  startSession,
  summarize,
} from './session';
import {
  deleteAccount,
  deleteAccountSessions,
  deleteSession,
  findAccount,
  purgeAccounts,
  renewSession,
  setDisplayName,
} from './store';

export type AccountRouteDeps = {
  db: () => GameDatabase;
  config: () => AccountConfig;
  now?: () => number;
  fetch?: typeof fetch;
  /** Receives development sign-in codes when email is set to `log`. */
  log?: (line: string) => void;
};

type Landing = 'ok' | 'failed' | 'cancelled' | 'unavailable';

const FLOW_TOKEN = /^[\w-]{43}$/;

function respond(
  status: number,
  body?: unknown,
  cookies: string[] = [],
  location?: string,
) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  for (const value of cookies) headers.append('Set-Cookie', value);
  if (location) headers.set('Location', location);
  if (body === undefined) return new Response(null, { status, headers });
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers });
}

/** Where Google sign-in lands: the popup's relay page, or where the player started. */
function landing(returnTo: string, popup: boolean, result: Landing) {
  if (popup) return `/account/signed-in?result=${result}`;
  const path = returnTo.split('#')[0];
  return result === 'ok' ? path : `${path}#sign-in-${result}`;
}

export function createAccountRoutes(deps: AccountRouteDeps) {
  /** Account traffic has its own admission budget, apart from rooms. */
  const budget = new RequestBudget(32, 4096);
  const clock = deps.now ?? Date.now;
  const fetcher = deps.fetch ?? fetch;
  let purgedAt = 0;

  const guard =
    (work: (request: Request) => Promise<Response>) =>
    async (request: Request) => {
      let release: (() => void) | undefined;
      try {
        release = budget.enter();
        return await work(request);
      } catch (error) {
        if (error instanceof AccountError)
          return respond(error.status, {
            error: error.message,
            ...error.extra,
          });
        if (error instanceof RoomError) return budgetError(error);
        console.error('Account request failed', error);
        return respond(503, {
          error: 'Accounts are unavailable right now. Try again soon.',
        });
      } finally {
        release?.();
      }
    };

  const assertWritable = (request: Request, config: AccountConfig) => {
    if (!hasAllowedOrigin(request, config.publicOrigin))
      throw new AccountError('Open Jumbleyard to change your account.', 403);
  };

  const emailReady = (config: AccountConfig) => {
    if (!config.secret || !config.email)
      throw new AccountError('Email sign-in is not available.', 404);
    return { secret: config.secret, email: config.email };
  };

  const sender = (email: NonNullable<AccountConfig['email']>): SendCode =>
    email === 'log'
      ? async (address, code) =>
          (deps.log ?? console.info)(
            `[accounts] Sign-in code for ${address}: ${code}`,
          )
      : resendSender(email.apiKey, email.from, fetcher);

  const emailFlow = (request: Request, secure: boolean) => {
    const value = readCookie(request, cookieName(EMAIL_FLOW_COOKIE, secure));
    return value && FLOW_TOKEN.test(value) ? value : undefined;
  };

  /** Clears expired sessions and old codes, at most hourly, during sign-ins. */
  const tidy = async (db: GameDatabase, now: number) => {
    if (now - purgedAt < 3_600_000) return;
    purgedAt = now;
    try {
      await purgeAccounts(db, now);
    } catch (error) {
      console.error('Account cleanup failed', error);
    }
  };

  return {
    session: guard(async (request) => {
      const config = deps.config(),
        now = clock();
      budget.take('account:session', 600, 100);
      const methods = signInMethods(config);
      const db = deps.db();
      const session = await readSession(request, { db, config, now });
      if (!session) {
        // A leftover hint would keep browser code asking; clear it.
        const cookies = readCookie(request, SIGNED_IN_HINT)
          ? clearSessionCookies(secureRequest(request, config))
          : [];
        return respond(200, { account: null, methods }, cookies);
      }
      let cookies: string[] = [];
      if (now - session.renewed > RENEW_AFTER_MS) {
        await renewSession(db, session.hash, now, now + SESSION_TTL_MS);
        cookies = sessionCookies(session.token, session.secure);
      }
      const account = await summarize(db, session.account);
      return respond(200, { account, methods }, cookies);
    }),

    googleStart: guard(async (request) => {
      const config = deps.config(),
        now = clock();
      const params = new URL(request.url).searchParams;
      const returnTo = safeReturnPath(params.get('return'));
      const popup = params.get('popup') === '1';
      if (!config.secret || !config.google)
        return respond(
          302,
          undefined,
          [],
          landing(returnTo, popup, 'unavailable'),
        );
      budget.take('account:google', 120, 2);
      const origin = publicOriginFor(request, config.publicOrigin),
        secure = isSecureOrigin(origin);
      const start = await beginGoogle(
        config.google,
        config.secret,
        origin,
        returnTo,
        popup,
        now,
      );
      const flow = setCookie(
        cookieName(GOOGLE_FLOW_COOKIE, secure),
        start.cookie,
        { maxAge: FLOW_TTL_MS / 1000, secure },
      );
      return respond(302, undefined, [flow], start.url);
    }),

    googleCallback: guard(async (request) => {
      const config = deps.config(),
        now = clock();
      const origin = publicOriginFor(request, config.publicOrigin),
        secure = isSecureOrigin(origin);
      const flowCookie = cookieName(GOOGLE_FLOW_COOKIE, secure);
      const cleared = setCookie(flowCookie, '', { maxAge: 0, secure });
      if (!config.secret || !config.google)
        return respond(
          303,
          undefined,
          [cleared],
          landing('/', false, 'unavailable'),
        );
      budget.take('account:google', 120, 2);
      const flow = parseFlow(
        await unseal(config.secret, 'google', readCookie(request, flowCookie)),
        now,
      );
      const finish = (result: Landing) =>
        respond(
          303,
          undefined,
          [cleared],
          landing(flow?.returnTo ?? '/', flow?.popup ?? false, result),
        );
      const params = new URL(request.url).searchParams;
      if (!flow) return finish('failed');
      if (params.get('error')) return finish('cancelled');
      const code = params.get('code') ?? '';
      if (
        !sameText(params.get('state') ?? '', flow.state) ||
        !code ||
        code.length > 2048
      )
        return finish('failed');
      let claims: GoogleClaims | null = null;
      try {
        const token = await exchangeCode(
          config.google,
          origin,
          code,
          flow.verifier,
          fetcher,
        );
        if (token)
          claims = checkClaims(token, config.google.clientId, flow.nonce, now);
      } catch (error) {
        console.error('Google sign-in failed', error);
      }
      if (!claims) return finish('failed');
      const db = deps.db();
      await tidy(db, now);
      const accountId = await signInWithGoogle(db, config.secret, claims, now);
      const cookies = await startSession(request, accountId, {
        db,
        config,
        now,
      });
      return respond(
        303,
        undefined,
        [cleared, ...cookies],
        landing(flow.returnTo, flow.popup, 'ok'),
      );
    }),

    emailStart: guard(async (request) => {
      const config = deps.config(),
        now = clock();
      assertWritable(request, config);
      const { secret, email: delivery } = emailReady(config);
      budget.take('account:email', 30, 0.5);
      const email = normalizeEmail((await readJsonObject(request, 1024)).email);
      if (!email) throw new AccountError('Enter a valid email address.', 400);
      const secure = secureRequest(request, config);
      const flow = emailFlow(request, secure) ?? randomToken();
      const flowHash = await sha256(flow);
      budget.take(`account:email:${flowHash}`, 3, 1 / 60);
      const db = deps.db();
      await tidy(db, now);
      try {
        await sendCode({ db, secret, now }, email, flowHash, sender(delivery));
      } catch (error) {
        if (error instanceof AccountError) throw error;
        console.error('Sign-in email failed', error);
        throw new AccountError(
          "We couldn't send the email. Try again in a moment.",
          503,
        );
      }
      const cookie = setCookie(cookieName(EMAIL_FLOW_COOKIE, secure), flow, {
        maxAge: 30 * 60,
        secure,
      });
      return respond(202, { expiresIn: CODE_TTL_MS / 1000 }, [cookie]);
    }),

    emailVerify: guard(async (request) => {
      const config = deps.config(),
        now = clock();
      assertWritable(request, config);
      const { secret } = emailReady(config);
      const body = await readJsonObject(request, 1024);
      const email = normalizeEmail(body.email);
      const code =
        typeof body.code === 'string' ? body.code.replace(/\s/g, '') : '';
      if (!email || !/^\d{6}$/.test(code))
        throw new AccountError('Enter the 6-digit code from the email.', 400);
      const secure = secureRequest(request, config);
      const flow = emailFlow(request, secure);
      if (!flow)
        throw new AccountError('Ask for a new code in this browser.', 400, {
          remaining: 0,
        });
      const flowHash = await sha256(flow);
      budget.take(`account:verify:${flowHash}`, 10, 1 / 30);
      const db = deps.db();
      const subject = await confirmCode(
        { db, secret, now },
        email,
        code,
        flowHash,
      );
      const accountId = await signInWithEmail(
        db,
        subject,
        maskEmail(email),
        now,
      );
      const cookies = await startSession(request, accountId, {
        db,
        config,
        now,
      });
      const row = await findAccount(db, accountId);
      const account = await summarize(db, {
        id: accountId,
        displayName: row?.display_name ?? null,
      });
      const cleared = setCookie(cookieName(EMAIL_FLOW_COOKIE, secure), '', {
        maxAge: 0,
        secure,
      });
      return respond(200, { account }, [cleared, ...cookies]);
    }),

    profile: guard(async (request) => {
      const config = deps.config(),
        now = clock();
      assertWritable(request, config);
      const db = deps.db();
      const session = await readSession(request, { db, config, now });
      if (!session) throw new AccountError('Sign in first.', 401);
      budget.take(`account:profile:${session.account.id}`, 10, 0.2);
      const body = await readJsonObject(request, 512);
      const displayName = playerName(body.displayName, '') || null;
      await setDisplayName(db, session.account.id, displayName, now);
      const account = await summarize(db, { ...session.account, displayName });
      return respond(200, { account });
    }),

    signOut: guard(async (request) => {
      const config = deps.config(),
        now = clock();
      assertWritable(request, config);
      const body = await readJsonObject(request, 256);
      const db = deps.db();
      const session = await readSession(request, { db, config, now });
      if (session && body.everywhere === true)
        await deleteAccountSessions(db, session.account.id);
      else if (session) await deleteSession(db, session.hash);
      return respond(
        204,
        undefined,
        clearSessionCookies(secureRequest(request, config)),
      );
    }),

    remove: guard(async (request) => {
      const config = deps.config(),
        now = clock();
      assertWritable(request, config);
      const body = await readJsonObject(request, 256);
      if (body.confirm !== 'delete')
        throw new AccountError('Type delete to confirm.', 400);
      const db = deps.db();
      const session = await readSession(request, { db, config, now });
      if (!session) throw new AccountError('Sign in first.', 401);
      await deleteAccount(db, session.account.id);
      return respond(204, undefined, clearSessionCookies(session.secure));
    }),
  };
}
