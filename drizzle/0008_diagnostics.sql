CREATE TABLE analytics_diagnostics (
  id TEXT PRIMARY KEY NOT NULL,
  game TEXT NOT NULL,
  delivery INTEGER NOT NULL,
  started INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  platform TEXT NOT NULL,
  engine TEXT NOT NULL,
  release TEXT NOT NULL,
  summary TEXT NOT NULL
);
CREATE INDEX analytics_diagnostics_started_idx ON analytics_diagnostics(started);
CREATE INDEX analytics_diagnostics_game_started_idx ON analytics_diagnostics(game, started);
CREATE INDEX analytics_diagnostics_updated_idx ON analytics_diagnostics(updated);
