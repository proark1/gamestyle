import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openSqlite, migrateSqlite } from '../db/sqlite.mjs';
import { sqliteAdapter } from '../db/node';
import { finalizeDueRankedBoards } from '../shared/challenges/server/ranked';
import { finalizeDueCrewBoards } from '../shared/challenges/server/ranked-crews';

const path = process.env.DATABASE_PATH;
if (!path || !existsSync(resolve(path)))
  throw new Error('Set DATABASE_PATH to an existing game database.');

const native = openSqlite();
try {
  migrateSqlite(native);
  const db = sqliteAdapter(native);
  const now = Date.now();
  await finalizeDueRankedBoards(db, now);
  await finalizeDueCrewBoards(db, now);
  const players = native
    .prepare('SELECT COUNT(*) AS n FROM ranked_finalizations')
    .get() as { n: number };
  const crews = native
    .prepare('SELECT COUNT(*) AS n FROM ranked_crew_finalizations')
    .get() as { n: number };
  console.log(
    `Ranked finalization checked at ${new Date(now).toISOString()}; ${players.n} player and ${crews.n} crew brackets finalized in total.`,
  );
} finally {
  native.close();
}
