import type { GameDatabase } from '../../../db/contract';
import type { AccountProvider } from '../types';
import { randomId } from './crypto';

const DAY = 86_400_000;

export type Identity = {
  provider: AccountProvider;
  subject: string;
  hint: string;
};

export function findIdentity(
  db: GameDatabase,
  provider: AccountProvider,
  subject: string,
) {
  return db
    .prepare(
      'SELECT account_id FROM account_identities WHERE provider = ? AND subject = ?',
    )
    .bind(provider, subject)
    .first<{ account_id: string }>();
}

export async function touchIdentity(
  db: GameDatabase,
  identity: Identity,
  now: number,
) {
  await db
    .prepare(
      'UPDATE account_identities SET last_used = ?, email_hint = ? WHERE provider = ? AND subject = ?',
    )
    .bind(now, identity.hint, identity.provider, identity.subject)
    .run();
}

const insertIdentity = (
  db: GameDatabase,
  accountId: string,
  identity: Identity,
  now: number,
) =>
  db
    .prepare(
      'INSERT OR IGNORE INTO account_identities (provider, subject, account_id, email_hint, created, last_used) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(
      identity.provider,
      identity.subject,
      accountId,
      identity.hint,
      now,
      now,
    );

export async function linkIdentity(
  db: GameDatabase,
  accountId: string,
  identity: Identity,
  now: number,
) {
  await insertIdentity(db, accountId, identity, now).run();
}

/**
 * Creates an account holding these identities. If a simultaneous sign-in
 * claimed any of them first, that account wins: this new one hands over the
 * identities it did claim and is removed.
 */
export async function createAccount(
  db: GameDatabase,
  identities: [Identity, ...Identity[]],
  now: number,
) {
  const id = randomId();
  await db.batch([
    db
      .prepare(
        'INSERT INTO accounts (id, display_name, created, updated) VALUES (?, NULL, ?, ?)',
      )
      .bind(id, now, now),
    ...identities.map((identity) => insertIdentity(db, id, identity, now)),
  ]);
  for (const identity of identities) {
    const owner = await findIdentity(db, identity.provider, identity.subject);
    if (!owner || owner.account_id === id) continue;
    await db.batch([
      db
        .prepare(
          'UPDATE account_identities SET account_id = ? WHERE account_id = ?',
        )
        .bind(owner.account_id, id),
      db.prepare('DELETE FROM accounts WHERE id = ?').bind(id),
    ]);
    return owner.account_id;
  }
  return id;
}

export function findAccount(db: GameDatabase, id: string) {
  return db
    .prepare('SELECT id, display_name FROM accounts WHERE id = ?')
    .bind(id)
    .first<{ id: string; display_name: string | null }>();
}

export function accountIdentities(db: GameDatabase, accountId: string) {
  return db
    .prepare(
      'SELECT provider, email_hint FROM account_identities WHERE account_id = ? ORDER BY created, provider',
    )
    .bind(accountId)
    .all<{ provider: AccountProvider; email_hint: string }>();
}

export async function setDisplayName(
  db: GameDatabase,
  accountId: string,
  name: string | null,
  now: number,
) {
  await db
    .prepare('UPDATE accounts SET display_name = ?, updated = ? WHERE id = ?')
    .bind(name, now, accountId)
    .run();
}

export function findSession(db: GameDatabase, tokenHash: string, now: number) {
  return db
    .prepare(
      'SELECT s.account_id, s.renewed, a.display_name FROM account_sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires > ?',
    )
    .bind(tokenHash, now)
    .first<{
      account_id: string;
      renewed: number;
      display_name: string | null;
    }>();
}

