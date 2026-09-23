import type { GameDatabase } from '../../../db/contract';

export type CrewRecords = {
  rankedRuns: number;
  bestTowerCm: number;
  towerAce: number;
  skylineCrown: number;
};

/** Only completed, server-verified runs with the full frozen roster count. */
export async function readCrewRecords(
  db: GameDatabase,
  crewId: string,
): Promise<CrewRecords> {
  const row = await db
    .prepare(`WITH complete_runs AS (
      SELECT r.run_id, MAX(a.height_cm) AS height_cm
      FROM ranked_crew_runs r
      JOIN ranked_attempts a ON a.run_id = r.run_id AND a.eligible = 1
      WHERE r.crew_id = ?
      GROUP BY r.run_id, r.team_size
      HAVING COUNT(*) = r.team_size
    ) SELECT COUNT(*) AS rankedRuns,
      COALESCE(MAX(height_cm), 0) AS bestTowerCm FROM complete_runs`)
    .bind(crewId)
    .first<CrewRecords>();
  const trophies = await db
    .prepare(`WITH crew_brackets AS (
      SELECT DISTINCT week, team_size FROM ranked_crew_runs WHERE crew_id = ?
    ), eligible_runs AS (
      SELECT r.crew_id, r.run_id, r.week, r.team_size,
        MAX(a.height_cm) AS height_cm, MIN(a.completed) AS completed
      FROM ranked_crew_runs r
      JOIN crew_brackets b ON b.week = r.week AND b.team_size = r.team_size
      JOIN ranked_attempts a ON a.run_id = r.run_id AND a.eligible = 1
      GROUP BY r.run_id
      HAVING COUNT(*) = r.team_size
    ), best_runs AS (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY week, team_size, crew_id
        ORDER BY height_cm DESC, completed, run_id
      ) AS choice FROM eligible_runs
    ), placed AS (
      SELECT crew_id, week, team_size,
        RANK() OVER (PARTITION BY week, team_size ORDER BY height_cm DESC) AS place,
        COUNT(*) OVER (PARTITION BY week, team_size) AS population
      FROM best_runs WHERE choice = 1
    ) SELECT
      COALESCE(SUM(CASE WHEN p.place <= (p.population + 9) / 10 THEN 1 ELSE 0 END), 0) AS towerAce,
      COALESCE(SUM(CASE WHEN p.place <= (p.population + 99) / 100 THEN 1 ELSE 0 END), 0) AS skylineCrown
    FROM placed p JOIN ranked_crew_finalizations f
      ON f.week = p.week AND f.team_size = p.team_size
    WHERE p.crew_id = ? AND p.population >= 100`)
    .bind(crewId, crewId)
    .first<Pick<CrewRecords, 'towerAce' | 'skylineCrown'>>();
  return {
    rankedRuns: row?.rankedRuns ?? 0,
    bestTowerCm: row?.bestTowerCm ?? 0,
    towerAce: trophies?.towerAce ?? 0,
    skylineCrown: trophies?.skylineCrown ?? 0,
  };
}
