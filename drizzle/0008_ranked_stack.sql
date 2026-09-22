-- Ranked attempts are separate from unlimited verified challenge results.
CREATE TABLE ranked_tags (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL UNIQUE
);

CREATE TABLE ranked_attempts (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  week INTEGER NOT NULL,
  room_code TEXT NOT NULL,
  player_id TEXT NOT NULL,
  team_size INTEGER NOT NULL CHECK(team_size BETWEEN 1 AND 4),
  started INTEGER NOT NULL,
  eligible INTEGER NOT NULL DEFAULT 0 CHECK(eligible IN (0, 1)),
  height_cm INTEGER NOT NULL DEFAULT 0 CHECK(height_cm >= 0),
  completed INTEGER,
  PRIMARY KEY (account_id, run_id),
  UNIQUE (room_code, account_id)
);
CREATE INDEX ranked_attempts_account_week_idx ON ranked_attempts(account_id, week);
CREATE INDEX ranked_attempts_board_idx ON ranked_attempts(week, team_size, eligible, height_cm);

CREATE TABLE ranked_finalizations (
  week INTEGER NOT NULL,
  team_size INTEGER NOT NULL CHECK(team_size BETWEEN 1 AND 4),
  commit_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (week, team_size)
);

-- SQLite cannot widen a CHECK constraint in place. No table references grants.
CREATE TABLE commerce_grants_ranked (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('starter', 'legacy', 'coins', 'purchase', 'reward')),
  reference TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('live', 'sandbox')),
  created INTEGER NOT NULL,
  PRIMARY KEY (account_id, item_id, source, reference, environment)
);
INSERT INTO commerce_grants_ranked SELECT * FROM commerce_grants;
DROP TABLE commerce_grants;
ALTER TABLE commerce_grants_ranked RENAME TO commerce_grants;
