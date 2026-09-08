PRAGMA foreign_keys = ON;

-- Phase 7B.2 registers AMC Global Media's current official press-release
-- permalink surface without mutating or removing the archival AMC Networks
-- source used by older evidence. The /20 prefix intentionally matches dated
-- press permalinks such as /2026/05/15/... while avoiding a broad site-root
-- whitelist.
INSERT OR IGNORE INTO sources (
  source_key,
  source_type,
  display_name,
  base_url,
  trust_level,
  enabled
) VALUES (
  'amc_global_media_press',
  'official_press',
  'AMC Global Media Press',
  'https://www.amcglobalmedia.com/20',
  'official',
  1
);

-- Real-source validation: The Walking Dead: Dead City season 3 premiere date.
-- Identity is fixed to the production Series Hub show ID and TMDB ID so the
-- migration fails closed (zero inserted rows) if catalog identity ever drifts.
INSERT OR IGNORE INTO lifecycle_events (
  evidence_key,
  show_id,
  season_id,
  season_number,
  event_type,
  source_id,
  source_url,
  source_title,
  source_published_at,
  confidence,
  evidence_note
)
SELECT
  'b0fea84fd2ac38eb59cd7bfe66be2a2bda3ff880b5db9a9085de470a5c2656f2',
  s.id,
  (
    SELECT se.id
    FROM seasons se
    WHERE se.show_id = s.id
      AND se.season_number = 3
    LIMIT 1
  ),
  3,
  'premiere_dated',
  src.id,
  'https://www.amcglobalmedia.com/2026/05/15/maggie-and-negan-unite-to-save-manhattan-in-new-action-packed-teaser-for-season-three-of-the-walking-dead-dead-city/',
  'Maggie and Negan Unite to Save Manhattan in New Action-Packed Teaser for Season Three of The Walking Dead: Dead City',
  '2026-05-15',
  'official',
  'AMC Global Media officially dated The Walking Dead: Dead City season 3 for July 26, 2026.'
FROM shows s
JOIN sources src
  ON src.source_key = 'amc_global_media_press'
 AND src.trust_level = 'official'
 AND src.enabled = 1
WHERE s.id = 1980
  AND s.tmdb_id = 194583;