export async function insertSession(
  db: GameDatabase,
  tokenHash: string,
  accountId: string,
  now: number,
  expires: number,
) {
  await db
    .prepare(
      'INSERT INTO account_sessions (token_hash, account_id, created, renewed, expires) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(tokenHash, accountId, now, now, expires)
    .run();
}

export async function renewSession(
  db: GameDatabase,
  tokenHash: string,
  now: number,
  expires: number,
) {
  await db
    .prepare(
      'UPDATE account_sessions SET renewed = ?, expires = ? WHERE token_hash = ?',
    )
    .bind(now, expires, tokenHash)
    .run();
}

export async function deleteSession(db: GameDatabase, tokenHash: string) {
  await db
    .prepare('DELETE FROM account_sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .run();
}

export async function deleteAccountSessions(
  db: GameDatabase,
  accountId: string,
) {
  await db
    .prepare('DELETE FROM account_sessions WHERE account_id = ?')
    .bind(accountId)
    .run();
}

/**
 * Adds a code that cannot be used yet (`expires` 0), but only while the
 * address is under every limit. The count and the insert are one statement,
 * so simultaneous requests cannot all slip under a limit.
 */
export async function reserveCode(
  db: GameDatabase,
  code: {
    id: string;
    emailHash: string;
    flowHash: string;
    codeHash: string;
    created: number;
  },
  limits: { since: number; count: number }[],
) {
  const under =
    limits
      .map(
        () =>
          '(SELECT COUNT(*) FROM account_email_codes WHERE email_hash = ? AND created > ?) < ?',
      )
      .join(' AND ') || '1';
  const result = await db
    .prepare(
      `INSERT INTO account_email_codes (id, email_hash, flow_hash, code_hash, attempts, created, expires) SELECT ?, ?, ?, ?, 0, ?, 0 WHERE ${under}`,
    )
    .bind(
      code.id,
      code.emailHash,
      code.flowHash,
      code.codeHash,
      code.created,
      ...limits.flatMap((limit) => [code.emailHash, limit.since, limit.count]),
    )
    .run();
  return result.meta.changes > 0;
}

/** Makes a sent code usable, and retires older codes this browser held for the address. */
export async function activateCode(
  db: GameDatabase,
  code: {
    id: string;
    emailHash: string;
    flowHash: string;
    now: number;
    expires: number;
  },
) {
  await db.batch([
    db
      .prepare(
        'UPDATE account_email_codes SET used = ? WHERE email_hash = ? AND flow_hash = ? AND used IS NULL AND id != ?',
      )
      .bind(code.now, code.emailHash, code.flowHash, code.id),
    db
      .prepare('UPDATE account_email_codes SET expires = ? WHERE id = ?')
      .bind(code.expires, code.id),
  ]);
}

export async function dropCode(db: GameDatabase, id: string) {
  await db
    .prepare('DELETE FROM account_email_codes WHERE id = ?')
    .bind(id)
    .run();
}

export function latestCode(
  db: GameDatabase,
  emailHash: string,
  flowHash: string,
  now: number,
) {
  return db
    .prepare(
      'SELECT id, code_hash, attempts FROM account_email_codes WHERE email_hash = ? AND flow_hash = ? AND used IS NULL AND expires > ? ORDER BY created DESC LIMIT 1',
    )
    .bind(emailHash, flowHash, now)
    .first<{ id: string; code_hash: string; attempts: number }>();
}

/** Spends a try before the check, so parallel guesses cannot pass the limit. */
export async function spendAttempt(
  db: GameDatabase,
  id: string,
  limit: number,
) {
  const result = await db
    .prepare(
      'UPDATE account_email_codes SET attempts = attempts + 1 WHERE id = ? AND used IS NULL AND attempts < ?',
    )
    .bind(id, limit)
    .run();
  return result.meta.changes > 0;
}

export async function consumeCode(db: GameDatabase, id: string, now: number) {
  const result = await db
    .prepare(
      'UPDATE account_email_codes SET used = ? WHERE id = ? AND used IS NULL',
    )
    .bind(now, id)
    .run();
  return result.meta.changes > 0;
}

/** Removes the account. Its identities, sessions and progress cascade. */
export async function deleteAccount(db: GameDatabase, accountId: string) {
  await db.batch([
    db
      .prepare(
        "DELETE FROM account_email_codes WHERE email_hash IN (SELECT subject FROM account_identities WHERE account_id = ? AND provider = 'email')",
      )
      .bind(accountId),
    db.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId),
  ]);
}

export async function purgeAccounts(db: GameDatabase, now: number) {
  await db.batch([
    db.prepare('DELETE FROM account_sessions WHERE expires < ?').bind(now),
    db
      .prepare('DELETE FROM account_email_codes WHERE created < ?')
      .bind(now - DAY),
  ]);
}
