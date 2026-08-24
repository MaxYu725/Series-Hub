-- Phase 1B live-data cleanup.
-- Keep TMDB rows only when they belong to the current US scripted MVP lifecycle
-- and at least one target network/service. Future syncs apply the same policy.

DELETE FROM shows
WHERE tmdb_id IS NOT NULL
  AND (
    status NOT IN ('airing', 'upcoming', 'planned')
    OR NOT EXISTS (
      SELECT 1
      FROM show_networks sn
      JOIN networks n ON n.id = sn.network_id
      WHERE sn.show_id = shows.id
        AND LOWER(n.canonical_name) IN (
          'abc',
          'amc',
          'amc+',
          'amazon',
          'amazon prime video',
          'apple tv',
          'apple tv+',
          'cbs',
          'disney+',
          'fox',
          'fx',
          'fxx',
          'freeform',
          'hbo',
          'hbo max',
          'hulu',
          'max',
          'mgm+',
          'nbc',
          'netflix',
          'paramount+',
          'peacock',
          'prime video',
          'showtime',
          'starz',
          'syfy',
          'the cw',
          'usa network'
        )
    )
  );
