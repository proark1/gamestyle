import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function databasePath() {
  return resolve(process.env.DATABASE_PATH || 'data/stack-or-sink.sqlite');
}

/** @param {string} filename */
export function openSqlite(filename = databasePath()) {
  if (filename !== ':memory:')
    mkdirSync(dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec(
    'PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL;',
  );
  return database;
}

let applicationDatabase;
export function getSqliteDatabase() {
  return (applicationDatabase ??= openSqlite());
}

/** Apply schema changes before the HTTP server accepts requests.
 * @param {DatabaseSync} database
 * @param {string} directory
 */
export function migrateSqlite(database, directory = resolve('drizzle')) {
  database.exec(
    'CREATE TABLE IF NOT EXISTS _game_migrations (name TEXT PRIMARY KEY NOT NULL, applied INTEGER NOT NULL)',
  );
  for (const name of readdirSync(directory)
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort()) {
    database.exec('BEGIN IMMEDIATE');
    try {
      if (
        !database
          .prepare('SELECT name FROM _game_migrations WHERE name = ?')
          .get(name)
      ) {
        database.exec(readFileSync(resolve(directory, name), 'utf8'));
        database
          .prepare('INSERT INTO _game_migrations (name, applied) VALUES (?, ?)')
          .run(name, Date.now());
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
}
