PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS lifecycle_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evidence_key TEXT NOT NULL UNIQUE,
  show_id INTEGER NOT NULL,
  season_id INTEGER,
  season_number INTEGER CHECK (season_number IS NULL OR season_number >= 0),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'renewed',
    'ordered',
    'cancelled',
    'final_season',
    'ended',
    'pre_production',
    'filming',
    'wrapped',
    'post_production',
    'production_paused',
    'premiere_dated',
    'delayed'
  )),
  source_id INTEGER NOT NULL,
  source_url TEXT NOT NULL,
  source_title TEXT,
  source_published_at TEXT,
  confidence TEXT NOT NULL DEFAULT 'official' CHECK (confidence IN ('official', 'high', 'normal', 'unverified')),
  evidence_note TEXT,
  is_retracted INTEGER NOT NULL DEFAULT 0 CHECK (is_retracted IN (0, 1)),
  retracted_at TEXT,
  retraction_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE SET NULL,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_show_date
  ON lifecycle_events(show_id, source_published_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_show_season
  ON lifecycle_events(show_id, season_number, event_type);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_active_type
  ON lifecycle_events(is_retracted, event_type, source_published_at DESC);

CREATE VIEW IF NOT EXISTS active_lifecycle_events AS
SELECT
  le.*,
  s.source_key,
  s.display_name AS source_name,
  s.source_type,
  s.trust_level,
  s.base_url AS source_base_url
FROM lifecycle_events le
JOIN sources s ON s.id = le.source_id
WHERE le.is_retracted = 0;

INSERT OR IGNORE INTO sources (
  source_key,
  source_type,
  display_name,
  base_url,
  trust_level,
  enabled
) VALUES (
  'apple_tv_press',
  'official_press',
  'Apple TV Press',
  'https://www.apple.com/tv-pr/',
  'official',
  1
);