PRAGMA foreign_keys = ON;

-- Phase 10D extends the existing lifecycle evidence whitelist to official
-- publishers that can anchor Korean renewal and production evidence.
-- Registration does not enable automatic scraping; evidence ingestion remains
-- protected and editorial through the existing lifecycle workflow/API.
INSERT OR IGNORE INTO sources (
  source_key,
  source_type,
  display_name,
  base_url,
  trust_level,
  enabled
) VALUES
  (
    'sbs_news',
    'official_press',
    'SBS News',
    'https://news.sbs.co.kr/news/',
    'official',
    1
  ),
  (
    'netflix_about_news',
    'official_press',
    'Netflix About News',
    'https://about.netflix.com/en/news/',
    'official',
    1
  );
