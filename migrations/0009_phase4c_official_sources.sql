PRAGMA foreign_keys = ON;

-- Phase 4C expands the editorial evidence whitelist only.
-- These sources remain manual/browser-operated until a later collector phase proves
-- that their public page structure is stable enough for safe automation.
INSERT OR IGNORE INTO sources (
  source_key,
  source_type,
  display_name,
  base_url,
  trust_level,
  enabled
) VALUES
  (
    'wbd_pressroom',
    'official_press',
    'Warner Bros. Discovery Pressroom',
    'https://press.wbd.com/',
    'official',
    1
  ),
  (
    'amazon_entertainment',
    'official_press',
    'Amazon Entertainment',
    'https://www.aboutamazon.com/news/entertainment/',
    'official',
    1
  ),
  (
    'netflix_media_center',
    'official_press',
    'Netflix Media Center',
    'https://media.netflix.com/',
    'official',
    1
  ),
  (
    'fox_flash',
    'official_press',
    'FOXFLASH',
    'https://www.foxflash.com/',
    'official',
    1
  );