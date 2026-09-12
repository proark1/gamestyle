import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateSqlite, openSqlite } from '../../../db/sqlite.mjs';
import { sqliteAdapter } from '../../../db/node';
import { base64url, pkceChallenge, unseal } from './crypto';
import { emailSubject, signInWithEmail } from './email';
import {
  beginGoogle,
  checkClaims,
  exchangeCode,
  googleOwnsEmail,
  parseFlow,
  safeReturnPath,
  signInWithGoogle,
  type GoogleClaims,
} from './google';

const SECRET = 'a-test-secret-that-is-long-enough-000';
const NOW = Date.UTC(2026, 8, 12, 12);
const ORIGIN = 'https://www.jumbleyard.com';
const client = { clientId: 'client-1', clientSecret: 'client-secret' };
const encode = (value: unknown) =>
  base64url(new TextEncoder().encode(JSON.stringify(value)));

const claims = (overrides: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: client.clientId,
  azp: client.clientId,
  sub: '1234567890',
  email: 'player@gmail.com',
  email_verified: true,
  nonce: 'nonce-1',
  iat: NOW / 1000,
  exp: NOW / 1000 + 3600,
  ...overrides,
});

void test('sign-in only ever returns to a path on this site', () => {
  for (const good of ['/', '/chaos', '/stack-or-sink?room=ABCDEF#lobby'])
    assert.equal(safeReturnPath(good), good);
  for (const bad of [
    null,
    '',
    'chaos',
    '//evil.example',
    '/\\evil.example',
    'https://evil.example',
    '/a\u0000b',
    `/${'a'.repeat(512)}`,
  ])
    assert.equal(safeReturnPath(bad), '/', String(bad));
});

void test('the Google request carries the signed flow’s state, nonce and PKCE challenge', async () => {
  const start = await beginGoogle(client, SECRET, ORIGIN, '/chaos', true, NOW);
  const url = new URL(start.url);
  assert.equal(
    `${url.origin}${url.pathname}`,
    'https://accounts.google.com/o/oauth2/v2/auth',
  );
  const flow = parseFlow(await unseal(SECRET, 'google', start.cookie), NOW);
  assert.ok(flow);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    client_id: client.clientId,
    redirect_uri: `${ORIGIN}/api/account/google/callback`,
    response_type: 'code',
    scope: 'openid email',
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: await pkceChallenge(flow.verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  assert.equal(flow.returnTo, '/chaos');
  assert.equal(flow.popup, true);
  assert.equal(
    parseFlow(await unseal(SECRET, 'google', start.cookie), NOW + 600_000),
    null,
  );
});

void test('ID token claims must be Google’s, for this client, this flow and now', () => {
  assert.deepEqual(checkClaims(claims(), client.clientId, 'nonce-1', NOW), {
    sub: '1234567890',
    email: 'player@gmail.com',
    emailVerified: true,
    hd: undefined,
  });
  for (const bad of [
    { iss: 'https://evil.example' },
    { aud: 'other-client' },
    { aud: ['other-client'] },
    { azp: 'other-client' },
    { nonce: 'nonce-2' },
    { nonce: undefined },
    { exp: NOW / 1000 - 120 },
    { iat: NOW / 1000 + 120 },
    { sub: '' },
    { sub: 42 },
  ])
    assert.equal(
      checkClaims(claims(bad), client.clientId, 'nonce-1', NOW),
      null,
      JSON.stringify(bad),
    );
  assert.equal(
    checkClaims(
      claims({ email_verified: 'true' }),
      client.clientId,
      'nonce-1',
      NOW,
    )?.emailVerified,
    false,
  );
});

void test('the code exchange sends the verifier and reads only the returned ID token', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const token = `${encode({ alg: 'RS256' })}.${encode(claims())}.signature`;
  const result = await exchangeCode(
    client,
    ORIGIN,
    'auth-code',
    'verifier-1',
    async (url, init) => {
      calls.push({
        url: url instanceof Request ? url.url : url.toString(),
        init,
      });
      return Response.json({ id_token: token });
    },
  );
  assert.equal(result?.sub, '1234567890');
  assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');
  assert.deepEqual(
    Object.fromEntries(
      new URLSearchParams(calls[0].init?.body as URLSearchParams),
    ),
    {
      code: 'auth-code',
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: `${ORIGIN}/api/account/google/callback`,
      grant_type: 'authorization_code',
      code_verifier: 'verifier-1',
    },
  );
  assert.equal(
    await exchangeCode(client, ORIGIN, 'bad', 'verifier-1', async () =>
      Response.json({ error: 'invalid_grant' }, { status: 400 }),
    ),
    null,
  );
});

