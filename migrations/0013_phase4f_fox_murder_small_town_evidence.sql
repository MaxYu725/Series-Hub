PRAGMA foreign_keys = ON;

-- Phase 4F completes official-source acceptance with a current FOX scripted series.
-- The seed is guarded by the production Series Hub ID + stable TMDB ID and an
-- enabled official FOXFLASH source. Season 3 may not yet have a TMDB season row.

-- Murder in a Small Town — FOXFLASH, 2026-05-07.
INSERT OR IGNORE INTO lifecycle_events (
  evidence_key, show_id, season_id, season_number, event_type, source_id,
  source_url, source_title, source_published_at, confidence, evidence_note
)
SELECT
  '6f187c02de32779b755a304d305c671575390d77aea0df6c30157a830cd36be0',
  s.id,
  (SELECT se.id FROM seasons se WHERE se.show_id = s.id AND se.season_number = 3 LIMIT 1),
  3,
  'renewed',
  src.id,
  'https://www.foxflash.com/shows/murder-in-a-small-town/releases/print/fox-television-network-renews-murder-in-a-small-town-for-season-three',
  'FOX TELEVISION NETWORK RENEWS MURDER IN A SMALL TOWN FOR SEASON THREE',
  '2026-05-07',
  'official',
  'FOX renewed Murder in a Small Town for season three.'
FROM shows s
JOIN sources src ON src.source_key = 'fox_flash' AND src.trust_level = 'official' AND src.enabled = 1
WHERE s.id = 431 AND s.tmdb_id = 241549;
