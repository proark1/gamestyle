import { migrateSqlite, openSqlite } from '../db/sqlite.mjs';
const database = openSqlite();
try {
  migrateSqlite(database);
  console.log('Stack or Sink room database is ready.');
} finally {
  database.close();
}
