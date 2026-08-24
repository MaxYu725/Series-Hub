PRAGMA foreign_keys = ON;

ALTER TABLE shows ADD COLUMN imdb_id TEXT;
ALTER TABLE shows ADD COLUMN thetvdb_id INTEGER;
ALTER TABLE shows ADD COLUMN tvmaze_synced_at TEXT;

ALTER TABLE episodes ADD COLUMN air_timestamp TEXT;
ALTER TABLE episodes ADD COLUMN image_url TEXT;
ALTER TABLE episodes ADD COLUMN source_url TEXT;
ALTER TABLE episodes ADD COLUMN last_synced_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shows_imdb_id
  ON shows(imdb_id)
  WHERE imdb_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shows_thetvdb_id
  ON shows(thetvdb_id)
  WHERE thetvdb_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_episodes_tvmaze_id
  ON episodes(tvmaze_id)
  WHERE tvmaze_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_episodes_air_date_time
  ON episodes(air_date, air_time);

CREATE INDEX IF NOT EXISTS idx_shows_tvmaze_sync
  ON shows(status, tvmaze_synced_at);

INSERT OR IGNORE INTO sources (
  source_key,
  source_type,
  display_name,
  base_url,
  trust_level,
  enabled
) VALUES (
  'tvmaze',
  'schedule_api',
  'TVmaze',
  'https://api.tvmaze.com',
  'normal',
  1
);
