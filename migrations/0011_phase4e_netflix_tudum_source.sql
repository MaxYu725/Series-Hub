PRAGMA foreign_keys = ON;

-- Netflix Media Center remains a valid official catalogue/property source, but
-- dated lifecycle announcements are also published through Netflix Tudum.
-- Register Tudum separately so provenance and URL-path validation remain exact.
INSERT OR IGNORE INTO sources (
  source_key,
  source_type,
  display_name,
  base_url,
  trust_level,
  enabled
) VALUES (
  'netflix_tudum',
  'official_news',
  'Netflix Tudum',
  'https://www.netflix.com/tudum/',
  'official',
  1
);
