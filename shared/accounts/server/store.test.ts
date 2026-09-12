import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateSqlite, openSqlite } from '../../../db/sqlite.mjs';
import { sqliteAdapter } from '../../../db/node';
import {
  activateCode,
  createAccount,
  findIdentity,
  latestCode,
  reserveCode,
  type Identity,
} from './store';

const NOW = Date.UTC(2026, 8, 12, 12);

void test('an account created in a race joins the account that claimed any of its identities', async () => {
  const native = openSqlite(':memory:');
  try {
    migrateSqlite(native);
    const db = sqliteAdapter(native);
    const email: Identity = {
      provider: 'email',
      subject: 'address-subject',
      hint: 'hint',
    };
    const google: Identity = {
      provider: 'google',
      subject: 'google-subject',
      hint: 'hint',
    };
    // An email sign-in claims the address after Google's own check found nothing.
    const emailAccount = await createAccount(db, [email], NOW);
    const googleAccount = await createAccount(db, [google, email], NOW + 1);
    assert.equal(googleAccount, emailAccount);
    assert.equal(
      (await findIdentity(db, 'google', 'google-subject'))?.account_id,
      emailAccount,
    );
    const row = native
      .prepare('SELECT COUNT(*) AS count FROM accounts')
      .get() as { count: number };
    assert.equal(row.count, 1);
  } finally {
    native.close();
  }
});

void test('codes reserved in the same millisecond keep their reservation order, whatever their ids', async () => {
  const native = openSqlite(':memory:');
  try {
    migrateSqlite(native);
    const db = sqliteAdapter(native);
    const code = (id: string) => ({
      id,
      emailHash: 'address',
      flowHash: 'browser',
      codeHash: `hash-${id}`,
      created: NOW,
    });
    const activate = (id: string) =>
      activateCode(db, {
        id,
        emailHash: 'address',
        flowHash: 'browser',
        now: NOW,
        expires: NOW + 600_000,
      });
    // The later reservation has the smaller id, and its email lands first.
    assert.ok(await reserveCode(db, code('zz-older'), []));
    assert.ok(await reserveCode(db, code('aa-newer'), []));
    await activate('aa-newer');
    await activate('zz-older');
    assert.equal(
      (await latestCode(db, 'address', 'browser', NOW))?.id,
      'aa-newer',
    );
    const older = native
      .prepare('SELECT used FROM account_email_codes WHERE id = ?')
      .get('zz-older') as { used: number | null };
    assert.notEqual(older.used, null);
  } finally {
    native.close();
  }
});
