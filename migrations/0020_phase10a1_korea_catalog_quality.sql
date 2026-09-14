PRAGMA foreign_keys = ON;

-- Phase 10A.1: remove Korean catalog rows that do not carry any TMDB
-- fiction genre. This is an objective metadata cleanup, not a title/ID blacklist.
-- Foreign-key cascades remove dependent aliases, networks, seasons and episodes.
DELETE FROM shows
WHERE tmdb_id IS NOT NULL
  AND (',' || COALESCE(origin_country, '') || ',') LIKE '%,KR,%'
  AND NOT EXISTS (
    SELECT 1
    FROM show_genres sg
    JOIN genres g ON g.id = sg.genre_id
    WHERE sg.show_id = shows.id
      AND g.tmdb_genre_id IN (
        18,    -- Drama
        35,    -- Comedy
        37,    -- Western
        80,    -- Crime
        9648,  -- Mystery
        10751, -- Family
        10759, -- Action & Adventure
        10765, -- Sci-Fi & Fantasy
        10766, -- Soap
        10768  -- War & Politics
      )
  );
