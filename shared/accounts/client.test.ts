import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountSnapshot, refreshAccount, signOut } from './client';

const methods = { google: true, email: true };
const signedIn = {
  account: {
    displayName: null,
    identities: [{ provider: 'email', hint: 'p•••@example.com' }],
  },
  methods,
};

// The first answer looks for a Google landing notice in the address bar.
Object.defineProperty(globalThis, 'location', {
  value: { hash: '', pathname: '/', search: '' },
  configurable: true,
});

/** Session checks wait until the test answers them; other requests succeed at once. */
function server() {
  const answers: ((body: unknown) => void)[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string) =>
    input === '/api/account/session'
      ? new Promise<Response>((resolve) => {
          answers.push((body) => resolve(Response.json(body)));
        })
      : Promise.resolve(new Response(null, { status: 204 }))) as typeof fetch;
  return {
    answers,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

void test('a slow answer to an older session check cannot overwrite a newer one', async () => {
  const session = server();
  try {
    const older = refreshAccount(true);
    const newer = refreshAccount(true);
    assert.equal(session.answers.length, 2);
    // The player signed out in another tab between the two checks.
    session.answers[1]({ account: null, methods });
    await newer;
    session.answers[0](signedIn);
    await older;
    assert.equal(accountSnapshot().status, 'ready');
    assert.equal(accountSnapshot().account, null);
  } finally {
    session.restore();
  }
});

void test('signing out is not undone by a session check asked for before it', async () => {
  const session = server();
  try {
    const signIn = refreshAccount(true);
    session.answers[0](signedIn);
    await signIn;
    assert.ok(accountSnapshot().account);
    const check = refreshAccount(true);
    await signOut();
    session.answers[1](signedIn);
    await check;
    assert.equal(accountSnapshot().account, null);
  } finally {
    session.restore();
  }
});
