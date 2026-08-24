PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS shows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_title TEXT NOT NULL,
  original_language TEXT,
  origin_country TEXT,
  overview TEXT,
  first_air_date TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  poster_url TEXT,
  backdrop_url TEXT,
  tmdb_id INTEGER UNIQUE,
  tvmaze_id INTEGER UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL,
  season_number INTEGER NOT NULL CHECK (season_number >= 0),
  name TEXT,
  overview TEXT,
  premiere_date TEXT,
  finale_date TEXT,
  episode_count INTEGER CHECK (episode_count IS NULL OR episode_count >= 0),
  lifecycle_status TEXT NOT NULL DEFAULT 'unknown',
  production_status TEXT,
  tmdb_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
  UNIQUE (show_id, season_number)
);

CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  episode_number INTEGER NOT NULL CHECK (episode_number >= 0),
  name TEXT,
  overview TEXT,
  air_date TEXT,
  air_time TEXT,
  runtime_minutes INTEGER CHECK (runtime_minutes IS NULL OR runtime_minutes >= 0),
  tmdb_id INTEGER,
  tvmaze_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  UNIQUE (season_id, episode_number)
);

CREATE TABLE IF NOT EXISTS title_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL,
  season_id INTEGER,
  locale TEXT NOT NULL,
  region TEXT,
  title TEXT NOT NULL,
  source_key TEXT,
  is_preferred INTEGER NOT NULL DEFAULT 0 CHECK (is_preferred IN (0, 1)),
  confidence TEXT NOT NULL DEFAULT 'normal',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_name TEXT NOT NULL UNIQUE,
  provider_type TEXT NOT NULL DEFAULT 'streaming',
  tmdb_provider_id INTEGER UNIQUE,
  homepage_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL,
  season_id INTEGER,
  provider_id INTEGER NOT NULL,
  region TEXT NOT NULL,
  availability_type TEXT NOT NULL DEFAULT 'stream',
  source_key TEXT,
  source_url TEXT,
  observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  UNIQUE (show_id, season_id, provider_id, region, availability_type)
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  base_url TEXT,
  trust_level TEXT NOT NULL DEFAULT 'normal',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  records_seen INTEGER NOT NULL DEFAULT 0,
  records_changed INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shows_status ON shows(status);
CREATE INDEX IF NOT EXISTS idx_shows_updated_at ON shows(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_seasons_show_status ON seasons(show_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_seasons_premiere_date ON seasons(premiere_date);
CREATE INDEX IF NOT EXISTS idx_episodes_season_air_date ON episodes(season_id, air_date);
CREATE INDEX IF NOT EXISTS idx_aliases_show_locale ON title_aliases(show_id, locale, region);
CREATE INDEX IF NOT EXISTS idx_availability_show_region ON availability(show_id, region);
CREATE INDEX IF NOT EXISTS idx_sync_runs_source_started ON sync_runs(source_id, started_at DESC);
