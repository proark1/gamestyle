import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateSqlite, openSqlite } from '../../../db/sqlite.mjs';
import { sqliteAdapter } from '../../../db/node';
import { sha256 } from './crypto';
import {
  CODE_ATTEMPTS,
  codeMessage,
  confirmCode,
  emailSubject,
  maskEmail,
  normalizeEmail,
  resendSender,
  sendCode,
  signInWithEmail,
  type SendCode,
} from './email';
import { AccountError } from './errors';

const SECRET = 'a-test-secret-that-is-long-enough-000';
const NOW = Date.UTC(2026, 8, 12, 12);
const MINUTE = 60_000;
const EMAIL = 'player@example.com';

function database() {
  const native = openSqlite(':memory:');
  migrateSqlite(native);
  return { native, db: sqliteAdapter(native) };
}

async function refused(
  promise: Promise<unknown>,
  status: number,
  remaining?: number,
) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof AccountError);
    assert.equal(error.status, status);
    if (remaining !== undefined) assert.equal(error.extra.remaining, remaining);
    return true;
  });
}

function mailbox() {
  const codes: string[] = [];
  const send: SendCode = async (_email, code) => {
    codes.push(code);
  };
  return { codes, send };
}

void test('addresses are normalized and anything unusable is refused', () => {
  assert.equal(
    normalizeEmail('  Player.One+games@Example.COM '),
    'player.one+games@example.com',
  );
  assert.equal(normalizeEmail('kim@bücher.de'), 'kim@xn--bcher-kva.de');
  for (const bad of [
    undefined,
    42,
    '',
    'plain',
    '@example.com',
    'a@',
    'a@b',
    'a@1.2.3.4',
    'a@example.com/path',
    'a@exa mple.com',
    'a..b@example.com',
    '.a@example.com',
    'a b@example.com',
    '"quoted"@example.com',
    `${'a'.repeat(65)}@example.com`,
    `a@${'b'.repeat(250)}.com`,
  ])
    assert.equal(normalizeEmail(bad), null, String(bad));
  assert.equal(maskEmail(EMAIL), 'p•••@example.com');
});

void test('a code signs in once, and only in the browser that asked for it', async () => {
  const { native, db } = database();
  try {
    const flow = await sha256('browser-one');
    const { codes, send } = mailbox();
    await sendCode({ db, secret: SECRET, now: NOW }, EMAIL, flow, send);
    assert.equal(codes.length, 1);
    await refused(
      confirmCode(
        { db, secret: SECRET, now: NOW },
        EMAIL,
        codes[0],
        await sha256('browser-two'),
      ),
      400,
      0,
    );
    assert.equal(
      await confirmCode(
        { db, secret: SECRET, now: NOW },
        EMAIL,
        codes[0],
        flow,
      ),
      await emailSubject(SECRET, EMAIL),
    );
    await refused(
      confirmCode({ db, secret: SECRET, now: NOW }, EMAIL, codes[0], flow),
      400,
      0,
    );
    const stored = JSON.stringify(
      native.prepare('SELECT * FROM account_email_codes').all(),
    );
    assert.ok(!stored.includes(EMAIL));
  } finally {
    native.close();
  }
});

void test('wrong codes count down, then the code locks', async () => {
  const { native, db } = database();
  try {
    const flow = await sha256('browser');
    const context = { db, secret: SECRET, now: NOW };
    const { codes, send } = mailbox();
    await sendCode(context, EMAIL, flow, send);
    const wrong = codes[0] === '000000' ? '111111' : '000000';
    for (let remaining = CODE_ATTEMPTS - 1; remaining >= 0; remaining--)
      await refused(confirmCode(context, EMAIL, wrong, flow), 400, remaining);
    await refused(confirmCode(context, EMAIL, codes[0], flow), 400, 0);
  } finally {
    native.close();
  }
});

void test('codes expire after ten minutes, and a new code replaces the old one', async () => {
  const { native, db } = database();
  try {
    const flow = await sha256('browser');
    const { codes, send } = mailbox();
    await sendCode({ db, secret: SECRET, now: NOW }, EMAIL, flow, send);
    await refused(
      confirmCode(
        { db, secret: SECRET, now: NOW + 10 * MINUTE },
        EMAIL,
        codes[0],
        flow,
      ),
      400,
      0,
    );
    const later = { db, secret: SECRET, now: NOW + 11 * MINUTE };
    await sendCode(later, EMAIL, flow, send);
    await sendCode(later, EMAIL, flow, send);
    if (codes[1] !== codes[2])
      await refused(confirmCode(later, EMAIL, codes[1], flow), 400, 4);
    assert.ok(await confirmCode(later, EMAIL, codes[2], flow));
  } finally {
    native.close();
  }
});

void test('an address gets three codes per quarter hour and ten a day', async () => {
  const { native, db } = database();
  try {
    const flow = await sha256('browser');
    const { send } = mailbox();
    const at = (now: number) => ({ db, secret: SECRET, now });
    for (let i = 0; i < 3; i++) await sendCode(at(NOW + i), EMAIL, flow, send);
    await refused(sendCode(at(NOW + 3), EMAIL, flow, send), 429);
    await sendCode(at(NOW + 3), 'other@example.com', flow, send);
    let sent = 3;
    for (let round = 1; sent < 10; round++)
      for (let i = 0; i < 3 && sent < 10; i++, sent++)
        await sendCode(at(NOW + round * 16 * MINUTE + i), EMAIL, flow, send);
    await refused(sendCode(at(NOW + 5 * 16 * MINUTE), EMAIL, flow, send), 429);
  } finally {
    native.close();
  }
});

void test('a code that could not be sent is removed again', async () => {
  const { native, db } = database();
  try {
    await assert.rejects(
      sendCode(
        { db, secret: SECRET, now: NOW },
        EMAIL,
        await sha256('browser'),
        async () => {
          throw new Error('offline');
        },
      ),
      /offline/,
    );
    const row = native
      .prepare('SELECT COUNT(*) AS count FROM account_email_codes')
      .get() as { count: number };
    assert.equal(row.count, 0);
  } finally {
    native.close();
  }
});

void test('Resend gets one idempotent message per code', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const send = resendSender(
    're_test',
    'Jumbleyard <sign-in@jumbleyard.com>',
    async (url, init) => {
      calls.push({
        url: url instanceof Request ? url.url : url.toString(),
        init,
      });
      return Response.json({ id: 'message' });
    },
  );
  await send(EMAIL, '123456', 'code-id');
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  const headers = new Headers(calls[0].init?.headers);
  assert.equal(headers.get('authorization'), 'Bearer re_test');
  assert.equal(headers.get('idempotency-key'), 'sign-in-code-id');
  assert.deepEqual(JSON.parse(calls[0].init?.body as string), {
    from: 'Jumbleyard <sign-in@jumbleyard.com>',
    to: [EMAIL],
    ...codeMessage('123456'),
  });
  const rejected = resendSender('re_test', 'x', async () =>
    Response.json({}, { status: 422 }),
  );
  await assert.rejects(rejected(EMAIL, '123456', 'id'), /422/);
});

void test('the same address always reaches the same account', async () => {
  const { native, db } = database();
  try {
    const subject = await emailSubject(SECRET, EMAIL);
    const first = await signInWithEmail(db, subject, maskEmail(EMAIL), NOW);
    assert.equal(
      await signInWithEmail(db, subject, maskEmail(EMAIL), NOW + 1),
      first,
    );
    const row = native
      .prepare('SELECT COUNT(*) AS count FROM accounts')
      .get() as { count: number };
    assert.equal(row.count, 1);
  } finally {
    native.close();
  }
});
