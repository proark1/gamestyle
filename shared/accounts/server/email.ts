import type { GameDatabase } from '../../../db/contract';
import { hmac, randomId, sameText, sixDigitCode } from './crypto';
import { AccountError } from './errors';
import {
  codesSince,
  consumeCode,
  createAccount,
  dropCode,
  findIdentity,
  latestCode,
  replaceCode,
  spendAttempt,
  touchIdentity,
  type Identity,
} from './store';

const MINUTE = 60_000;
export const EMAIL_FLOW_COOKIE = 'jy_email_flow';
export const CODE_TTL_MS = 10 * MINUTE;
export const CODE_ATTEMPTS = 5;
/** Codes one address may receive: a short burst, then a daily total. */
export const CODE_LIMITS = [
  { window: 15 * MINUTE, count: 3 },
  { window: 24 * 60 * MINUTE, count: 10 },
];

const LOCAL =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]*[a-z][a-z0-9-]*$/;

/** Lowercased, with an internationalized domain in its punycode form. */
export function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (email.length > 254 || at < 1 || at > 64) return null;
  const local = email.slice(0, at),
    domainPart = email.slice(at + 1);
  if (!LOCAL.test(local) || !domainPart || /[\s/?#@:\\[\]%]/.test(domainPart))
    return null;
  let domain: string;
  try {
    domain = new URL(`http://${domainPart}`).hostname;
  } catch {
    return null;
  }
  return DOMAIN.test(domain) ? `${local}@${domain}` : null;
}

/** `a•••@example.com`: enough for players to recognise the address they used. */
export function maskEmail(email: string) {
  return `${email[0]}•••${email.slice(email.lastIndexOf('@'))}`;
}

/** The identity subject for an address; the same hash keys its codes. */
export const emailSubject = (secret: string, email: string) =>
  hmac(secret, `email:${email}`);

export type SendCode = (
  email: string,
  code: string,
  id: string,
) => Promise<void>;

export function codeMessage(code: string) {
  const note =
    "It works for 10 minutes. If you didn't ask for it, you can ignore this email.";
  return {
    subject: `${code} is your Jumbleyard sign-in code`,
    text: `Your Jumbleyard sign-in code is ${code}.\n\n${note}`,
    html: `<p style="font:16px sans-serif">Your Jumbleyard sign-in code is</p><p style="font:700 30px monospace;letter-spacing:6px">${code}</p><p style="font:14px sans-serif;color:#555">${note}</p>`,
  };
}

export function resendSender(
  apiKey: string,
  from: string,
  fetcher: typeof fetch,
): SendCode {
  return async (email, code, id) => {
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `sign-in-${id}`,
      },
      body: JSON.stringify({ from, to: [email], ...codeMessage(code) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new Error(`The email service answered ${response.status}.`);
  };
}

type CodeContext = { db: GameDatabase; secret: string; now: number };

/** Stores a fresh code for this browser and sends it. */
export async function sendCode(
  { db, secret, now }: CodeContext,
  email: string,
  flowHash: string,
  send: SendCode,
) {
  const emailHash = await emailSubject(secret, email);
  for (const limit of CODE_LIMITS)
    if ((await codesSince(db, emailHash, now - limit.window)) >= limit.count)
      throw new AccountError(
        'Too many codes for this address. Try again later.',
        429,
      );
  const id = randomId(),
    code = sixDigitCode();
  await replaceCode(db, {
    id,
    emailHash,
    flowHash,
    codeHash: await hmac(secret, `${id}:${code}`),
    created: now,
    expires: now + CODE_TTL_MS,
  });
  try {
    await send(email, code, id);
  } catch (error) {
    await dropCode(db, id);
    throw error;
  }
}

/** Checks a code from this browser and returns the address's identity subject. */
export async function confirmCode(
  { db, secret, now }: CodeContext,
  email: string,
  code: string,
  flowHash: string,
) {
  const emailHash = await emailSubject(secret, email);
  const row = await latestCode(db, emailHash, flowHash, now);
  if (!row)
    throw new AccountError('That code has expired. Ask for a new one.', 400, {
      remaining: 0,
    });
  if (!(await spendAttempt(db, row.id, CODE_ATTEMPTS)))
    throw new AccountError('Too many tries. Ask for a new code.', 400, {
      remaining: 0,
    });
  if (!sameText(row.code_hash, await hmac(secret, `${row.id}:${code}`))) {
    const remaining = Math.max(0, CODE_ATTEMPTS - row.attempts - 1);
    throw new AccountError(
      remaining
        ? "That code isn't right."
        : 'Too many tries. Ask for a new code.',
      400,
      { remaining },
    );
  }
  if (!(await consumeCode(db, row.id, now)))
    throw new AccountError(
      'That code was already used. Ask for a new one.',
      400,
      {
        remaining: 0,
      },
    );
  return emailHash;
}

export async function signInWithEmail(
  db: GameDatabase,
  subject: string,
  hint: string,
  now: number,
) {
  const identity: Identity = { provider: 'email', subject, hint };
  const existing = await findIdentity(db, 'email', subject);
  if (!existing) return createAccount(db, [identity], now);
  await touchIdentity(db, identity, now);
  return existing.account_id;
}
