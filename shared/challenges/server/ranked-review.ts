import type { GameDatabase, WriteResult } from '../../../db/contract';
import { RANKED_REVIEW_MS } from './ranked';

export type RankedReviewKind = 'review' | 'service';

/** Trusted operations only. No player route calls this function. */
export async function reviewRankedRun(
  db: GameDatabase,
  input: {
    runId: string;
    kind: RankedReviewKind;
    actor: string;
    reason: string;
  },
  now: number,
): Promise<'recorded' | 'already-recorded'> {
  const { runId, kind, actor, reason } = input;
  if (
    !runId ||
    runId.length > 128 ||
    (kind !== 'review' && kind !== 'service') ||
    !actor.trim() ||
    actor.length > 120 ||
    !reason.trim() ||
    reason.length > 1000 ||
    !Number.isSafeInteger(now)
  )
    throw new Error('Invalid ranked review request.');

  const existing = await db
    .prepare('SELECT kind FROM ranked_run_reviews WHERE run_id = ?')
    .bind(runId)
    .first<{ kind: RankedReviewKind }>();
  if (existing) {
    if (existing.kind !== kind)
      throw new Error('This run already has a different review decision.');
    return 'already-recorded';
  }

  const result = (await db.batch([
    db
      .prepare(`INSERT OR IGNORE INTO ranked_run_reviews (run_id,kind,actor,reason,created)
      SELECT ?,?,?,?,? WHERE EXISTS (
        SELECT 1 FROM ranked_attempts a WHERE a.run_id = ?
        GROUP BY a.run_id, a.week, a.team_size
        HAVING ? < a.week + 7 * 86400000 + ?
          AND NOT EXISTS (SELECT 1 FROM ranked_finalizations f
            WHERE f.week = a.week AND f.team_size = a.team_size)
          AND NOT EXISTS (SELECT 1 FROM ranked_crew_finalizations f
            WHERE f.week = a.week AND f.team_size = a.team_size)
          AND (? != 'service' OR COUNT(a.completed) = 0)
      )`)
      .bind(
        runId,
        kind,
        actor.trim(),
        reason.trim(),
        now,
        runId,
        now,
        RANKED_REVIEW_MS,
        kind,
      ),
    db
      .prepare(`UPDATE ranked_attempts SET eligible = 0,
        service_voided = CASE WHEN ? = 'service' THEN 1 ELSE service_voided END
      WHERE run_id = ? AND EXISTS (SELECT 1 FROM ranked_run_reviews
        WHERE run_id = ? AND kind = ? AND created = ?)`)
      .bind(kind, runId, runId, kind, now),
    db
      .prepare(`DELETE FROM ranked_crew_locks
      WHERE ? = 'service'
        AND EXISTS (SELECT 1 FROM ranked_attempts a
          WHERE a.run_id = ? AND a.account_id = ranked_crew_locks.account_id
          AND a.week = ranked_crew_locks.week AND a.service_voided = 1)
        AND NOT EXISTS (SELECT 1 FROM ranked_attempts a
          JOIN ranked_crew_runs r ON r.run_id = a.run_id
          WHERE a.account_id = ranked_crew_locks.account_id
            AND a.week = ranked_crew_locks.week
            AND r.crew_id = ranked_crew_locks.crew_id
            AND a.service_voided = 0)`)
      .bind(kind, runId),
  ])) as WriteResult[];
  if (result[0].meta.changes) return 'recorded';
  const raced = await db
    .prepare('SELECT kind FROM ranked_run_reviews WHERE run_id = ?')
    .bind(runId)
    .first<{ kind: RankedReviewKind }>();
  if (raced) {
    if (raced.kind !== kind)
      throw new Error('This run already has a different review decision.');
    return 'already-recorded';
  }
  throw new Error(
    'Run not found, already completed, or its review window/board is closed.',
  );
}
