import type {
  GameDatabase,
  GameStatement,
  WriteResult,
} from '../../../db/contract';
import { randomId } from '../../accounts/server/crypto';
import { stackWeek } from '../catalog';

export const RANKED_LIMIT = 5;
export const RANKED_REVIEW_MS = 86400000;
export const RANKED_RULES = 1;

export function rankedStartStatements(
  db: GameDatabase,
  key: string,
  commit: string,
  run: { id: string; week: number },
  teamSize: number,
  now: number,
  state: string,
): GameStatement[] {
  return [
    db
      .prepare(`INSERT OR IGNORE INTO ranked_tags (account_id, tag)
      SELECT m.account_id, 'Builder ' || upper(substr(hex(randomblob(5)), 1, 8))
      FROM challenge_members m JOIN json_each(?, '$.world.players') p
      ON json_extract(p.value, '$.id') = m.player_id
      WHERE m.room_code = ? AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND json_extract(state, '$.challengeCommit') = ?)`)
      .bind(state, key, key, commit),
    db
      .prepare(`INSERT INTO ranked_attempts (account_id,run_id,week,room_code,player_id,team_size,started)
      SELECT m.account_id,?,?,?,m.player_id,?,? FROM challenge_members m
      JOIN json_each(?, '$.world.players') p ON json_extract(p.value, '$.id') = m.player_id
      WHERE m.room_code = ? AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND json_extract(state, '$.challengeCommit') = ?)`)
      .bind(run.id, run.week, key, teamSize, now, state, key, key, commit),
  ];
}

export function rankedSettleStatement(
  db: GameDatabase,
  key: string,
  commit: string,
  run: { id: string; week: number },
  height: number,
  now: number,
) {
  const heightCm = Math.max(0, Math.floor(height * 100));
  const eligible =
    heightCm >= stackWeek(run.week).height * 100 &&
    now <= stackWeek(run.week).end + RANKED_REVIEW_MS;
  return db
    .prepare(`UPDATE ranked_attempts SET eligible = 1, height_cm = ?, completed = ?
    WHERE run_id = ? AND ? = 1
    AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND json_extract(state, '$.challengeCommit') = ?)
    AND (SELECT COUNT(*) FROM ranked_attempts WHERE run_id = ?) =
        (SELECT COUNT(*) FROM challenge_members WHERE room_code = ?)
    AND EXISTS (SELECT 1 FROM challenge_members m WHERE m.room_code = ?
      AND m.account_id = ranked_attempts.account_id AND m.player_id = ranked_attempts.player_id)`)
    .bind(
      heightCm,
      now,
      run.id,
      eligible ? 1 : 0,
      key,
      commit,
      run.id,
      key,
      key,
    );
}

async function finalizeBoard(
  db: GameDatabase,
  week: number,
  teamSize: number,
  now: number,
) {
  const commit = randomId();
  const reference = `ranked-stack-v${RANKED_RULES}:${week}:${teamSize}`;
  const award = (item: string, divisor: number, suffix: string) =>
    db
      .prepare(`WITH best AS (
        SELECT account_id, MAX(height_cm) AS height_cm FROM ranked_attempts
        WHERE week = ? AND team_size = ? AND eligible = 1 GROUP BY account_id
      ), placed AS (
        SELECT account_id, RANK() OVER (ORDER BY height_cm DESC) AS place FROM best
      ), population AS (SELECT COUNT(*) AS n FROM best)
      INSERT OR IGNORE INTO commerce_grants (account_id,item_id,source,reference,environment,created)
      SELECT placed.account_id,?,'reward',?,'live',? FROM placed, population
      WHERE population.n >= 100 AND placed.place <= (population.n + ? - 1) / ?
      AND EXISTS (SELECT 1 FROM ranked_finalizations WHERE week = ? AND team_size = ? AND commit_id = ?)`)
      .bind(
        week,
        teamSize,
        item,
        `${reference}:${suffix}`,
        now,
        divisor,
        divisor,
        week,
        teamSize,
        commit,
      );
  (await db.batch([
    db
      .prepare(
        'INSERT OR IGNORE INTO ranked_finalizations (week,team_size,commit_id,created) VALUES (?,?,?,?)',
      )
      .bind(week, teamSize, commit, now),
    award('stack-rank-safety-helmet', 10, 'top10'),
    award('stack-rank-crown', 100, 'top1'),
  ])) as WriteResult[];
}

export async function finalizeDueRankedBoards(db: GameDatabase, now: number) {
  const pending = await db
    .prepare(`SELECT DISTINCT a.week, a.team_size AS teamSize FROM ranked_attempts a
    WHERE a.week + ? <= ? AND NOT EXISTS (SELECT 1 FROM ranked_finalizations f
      WHERE f.week = a.week AND f.team_size = a.team_size) ORDER BY a.week LIMIT 64`)
    .bind(8 * 86400000, now)
    .all<{ week: number; teamSize: number }>();
  for (const board of pending.results)
    await finalizeBoard(db, board.week, board.teamSize, now);
}

export type RankedEntry = {
  tag: string;
  heightCm: number;
  place: number;
  self: boolean;
};
export type RankedBoard = {
  teamSize: number;
  population: number;
  entries: RankedEntry[];
  myPlace: number | null;
};

async function board(
  db: GameDatabase,
  week: number,
  accountId: string,
): Promise<RankedBoard[]> {
  const results: RankedBoard[] = [];
  for (let teamSize = 1; teamSize <= 4; teamSize++) {
    const rows = await db
      .prepare(`WITH best AS (
        SELECT account_id, MAX(height_cm) AS height_cm FROM ranked_attempts
        WHERE week = ? AND team_size = ? AND eligible = 1 GROUP BY account_id
      ), placed AS (
        SELECT account_id, height_cm, RANK() OVER (ORDER BY height_cm DESC) AS place FROM best
      ) SELECT t.tag, p.height_cm AS heightCm, p.place, p.account_id AS accountId
      FROM placed p JOIN ranked_tags t ON t.account_id = p.account_id
      ORDER BY p.place, t.tag`)
      .bind(week, teamSize)
      .all<{
        tag: string;
        heightCm: number;
        place: number;
        accountId: string;
      }>();
    results.push({
      teamSize,
      population: rows.results.length,
      entries: rows.results.slice(0, 20).map((row) => ({
        tag: row.tag,
        heightCm: row.heightCm,
        place: row.place,
        self: row.accountId === accountId,
      })),
      myPlace:
        rows.results.find((row) => row.accountId === accountId)?.place ?? null,
    });
  }
  return results;
}

export async function readRankedStack(
  db: GameDatabase,
  accountId: string,
  now: number,
) {
  await finalizeDueRankedBoards(db, now);
  const week = stackWeek(now);
  const attempts = await db
    .prepare(
      'SELECT COUNT(*) AS n FROM ranked_attempts WHERE account_id = ? AND week = ?',
    )
    .bind(accountId, week.start)
    .first<{ n: number }>();
  const previousWeek = week.start - 7 * 86400000;
  return {
    week,
    attemptsRemaining: Math.max(0, RANKED_LIMIT - (attempts?.n ?? 0)),
    boards: await board(db, week.start, accountId),
    previous: {
      week: previousWeek,
      finalized: now >= week.start + RANKED_REVIEW_MS,
      boards: await board(db, previousWeek, accountId),
    },
  };
}
