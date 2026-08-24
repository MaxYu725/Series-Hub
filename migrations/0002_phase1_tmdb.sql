ALTER TABLE shows ADD COLUMN english_title TEXT;
ALTER TABLE shows ADD COLUMN series_type TEXT;
ALTER TABLE shows ADD COLUMN tmdb_status TEXT;
ALTER TABLE shows ADD COLUMN popularity REAL;
ALTER TABLE shows ADD COLUMN vote_average REAL;
ALTER TABLE shows ADD COLUMN vote_count INTEGER;
ALTER TABLE shows ADD COLUMN homepage_url TEXT;
ALTER TABLE shows ADD COLUMN last_air_date TEXT;
ALTER TABLE shows ADD COLUMN next_air_date TEXT;
ALTER TABLE shows ADD COLUMN number_of_seasons INTEGER;
ALTER TABLE shows ADD COLUMN number_of_episodes INTEGER;
ALTER TABLE shows ADD COLUMN in_production INTEGER NOT NULL DEFAULT 0 CHECK (in_production IN (0, 1));
ALTER TABLE shows ADD COLUMN last_synced_at TEXT;

CREATE TABLE IF NOT EXISTS networks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_network_id INTEGER NOT NULL UNIQUE,
  canonical_name TEXT NOT NULL,
  origin_country TEXT,
  logo_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS show_networks (
  show_id INTEGER NOT NULL,
  network_id INTEGER NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  PRIMARY KEY (show_id, network_id),
  FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
  FOREIGN KEY (network_id) REFERENCES networks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS genres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_genre_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS show_genres (
  show_id INTEGER NOT NULL,
  genre_id INTEGER NOT NULL,
  PRIMARY KEY (show_id, genre_id),
  FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
  FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shows_lifecycle_popularity
  ON shows(status, popularity DESC);
CREATE INDEX IF NOT EXISTS idx_shows_next_air_date
  ON shows(next_air_date);
CREATE INDEX IF NOT EXISTS idx_show_networks_show
  ON show_networks(show_id);
CREATE INDEX IF NOT EXISTS idx_show_genres_show
  ON show_genres(show_id);

INSERT OR IGNORE INTO sources (
  source_key,
  source_type,
  display_name,
  base_url,
  trust_level,
  enabled
) VALUES (
  'tmdb',
  'metadata_api',
  'TMDB',
  'https://api.themoviedb.org/3',
  'normal',
  1
);
