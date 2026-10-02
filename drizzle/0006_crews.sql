CREATE TABLE crews (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  emblem TEXT NOT NULL,
  owner_member_id TEXT,
  invite_hash TEXT UNIQUE,
  invite_expires INTEGER,
  created INTEGER NOT NULL,
  archived INTEGER
);
CREATE TABLE crew_members (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  crew_id TEXT NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE,
  seat INTEGER NOT NULL CHECK (seat BETWEEN 0 AND 7),
  joined INTEGER NOT NULL,
  UNIQUE (crew_id, seat)
);
CREATE INDEX crew_members_crew_idx ON crew_members(crew_id);
CREATE TRIGGER crew_member_departure AFTER DELETE ON crew_members
BEGIN
  UPDATE crews SET invite_hash = NULL, invite_expires = NULL WHERE id = OLD.crew_id;
  UPDATE crews SET owner_member_id = (
    SELECT public_id FROM crew_members WHERE crew_id = OLD.crew_id ORDER BY joined, seat LIMIT 1
  ), invite_hash = NULL, invite_expires = NULL
  WHERE id = OLD.crew_id AND owner_member_id = OLD.public_id;
  UPDATE crews SET archived = COALESCE(archived, unixepoch() * 1000), invite_hash = NULL, invite_expires = NULL
  WHERE id = OLD.crew_id AND NOT EXISTS (SELECT 1 FROM crew_members WHERE crew_id = OLD.crew_id);
END;
