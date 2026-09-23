import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openSqlite, migrateSqlite } from '../db/sqlite.mjs';
import { sqliteAdapter } from '../db/node';
import { reviewRankedRun } from '../shared/challenges/server/ranked-review';

const [kind, runId, actor, ...reasonWords] = process.argv.slice(2);
if (
  (kind !== 'review' && kind !== 'service') ||
  !runId ||
  !actor ||
  !reasonWords.length
) {
  console.error(
    'Usage: DATABASE_PATH=<database> node --import tsx scripts/review-ranked-run.ts <review|service> <run-id> <staff-id> <reason...>',
  );
  process.exitCode = 2;
} else {
  const path = process.env.DATABASE_PATH;
  if (!path || !existsSync(resolve(path)))
    throw new Error('Set DATABASE_PATH to an existing game database.');
  const native = openSqlite();
  try {
    migrateSqlite(native);
    const result = await reviewRankedRun(
      sqliteAdapter(native),
      { kind, runId, actor, reason: reasonWords.join(' ') },
      Date.now(),
    );
    console.log(`${result}: ${runId}`);
  } finally {
    native.close();
  }
}