void test('Google speaks only for the addresses it hosts', () => {
  const gmail: GoogleClaims = {
    sub: '1',
    email: 'player@gmail.com',
    emailVerified: true,
  };
  assert.ok(googleOwnsEmail(gmail));
  assert.ok(!googleOwnsEmail({ ...gmail, emailVerified: false }));
  assert.ok(
    googleOwnsEmail({
      ...gmail,
      email: 'kim@school.example',
      hd: 'school.example',
    }),
  );
  assert.ok(!googleOwnsEmail({ ...gmail, email: 'kim@school.example' }));
  assert.ok(
    !googleOwnsEmail({
      ...gmail,
      email: 'kim@other.example',
      hd: 'school.example',
    }),
  );
});

void test('Google joins an email account only for an address Google hosts', async () => {
  const native = openSqlite(':memory:');
  try {
    migrateSqlite(native);
    const db = sqliteAdapter(native);
    const byEmail = async (email: string) =>
      signInWithEmail(db, await emailSubject(SECRET, email), 'hint', NOW);
    const google = (sub: string, email: string) =>
      signInWithGoogle(db, SECRET, { sub, email, emailVerified: true }, NOW);

    const gmailAccount = await byEmail('player@gmail.com');
    assert.equal(await google('g-1', 'player@gmail.com'), gmailAccount);
    assert.equal(await google('g-1', 'player@gmail.com'), gmailAccount);

    const outlookAccount = await byEmail('kim@outlook.com');
    assert.notEqual(await google('g-2', 'kim@outlook.com'), outlookAccount);

    const fresh = await google('g-3', 'new@gmail.com');
    assert.equal(await byEmail('new@gmail.com'), fresh);
  } finally {
    native.close();
  }
});

void test('a new address hosted by Google retires the old one and signs out other devices', async () => {
  const native = openSqlite(':memory:');
  try {
    migrateSqlite(native);
    const db = sqliteAdapter(native);
    const subject = (email: string) => emailSubject(SECRET, email);
    const google = (email: string) =>
      signInWithGoogle(
        db,
        SECRET,
        { sub: 'g-work', email, emailVerified: true, hd: 'corp.example' },
        NOW,
      );
    const owner = async (email: string) =>
      (
        native
          .prepare(
            "SELECT account_id FROM account_identities WHERE provider = 'email' AND subject = ?",
          )
          .get(await subject(email)) as { account_id: string } | undefined
      )?.account_id;
    const sessions = (accountId: string) =>
      (
        native
          .prepare(
            'SELECT COUNT(*) AS count FROM account_sessions WHERE account_id = ?',
          )
          .get(accountId) as { count: number }
      ).count;

    const account = await google('sam@corp.example');
    assert.equal(await owner('sam@corp.example'), account);
    native
      .prepare(
        'INSERT INTO account_sessions (token_hash, account_id, created, renewed, expires) VALUES (?, ?, ?, ?, ?)',
      )
      .run('other-device', account, NOW, NOW, NOW + 86_400_000);

    // The same address again changes nothing.
    assert.equal(await google('sam@corp.example'), account);
    assert.equal(sessions(account), 1);

    // An administrator renames Sam, then hands the old address to a newcomer.
    assert.equal(await google('sam.lee@corp.example'), account);
    assert.equal(await owner('sam@corp.example'), undefined);
    assert.equal(await owner('sam.lee@corp.example'), account);
    assert.equal(sessions(account), 0);
    const newcomer = await signInWithEmail(
      db,
      await subject('sam@corp.example'),
      'hint',
      NOW,
    );
    assert.notEqual(newcomer, account);

    // An address that another account already holds is never taken over.
    const other = await signInWithEmail(
      db,
      await subject('lee@corp.example'),
      'hint',
      NOW,
    );
    assert.equal(await google('lee@corp.example'), account);
    assert.equal(await owner('lee@corp.example'), other);
    assert.equal(await owner('sam.lee@corp.example'), undefined);
  } finally {
    native.close();
  }
});
