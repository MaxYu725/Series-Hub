PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO sources (
  source_key,
  source_type,
  display_name,
  base_url,
  trust_level,
  enabled
) VALUES (
  'tmdb_kr',
  'metadata_api',
  'TMDB · Korea',
  'https://api.themoviedb.org/3',
  'normal',
  1
);
