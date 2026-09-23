ALTER TABLE ranked_attempts ADD COLUMN service_voided INTEGER NOT NULL DEFAULT 0 CHECK(service_voided IN (0, 1));

CREATE TABLE ranked_run_reviews (
  run_id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('review', 'service')),
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  created INTEGER NOT NULL
);
