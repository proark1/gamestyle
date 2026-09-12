import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateSqlite, openSqlite } from '../../../db/sqlite.mjs';
import { sqliteAdapter } from '../../../db/node';
import { createAccount, findIdentity, type Identity } from './store';

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
