import type { GameDatabase, GameStatement } from '../../../db/contract';
import { randomId } from '../../accounts/server/crypto';
import type { RankedBoard } from './ranked';

const WEEK_WITH_REVIEW = 8 * 86400000;
const RULES = 1;

/** Every crew claim is derived from signed-in room seats and current crew membership. */
export function rankedCrewStartStatements(
  db: GameDatabase,
  key: string,
  commit: string,
  run: { id: string; week: number },
  teamSize: number,
): GameStatement[] {
  return [
    db
      .prepare(`WITH candidate AS (
        SELECT cm.crew_id FROM ranked_attempts a
        JOIN crew_members cm ON cm.account_id = a.account_id
        JOIN crews c ON c.id = cm.crew_id AND c.archived IS NULL
        WHERE a.run_id = ? GROUP BY cm.crew_id HAVING COUNT(*) = ?
      ) INSERT OR IGNORE INTO ranked_crew_runs (run_id,crew_id,week,team_size)
      SELECT ?, candidate.crew_id, ?, ? FROM candidate
      WHERE NOT EXISTS (SELECT 1 FROM ranked_attempts a
        JOIN ranked_crew_locks l ON l.account_id = a.account_id AND l.week = ?
        WHERE a.run_id = ? AND l.crew_id != candidate.crew_id)
      AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND json_extract(state, '$.challengeCommit') = ?)`)
      .bind(
        run.id,
        teamSize,
        run.id,
        run.week,
        teamSize,
        run.week,
        run.id,
        key,
        commit,
      ),
    db
      .prepare(`INSERT OR IGNORE INTO ranked_crew_locks (account_id,week,crew_id)
      SELECT a.account_id, ?, r.crew_id FROM ranked_attempts a
      JOIN ranked_crew_runs r ON r.run_id = a.run_id WHERE a.run_id = ?
      AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND json_extract(state, '$.challengeCommit') = ?)`)
      .bind(run.week, run.id, key, commit),
    db
      .prepare(`INSERT OR IGNORE INTO ranked_crew_tags (crew_id,tag)
      SELECT r.crew_id, 'Crew ' || upper(substr(hex(randomblob(5)), 1, 8))
      FROM ranked_crew_runs r WHERE r.run_id = ?
      AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND json_extract(state, '$.challengeCommit') = ?)`)
      .bind(run.id, key, commit),
  ];
}

const PLACED = `WITH eligible_runs AS (
  SELECT r.crew_id, r.run_id, MAX(a.height_cm) AS height_cm, MIN(a.completed) AS completed
  FROM ranked_crew_runs r JOIN ranked_attempts a ON a.run_id = r.run_id AND a.eligible = 1
  WHERE r.week = ? AND r.team_size = ? GROUP BY r.crew_id, r.run_id
  HAVING COUNT(*) = r.team_size
), best_runs AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY crew_id ORDER BY height_cm DESC, completed, run_id) AS choice
  FROM eligible_runs
), placed AS (
  SELECT crew_id, run_id, height_cm, RANK() OVER (ORDER BY height_cm DESC) AS place
  FROM best_runs WHERE choice = 1
)`;

async function finalizeCrewBoard(
  db: GameDatabase,
  week: number,
  teamSize: number,
  now: number,
) {
  const commit = randomId();
  const reference = `ranked-stack-v${RULES}:${week}:${teamSize}:crew`;
  const award = (item: string, divisor: number, suffix: string) =>
    db
      .prepare(`${PLACED}, population AS (SELECT COUNT(*) AS n FROM placed)
      INSERT OR IGNORE INTO commerce_grants (account_id,item_id,source,reference,environment,created)
      SELECT a.account_id,?,'reward',?,'live',? FROM placed p
      JOIN ranked_attempts a ON a.run_id = p.run_id AND a.eligible = 1
      CROSS JOIN population
      WHERE population.n >= 100 AND p.place <= (population.n + ? - 1) / ?
      AND EXISTS (SELECT 1 FROM ranked_crew_finalizations
        WHERE week = ? AND team_size = ? AND commit_id = ?)`)
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
  await db.batch([
    db
      .prepare(
        'INSERT OR IGNORE INTO ranked_crew_finalizations (week,team_size,commit_id,created) VALUES (?,?,?,?)',
      )
      .bind(week, teamSize, commit, now),
    award('stack-rank-safety-helmet', 10, 'top10'),
    award('stack-rank-crown', 100, 'top1'),
  ]);
}

export async function finalizeDueCrewBoards(db: GameDatabase, now: number) {
  const pending = await db
    .prepare(`SELECT DISTINCT r.week, r.team_size AS teamSize FROM ranked_crew_runs r
    WHERE r.week + ? <= ? AND NOT EXISTS (SELECT 1 FROM ranked_crew_finalizations f
      WHERE f.week = r.week AND f.team_size = r.team_size) ORDER BY r.week LIMIT 64`)
    .bind(WEEK_WITH_REVIEW, now)
    .all<{ week: number; teamSize: number }>();
  for (const item of pending.results)
    await finalizeCrewBoard(db, item.week, item.teamSize, now);
}

export async function readCrewBoards(
  db: GameDatabase,
  week: number,
  accountId: string,
): Promise<RankedBoard[]> {
  const boards: RankedBoard[] = [];
  for (let teamSize = 1; teamSize <= 4; teamSize++) {
    const rows = await db
      .prepare(`${PLACED}
      SELECT t.tag, p.height_cm AS heightCm, p.place, p.run_id AS runId,
      EXISTS (SELECT 1 FROM ranked_attempts a WHERE a.run_id = p.run_id AND a.account_id = ? AND a.eligible = 1) AS self
      FROM placed p JOIN ranked_crew_tags t ON t.crew_id = p.crew_id ORDER BY p.place, t.tag`)
      .bind(week, teamSize, accountId)
      .all<{
        tag: string;
        heightCm: number;
        place: number;
        runId: string;
        self: number;
      }>();
    boards.push({
      teamSize,
      population: rows.results.length,
      entries: rows.results.slice(0, 20).map((row) => ({
        tag: row.tag,
        heightCm: row.heightCm,
        place: row.place,
        self: !!row.self,
      })),
      myPlace: rows.results.find((row) => row.self)?.place ?? null,
    });
  }
  return boards;
}
