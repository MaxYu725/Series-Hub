PRAGMA foreign_keys = ON;

-- Phase 7B.1 validates each newly registered official publisher with one
-- identity-guarded lifecycle event from a show already present in production.

-- Paramount Press Express: Tulsa King season 4 premiere date.
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
  '8c860fa6c3896fc8571a067fe6d0938229acfee302745d8fa88c9a03a19bcbee',
  s.id,
  (
    SELECT se.id
    FROM seasons se
    WHERE se.show_id = s.id
      AND se.season_number = 4
    LIMIT 1
  ),
  4,
  'premiere_dated',
  src.id,
  'https://www.paramountpressexpress.com/paramount-television-studios/shows/tulsa-king/releases/?view=113200-tulsa-king-season-four-premieres-october-16-on-paramount',
  'TULSA KING SEASON FOUR PREMIERES OCTOBER 16 ON PARAMOUNT+',
  '2026-09-01',
  'official',
  'Paramount+ officially dated Tulsa King season 4 for October 16, 2026.'
FROM shows s
JOIN sources src
  ON src.source_key = 'paramount_press_express'
 AND src.trust_level = 'official'
 AND src.enabled = 1
WHERE s.id = 1711
  AND s.tmdb_id = 153312;

-- NBCUniversal Newsroom: Chicago Fire season 15 renewal.
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
  '105b97190dc6ac61bfa46207b6dfa5ecb86cd8e8338acb15d2ce864228624114',
  s.id,
  (
    SELECT se.id
    FROM seasons se
    WHERE se.show_id = s.id
      AND se.season_number = 15
    LIMIT 1
  ),
  15,
  'renewed',
  src.id,
  'https://www.nbcuniversal.com/article/nbc-renews-one-chicago-franchise-continuing-long-running-production-illinois',
  'NBC Renews ''One Chicago'' Franchise, Continuing Long-Running Production in Illinois',
  '2026-04-10',
  'official',
  'NBCUniversal officially renewed Chicago Fire for season 15 as part of the One Chicago 2026-27 renewal.'
FROM shows s
JOIN sources src
  ON src.source_key = 'nbcuniversal_newsroom'
 AND src.trust_level = 'official'
 AND src.enabled = 1
WHERE s.id = 40
  AND s.tmdb_id = 44006;

-- The Walt Disney Company Newsroom: Shogun future-season commitment.
-- Disney stated that FX, Hulu and the James Clavell estate were moving forward
-- to develop two additional seasons while production timing was not yet locked.
-- Represent this conservatively as a season 2 order, not as filming evidence.
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
  '683cc10d987e400cba5f762e43e9523b03bd4ab5fc6be29e17a0bcdb6ae1cb83',
  s.id,
  (
    SELECT se.id
    FROM seasons se
    WHERE se.show_id = s.id
      AND se.season_number = 2
    LIMIT 1
  ),
  2,
  'ordered',
  src.id,
  'https://thewaltdisneycompany.com/news/shogun-more-seasons-fx-hulu-james-clavell/',
  '''Shogun'': FX, Hulu and the James Clavell Estate are Working to Create More Seasons of the Critically Acclaimed Global Hit',
  '2024-05-16',
  'official',
  'Disney announced development of two additional Shogun seasons; stored conservatively as a season 2 order because production timing was not yet locked.'
FROM shows s
JOIN sources src
  ON src.source_key = 'disney_newsroom'
 AND src.trust_level = 'official'
 AND src.enabled = 1
WHERE s.id = 1067
  AND s.tmdb_id = 126308;

-- AMC Networks Press Releases: The Walking Dead: Dead City season 2 premiere date.
-- The archival amcnetworks.com URL remains the registered identity-safe source
-- even though it now redirects to AMC Global Media after the 2026 corporate move.
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
  'b5e523f63617812e943db547cd12cd2bfe626ba938b95a8008c1fafa4c71fdfe',
  s.id,
  (
    SELECT se.id
    FROM seasons se
    WHERE se.show_id = s.id
      AND se.season_number = 2
    LIMIT 1
  ),
  2,
  'premiere_dated',
  src.id,
  'https://www.amcnetworks.com/press-releases/amc-networks-announces-may-4-return-for-the-walking-dead-dead-city-and-debuts-opening-minutes-from-the-highly-anticipated-season-two-premiere-episode/',
  'AMC Networks Announces May 4 Return For The Walking Dead: Dead City And Debuts Opening Minutes From The Highly Anticipated Season Two Premiere Episode',
  '2025-02-25',
  'official',
  'AMC Networks officially dated The Walking Dead: Dead City season 2 for May 4, 2025.'
FROM shows s
JOIN sources src
  ON src.source_key = 'amc_networks_press'
 AND src.trust_level = 'official'
 AND src.enabled = 1
WHERE s.id = 1980
  AND s.tmdb_id = 194583;
