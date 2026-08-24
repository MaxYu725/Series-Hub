PRAGMA foreign_keys = ON;

DELETE FROM shows
WHERE tmdb_id IS NOT NULL
  AND id IN (
    SELECT DISTINCT sg.show_id
    FROM show_genres AS sg
    JOIN genres AS g ON g.id = sg.genre_id
    WHERE g.tmdb_genre_id IN (16, 99, 10762, 10763, 10764, 10767)
  );
