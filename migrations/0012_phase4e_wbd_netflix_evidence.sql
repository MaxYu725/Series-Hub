PRAGMA foreign_keys = ON;

-- Phase 4E expands live multi-source acceptance to WBD/HBO and Netflix Tudum.
-- Every seed is guarded by the production Series Hub ID + stable TMDB ID and
-- an enabled official source. Future-season evidence may exist before a season row.

-- House of the Dragon — HBO/WBD Pressroom, 2025-11-20.
INSERT OR IGNORE INTO lifecycle_events (
  evidence_key, show_id, season_id, season_number, event_type, source_id,
  source_url, source_title, source_published_at, confidence, evidence_note
)
SELECT
  '763cc511b8472f6320ab0f998d66165fd61f09491552c45a4185a87ef1712b9c',
  s.id,
  (SELECT se.id FROM seasons se WHERE se.show_id = s.id AND se.season_number = 4 LIMIT 1),
  4,
  'renewed',
  src.id,
  'https://press.wbd.com/na/media-release/hbo-0/hbo-announces-season-renewals-two-game-thrones-franchise-series-setting-new-seasons',
  'HBO Announces Season Renewals For Two “Game of Thrones” Franchise Series, Setting New Seasons Each Year Through 2028',
  '2025-11-20',
  'official',
  'HBO renewed House of the Dragon for season four.'
FROM shows s
JOIN sources src ON src.source_key = 'wbd_pressroom' AND src.trust_level = 'official' AND src.enabled = 1
WHERE s.id = 7 AND s.tmdb_id = 94997;

-- Wednesday — Netflix Tudum decision evidence, 2026-04-20.
INSERT OR IGNORE INTO lifecycle_events (
  evidence_key, show_id, season_id, season_number, event_type, source_id,
  source_url, source_title, source_published_at, confidence, evidence_note
)
SELECT
  'e52b580d5d65c36ea19d4e386ce3d6ddc64f605aa05f3e60fae654f74cd95c65',
  s.id,
  (SELECT se.id FROM seasons se WHERE se.show_id = s.id AND se.season_number = 3 LIMIT 1),
  3,
  'renewed',
  src.id,
  'https://www.netflix.com/tudum/articles/wednesday-season-3-release-date',
  'Wednesday Season 3 Renewed and Heading to Paris: Creators Preview Future Episodes, Photos, Cast',
  '2026-04-20',
  'official',
  'Netflix confirms Wednesday will return for season three.'
FROM shows s
JOIN sources src ON src.source_key = 'netflix_tudum' AND src.trust_level = 'official' AND src.enabled = 1
WHERE s.id = 66 AND s.tmdb_id = 119051;

-- Wednesday — Netflix Tudum production evidence, 2026-02-23.
INSERT OR IGNORE INTO lifecycle_events (
  evidence_key, show_id, season_id, season_number, event_type, source_id,
  source_url, source_title, source_published_at, confidence, evidence_note
)
SELECT
  'a9ac1f8d2635343890726de3cf3bd35291a51523e8c9f43dd58768d3a91d1f49',
  s.id,
  (SELECT se.id FROM seasons se WHERE se.show_id = s.id AND se.season_number = 3 LIMIT 1),
  3,
  'filming',
  src.id,
  'https://www.netflix.com/tudum/articles/wednesday-season-3-start-of-production',
  'Wednesday Season 3 Starts Production with New Cast Members Winona Ryder and More',
  '2026-02-23',
  'official',
  'Netflix states production is officially underway on season three.'
FROM shows s
JOIN sources src ON src.source_key = 'netflix_tudum' AND src.trust_level = 'official' AND src.enabled = 1
WHERE s.id = 66 AND s.tmdb_id = 119051;
