CREATE TABLE challenge_members (
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (room_code, player_id),
  UNIQUE (room_code, account_id)
);
CREATE INDEX challenge_members_account_idx ON challenge_members(account_id);

CREATE TABLE challenge_results (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  game TEXT NOT NULL,
  rules INTEGER NOT NULL,
  week INTEGER NOT NULL,
  height REAL NOT NULL CHECK(height >= 0),
  rescued INTEGER NOT NULL CHECK(rescued IN (0, 1)),
  completed INTEGER NOT NULL,
  PRIMARY KEY (account_id, run_id)
);
