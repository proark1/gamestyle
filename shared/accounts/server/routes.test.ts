import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateSqlite, openSqlite } from '../../../db/sqlite.mjs';
import { sqliteAdapter } from '../../../db/node';
import type { AccountConfig } from './config';
import { base64url } from './crypto';
import { createAccountRoutes } from './routes';

const ORIGIN = 'https://www.jumbleyard.com';
const START = Date.UTC(2026, 8, 12, 12);
const DAY = 86_400_000;
const TABLES = [
  'accounts',
  'account_identities',
  'account_sessions',
  'account_email_codes',
];
const encode = (value: unknown) =>
  base64url(new TextEncoder().encode(JSON.stringify(value)));

type Route = (request: Request) => Promise<Response>;
type Send = { body?: unknown; origin?: string | null; cookies?: string };

/** The routes over an in-memory database, and a browser that keeps cookies. */
function harness(
  configure: (config: AccountConfig) => AccountConfig = (config) => config,
  origin = ORIGIN,
) {
  const native = openSqlite(':memory:');
  migrateSqlite(native);
  const db = sqliteAdapter(native);
  const codes: string[] = [];
  const logged: string[] = [];
  const clock = { now: START };
  let idToken: Record<string, unknown> = {};
  const config = configure({
    secret: 'a-test-secret-that-is-long-enough-000',
    google: { clientId: 'client-1', clientSecret: 'client-secret' },
    email: 'log',
    publicOrigin: ORIGIN,
  });
  const routes = createAccountRoutes({
    db: () => db,
    config: () => config,
    now: () => clock.now,
    log: (line) => {
      logged.push(line);
      codes.push(line.slice(-6));
    },
    fetch: async () =>
      Response.json({
        id_token: `${encode({ alg: 'RS256' })}.${encode(idToken)}.signature`,
      }),
  });
  const jar = new Map<string, string>();
  const request = (path: string, method = 'GET', send: Send = {}) => {
    const headers = new Headers({ host: new URL(origin).host });
    const cookies =
      send.cookies ??
      [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
    if (cookies) headers.set('cookie', cookies);
    if (method === 'POST' && send.origin !== null)
      headers.set('origin', send.origin ?? origin);
    const init: RequestInit = { method, headers };
    if (send.body !== undefined) {
      headers.set('content-type', 'application/json');
      init.body = JSON.stringify(send.body);
    }
    return new Request(`http://internal:8080${path}`, init);
  };
  const keep = (response: Response) => {
    for (const line of response.headers.getSetCookie()) {
      const pair = line.split(';')[0];
      const name = pair.slice(0, pair.indexOf('='));
      if (line.includes('Max-Age=0')) jar.delete(name);
      else jar.set(name, pair.slice(pair.indexOf('=') + 1));
    }
    return response;
  };
  const get = async (route: Route, path: string, send: Send = {}) =>
    keep(await route(request(path, 'GET', send)));
  const post = async (
    route: Route,
    path: string,
    body: unknown,
    send: Send = {},
  ) => keep(await route(request(path, 'POST', { ...send, body })));
  const account = async (cookies?: string) =>
    (
      (await (
        await routes.session(
          request('/api/account/session', 'GET', { cookies }),
        )
      ).json()) as { account: { identities: { provider: string }[] } | null }
    ).account;
  const signInByEmail = async (email = 'player@example.com') => {
    const started = await post(routes.emailStart, '/api/account/email/start', {
      email,
    });
    assert.equal(started.status, 202);
    const verified = await post(
      routes.emailVerify,
      '/api/account/email/verify',
      {
        email,
        code: codes.at(-1),
      },
    );
    assert.equal(verified.status, 200);
    return verified;
  };
  const count = (table: string) =>
    (
      native.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
        count: number;
      }
    ).count;
  return {
    routes,
    native,
    clock,
    codes,
    logged,
    jar,
    request,
    get,
    post,
    account,
    signInByEmail,
    count,
    setIdToken: (claims: Record<string, unknown>) => {
      idToken = claims;
    },
    close: () => native.close(),
  };
}

void test('guests get no account, no cookies and no database rows', async () => {
  const h = harness();
  try {
    const response = await h.get(h.routes.session, '/api/account/session');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      account: null,
      methods: { google: true, email: true },
    });
    assert.deepEqual(response.headers.getSetCookie(), []);
    for (const table of TABLES) assert.equal(h.count(table), 0, table);
  } finally {
    h.close();
  }
});

