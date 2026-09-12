import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateSqlite, openSqlite } from './sqlite.mjs';

void test('every account_id column is removed with its account', () => {
  const native = openSqlite(':memory:');
  try {
    migrateSqlite(native);
    const tables = (
      native
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as { name: string }[]
    ).map((row) => row.name);
    for (const table of [
      'accounts',
      'account_identities',
      'account_sessions',
      'account_email_codes',
    ])
      assert.ok(tables.includes(table), `${table} exists`);
    let checked = 0;
    for (const table of tables) {
      const columns = native
        .prepare(`SELECT name FROM pragma_table_info('${table}')`)
        .all() as { name: string }[];
      if (!columns.some((column) => column.name === 'account_id')) continue;
      const keys = native
        .prepare(
          `SELECT "from", "table", on_delete FROM pragma_foreign_key_list('${table}')`,
        )
        .all() as { from: string; table: string; on_delete: string }[];
      assert.ok(
        keys.some(
          (key) =>
            key.from === 'account_id' &&
            key.table === 'accounts' &&
            key.on_delete === 'CASCADE',
        ),
        `${table}.account_id must cascade from accounts`,
      );
      checked++;
    }
    assert.ok(checked >= 2);
  } finally {
    native.close();
  }
});
