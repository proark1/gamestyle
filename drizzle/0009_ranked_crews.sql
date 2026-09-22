-- A crew run records one persistent crew and its start-time roster through ranked_attempts.
CREATE TABLE ranked_crew_runs (
  run_id TEXT PRIMARY KEY NOT NULL,
  crew_id TEXT NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  team_size INTEGER NOT NULL CHECK(team_size BETWEEN 1 AND 4)
);
CREATE INDEX ranked_crew_runs_board_idx ON ranked_crew_runs(week, team_size, crew_id);

-- One account represents one crew in this challenge each week, even after a transfer.
CREATE TABLE ranked_crew_locks (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  crew_id TEXT NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  PRIMARY KEY (account_id, week)
);
CREATE INDEX ranked_crew_locks_crew_idx ON ranked_crew_locks(crew_id, week);

-- Public board labels are stable but do not reveal user-entered crew names.
CREATE TABLE ranked_crew_tags (
  crew_id TEXT PRIMARY KEY NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  tag TEXT NOT NULL UNIQUE
);

CREATE TABLE ranked_crew_finalizations (
  week INTEGER NOT NULL,
  team_size INTEGER NOT NULL CHECK(team_size BETWEEN 1 AND 4),
  commit_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (week, team_size)
);
