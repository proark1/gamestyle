import type { GameDatabase, GameStatement } from '../../../db/contract';
import { STACK_MASTERY, stackWeek, type StackProgress } from '../catalog';

/** Called only after the server has persisted a verified result in the same transaction. */
export function stackRewardStatements(
  db: GameDatabase,
  room: string,
  commit: string,
  run: string,
  week: number,
  now: number,
): GameStatement[] {
  const rewards = [
    ...STACK_MASTERY.map((m) => ({
      reference: `mastery:stack-v1:${m.id}`,
      coins: m.coins,
      condition: m.height === null ? 'rescued = 1' : `height >= ${m.height}`,
    })),
    {
      reference: `weekly:stack-v1:${week}`,
      coins: 100,
      condition: `week = ${week} AND height >= ${stackWeek(week).height}`,
    },
  ];
  return rewards.map((reward) =>
    db
      .prepare(`INSERT OR IGNORE INTO commerce_coin_ledger (account_id, reference, delta, created)
    SELECT account_id, ?, ?, ? FROM challenge_results WHERE run_id = ? AND game = 'stack-or-sink' AND rules = 1 AND ${reward.condition}
    AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND json_extract(state, '$.challengeCommit') = ?)`)
      .bind(reward.reference, reward.coins, now, run, room, commit),
  );
}
export async function readStackProgress(
  db: GameDatabase,
  accountId: string,
  now: number,
): Promise<StackProgress> {
  const week = stackWeek(now);
  const row = await db
    .prepare(`SELECT
    COALESCE((SELECT MAX(height) FROM challenge_results WHERE account_id = ? AND game = 'stack-or-sink' AND rules = 1), 0) AS height,
    (SELECT json_group_array(reference) FROM commerce_coin_ledger WHERE account_id = ? AND (reference LIKE 'mastery:stack-v1:%' OR reference = ?)) AS rewards`)
    .bind(accountId, accountId, `weekly:stack-v1:${week.start}`)
    .first<{ height: number; rewards: string }>();
  const rewards = JSON.parse(row?.rewards ?? '[]') as string[];
  return {
    week,
    weeklyComplete: rewards.includes(`weekly:stack-v1:${week.start}`),
    bestHeight: row?.height ?? 0,
    milestones: STACK_MASTERY.filter((m) =>
      rewards.includes(`mastery:stack-v1:${m.id}`),
    ).map((m) => m.id),
  };
}