void test('email sign-in sets a secure session and stores neither the token nor the address', async () => {
  const h = harness();
  try {
    const started = await h.post(
      h.routes.emailStart,
      '/api/account/email/start',
      { email: ' Player@Example.com ' },
    );
    assert.equal(started.status, 202);
    assert.match(
      started.headers.getSetCookie()[0],
      /^__Host-jy_email_flow=[\w-]{43}; Path=\/; Max-Age=1800; SameSite=Lax; HttpOnly; Secure$/,
    );
    const wrong = h.codes[0] === '000000' ? '111111' : '000000';
    const miss = await h.post(
      h.routes.emailVerify,
      '/api/account/email/verify',
      {
        email: 'player@example.com',
        code: wrong,
      },
    );
    assert.equal(miss.status, 400);
    assert.equal(((await miss.json()) as { remaining: number }).remaining, 4);
    const verified = await h.post(
      h.routes.emailVerify,
      '/api/account/email/verify',
      { email: 'player@example.com', code: h.codes[0] },
    );
    assert.equal(verified.status, 200);
    assert.deepEqual(await verified.json(), {
      account: {
        displayName: null,
        identities: [{ provider: 'email', hint: 'p•••@example.com' }],
      },
    });
    const cookies = verified.headers.getSetCookie();
    assert.ok(
      cookies.some((line) =>
        /^__Host-jy_session=[\w-]{43}; Path=\/; Max-Age=5184000; SameSite=Lax; HttpOnly; Secure$/.test(
          line,
        ),
      ),
    );
    assert.ok(
      cookies.includes(
        'jy_signed_in=1; Path=/; Max-Age=5184000; SameSite=Lax; Secure',
      ),
    );
    assert.equal(h.jar.has('__Host-jy_email_flow'), false);
    assert.ok(await h.account());
    const token = h.jar.get('__Host-jy_session')!;
    const stored = JSON.stringify(
      TABLES.map((table) => h.native.prepare(`SELECT * FROM ${table}`).all()),
    ).toLowerCase();
    assert.ok(!stored.includes(token.toLowerCase()));
    assert.ok(!stored.includes('player@example.com'));
  } finally {
    h.close();
  }
});

void test('a code only ever goes to the lowercased address it signs in to', async () => {
  const h = harness();
  try {
    await h.signInByEmail('player@example.com');
    h.jar.clear();
    await h.signInByEmail('Player@Example.COM');
    // The code for a differently cased address still goes to the lowercased
    // mailbox, so only whoever reads that mailbox can sign in to its account.
    assert.equal(
      h.logged.at(-1),
      `[accounts] Sign-in code for player@example.com: ${h.codes.at(-1)}`,
    );
    assert.equal(h.count('accounts'), 1);
  } finally {
    h.close();
  }
});

