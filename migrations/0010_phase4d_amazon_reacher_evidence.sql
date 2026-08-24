PRAGMA foreign_keys = ON;

-- Phase 4D live acceptance for the first non-Apple source.
-- Production identity was resolved read-only before this migration:
-- Series Hub show ID 1 / TMDB 108978.
-- The SHA-256 evidence key matches src/lifecycle.js exactly.
INSERT OR IGNORE INTO lifecycle_events (
  evidence_key, show_id, season_id, season_number, event_type, source_id,
  source_url, source_title, source_published_at, confidence, evidence_note
)
SELECT
  '13558ece6ebddff8d901a61e00be38e34ad5e4600c493e12ad639946b4549090',
  s.id,
  (SELECT se.id FROM seasons se WHERE se.show_id = s.id AND se.season_number = 5 LIMIT 1),
  5,
  'renewed',
  (SELECT id FROM sources WHERE source_key = 'amazon_entertainment' LIMIT 1),
  'https://www.aboutamazon.com/news/entertainment/prime-video-reacher-how-to-watch',
  'How to watch ‘Reacher’ Season 4, streaming now on Prime Video',
  '2026-05-11',
  'official',
  'Prime Video states that Reacher has already been renewed for season five.'
FROM shows s
WHERE s.id = 1 AND s.tmdb_id = 108978
  AND EXISTS (
    SELECT 1 FROM sources src
    WHERE src.source_key = 'amazon_entertainment'
      AND src.trust_level = 'official'
      AND src.enabled = 1
  );