void test('every write needs an allowed Origin before the database is touched', async () => {
  let touched = false;
  const routes = createAccountRoutes({
    db: () => {
      touched = true;
      throw new Error('The database was touched.');
    },
    config: () => ({
      secret: 'a-test-secret-that-is-long-enough-000',
      email: 'log',
      publicOrigin: ORIGIN,
    }),
  });
  const writes: [Route, string][] = [
    [routes.emailStart, 'email/start'],
    [routes.emailVerify, 'email/verify'],
    [routes.profile, 'profile'],
    [routes.signOut, 'sign-out'],
    [routes.remove, 'delete'],
  ];
  for (const [route, path] of writes)
    for (const origin of [
      undefined,
      'https://evil.example',
      'http://www.jumbleyard.com',
    ]) {
      const headers = new Headers({ 'content-type': 'application/json' });
      if (origin) headers.set('origin', origin);
      const response = await route(
        new Request(`http://internal:8080/api/account/${path}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ email: 'player@example.com' }),
        }),
      );
      assert.equal(response.status, 403, `${path} from ${origin}`);
    }
  assert.equal(touched, false);
});

void test('an oversized request is refused', async () => {
  const h = harness();
  try {
    const response = await h.post(
      h.routes.emailStart,
      '/api/account/email/start',
      { email: `${'a'.repeat(2000)}@example.com` },
    );
    assert.equal(response.status, 413);
  } finally {
    h.close();
  }
});

void test('sessions renew at most once a day and end after sixty idle days', async () => {
  const h = harness();
  try {
    await h.signInByEmail();
    h.clock.now += DAY / 2;
    const early = await h.get(h.routes.session, '/api/account/session');
    assert.deepEqual(early.headers.getSetCookie(), []);
    h.clock.now += DAY;
    const renewed = await h.get(h.routes.session, '/api/account/session');
    assert.equal(renewed.headers.getSetCookie().length, 2);
    h.clock.now += 59 * DAY;
    assert.ok(await h.account());
    h.clock.now += 61 * DAY;
    const expired = await h.get(h.routes.session, '/api/account/session');
    assert.equal(((await expired.json()) as { account: null }).account, null);
    assert.ok(
      expired.headers
        .getSetCookie()
        .some((line) => line.startsWith('jy_signed_in=;')),
    );
  } finally {
    h.close();
  }
});

void test('signing out ends this session, or every session of the account', async () => {
  const h = harness();
  try {
    const sessionCookie = () =>
      `__Host-jy_session=${h.jar.get('__Host-jy_session')}`;
    await h.signInByEmail();
    const first = sessionCookie();
    h.jar.clear();
    await h.signInByEmail();
    const second = sessionCookie();
    const out = await h.post(
      h.routes.signOut,
      '/api/account/sign-out',
      {},
      {
        cookies: first,
      },
    );
    assert.equal(out.status, 204);
    assert.equal(await h.account(first), null);
    assert.ok(await h.account(second));
    h.jar.clear();
    await h.signInByEmail();
    const third = sessionCookie();
    await h.post(
      h.routes.signOut,
      '/api/account/sign-out',
      { everywhere: true },
      { cookies: third },
    );
    assert.equal(await h.account(second), null);
    assert.equal(await h.account(third), null);
  } finally {
    h.close();
  }
});

void test('a display name is cleaned before it is saved', async () => {
  const h = harness();
  try {
    const guest = await h.post(h.routes.profile, '/api/account/profile', {
      displayName: 'Ada',
    });
    assert.equal(guest.status, 401);
    await h.signInByEmail();
    const saved = await h.post(h.routes.profile, '/api/account/profile', {
      displayName: '  <Ada>\u0007 Lovelace the Great ',
    });
    assert.equal(
      ((await saved.json()) as { account: { displayName: string } }).account
        .displayName,
      'Ada Lovelace the G',
    );
  } finally {
    h.close();
  }
});

void test('deleting an account removes its identities, sessions and codes', async () => {
  const h = harness();
  try {
    await h.signInByEmail();
    const cookies = `__Host-jy_session=${h.jar.get('__Host-jy_session')}`;
    const unconfirmed = await h.post(h.routes.remove, '/api/account/delete', {
      confirm: 'yes',
    });
    assert.equal(unconfirmed.status, 400);
    const deleted = await h.post(h.routes.remove, '/api/account/delete', {
      confirm: 'delete',
    });
    assert.equal(deleted.status, 204);
    for (const table of TABLES) assert.equal(h.count(table), 0, table);
    const again = await h.post(
      h.routes.remove,
      '/api/account/delete',
      { confirm: 'delete' },
      { cookies },
    );
    assert.equal(again.status, 401);
  } finally {
    h.close();
  }
});

void test('Google sign-in checks the signed flow and lands where the player started', async () => {
  const h = harness();
  try {
    const start = await h.get(
      h.routes.googleStart,
      '/api/account/google/start?return=%2Fchaos%3Fraum%3DABCDEF',
    );
    assert.equal(start.status, 302);
    const google = new URL(start.headers.get('location')!);
    assert.equal(
      google.searchParams.get('redirect_uri'),
      `${ORIGIN}/api/account/google/callback`,
    );
    assert.ok(h.jar.has('__Host-jy_google_flow'));
    h.setIdToken({
      iss: 'https://accounts.google.com',
      aud: 'client-1',
      sub: 'google-1',
      email: 'player@gmail.com',
      email_verified: true,
      nonce: google.searchParams.get('nonce'),
      iat: START / 1000,
      exp: START / 1000 + 3600,
    });
    const state = google.searchParams.get('state')!;
    const forged = await h.routes.googleCallback(
      h.request('/api/account/google/callback?code=abc&state=forged'),
    );
    assert.equal(forged.status, 303);
    assert.equal(
      forged.headers.get('location'),
      '/chaos?raum=ABCDEF#sign-in-failed',
    );
    assert.ok(
      !forged.headers
        .getSetCookie()
        .some((line) => line.includes('jy_session=')),
    );
    const callback = await h.get(
      h.routes.googleCallback,
      `/api/account/google/callback?code=abc&state=${state}`,
    );
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get('location'), '/chaos?raum=ABCDEF');
    assert.equal(h.jar.has('__Host-jy_google_flow'), false);
    const account = await h.account();
    assert.deepEqual(
      account?.identities.map((identity) => identity.provider).sort(),
      ['email', 'google'],
    );
    const replay = await h.get(
      h.routes.googleCallback,
      `/api/account/google/callback?code=abc&state=${state}`,
    );
    assert.equal(replay.headers.get('location'), '/#sign-in-failed');
  } finally {
    h.close();
  }
});

void test('a popup sign-in lands on the relay page, cancelled or failed', async () => {
  const h = harness();
  try {
    const start = await h.get(
      h.routes.googleStart,
      '/api/account/google/start?return=%2F&popup=1',
    );
    const google = new URL(start.headers.get('location')!);
    const state = google.searchParams.get('state')!;
    const cancelled = await h.routes.googleCallback(
      h.request(
        `/api/account/google/callback?error=access_denied&state=${state}`,
      ),
    );
    assert.equal(
      cancelled.headers.get('location'),
      '/account/signed-in?result=cancelled',
    );
    h.setIdToken({ iss: 'https://evil.example', aud: 'client-1', sub: 'x' });
    const failed = await h.routes.googleCallback(
      h.request(`/api/account/google/callback?code=abc&state=${state}`),
    );
    assert.equal(
      failed.headers.get('location'),
      '/account/signed-in?result=failed',
    );
  } finally {
    h.close();
  }
});

void test('a forged answer cannot end a Google sign-in in progress', async () => {
  const h = harness();
  try {
    const start = await h.get(
      h.routes.googleStart,
      '/api/account/google/start?return=%2Fchaos',
    );
    const google = new URL(start.headers.get('location')!);
    for (const query of [
      'error=access_denied',
      'error=access_denied&state=forged',
      'code=abc&state=forged',
    ]) {
      const forged = await h.routes.googleCallback(
        h.request(`/api/account/google/callback?${query}`),
      );
      assert.equal(
        forged.headers.get('location'),
        '/chaos#sign-in-failed',
        query,
      );
      assert.deepEqual(
        forged.headers.getSetCookie(),
        [],
        `${query} leaves the sign-in in progress alone`,
      );
    }
    h.setIdToken({
      iss: 'https://accounts.google.com',
      aud: 'client-1',
      sub: 'google-2',
      email: 'second@gmail.com',
      email_verified: true,
      nonce: google.searchParams.get('nonce'),
      iat: START / 1000,
      exp: START / 1000 + 3600,
    });
    const state = google.searchParams.get('state')!;
    const real = await h.get(
      h.routes.googleCallback,
      `/api/account/google/callback?code=abc&state=${state}`,
    );
    assert.equal(real.headers.get('location'), '/chaos');
    assert.ok(await h.account());
  } finally {
    h.close();
  }
});

void test('without configuration every sign-in method stays off', async () => {
  const h = harness(() => ({ publicOrigin: ORIGIN }));
  try {
    const session = await h.get(h.routes.session, '/api/account/session');
    assert.deepEqual(((await session.json()) as { methods: unknown }).methods, {
      google: false,
      email: false,
    });
    const start = await h.get(
      h.routes.googleStart,
      '/api/account/google/start?return=%2Fchaos',
    );
    assert.equal(start.headers.get('location'), '/chaos#sign-in-unavailable');
    const email = await h.post(
      h.routes.emailStart,
      '/api/account/email/start',
      {
        email: 'player@example.com',
      },
    );
    assert.equal(email.status, 404);
  } finally {
    h.close();
  }
});

void test('plain-HTTP development drops the __Host- prefix and the Secure flag', async () => {
  const local = 'http://localhost:3058';
  const h = harness((config) => ({ ...config, publicOrigin: local }), local);
  try {
    const verified = await h.signInByEmail();
    assert.ok(
      verified.headers
        .getSetCookie()
        .some((line) =>
          /^jy_session=[\w-]{43}; Path=\/; Max-Age=5184000; SameSite=Lax; HttpOnly$/.test(
            line,
          ),
        ),
    );
    assert.ok(await h.account());
  } finally {
    h.close();
  }
});

void test('the session check clears expired sessions and old codes without another sign-in', async () => {
  const config: AccountConfig = {};
  const h = harness((defaults) => Object.assign(config, defaults));
  try {
    await h.signInByEmail();
    assert.equal(h.count('account_sessions'), 1);
    assert.equal(h.count('account_email_codes'), 1);
    h.clock.now += 61 * DAY;
    // Sign-in has been switched off since, and nobody signs in again.
    delete config.secret;
    const response = await h.get(h.routes.session, '/api/account/session', {
      cookies: '',
    });
    assert.equal(response.status, 200);
    assert.equal(h.count('account_sessions'), 0);
    assert.equal(h.count('account_email_codes'), 0);
  } finally {
    h.close();
  }
});

void test('a leftover signed-in hint is cleared for guests', async () => {
  const h = harness();
  try {
    const response = await h.routes.session(
      h.request('/api/account/session', 'GET', { cookies: 'jy_signed_in=1' }),
    );
    assert.ok(
      response.headers
        .getSetCookie()
        .some((line) => line.startsWith('jy_signed_in=;')),
    );
  } finally {
    h.close();
  }
});
