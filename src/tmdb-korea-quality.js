import {
  isIncludedKoreanScriptedSeries,
  syncTmdbKoreanCatalog as syncBaseKoreanCatalog
} from "./tmdb-korea.js";

export const KOREA_FICTION_GENRE_IDS = Object.freeze([
  18,    // Drama
  35,    // Comedy
  37,    // Western
  80,    // Crime
  9648,  // Mystery
  10751, // Family
  10759, // Action & Adventure
  10765, // Sci-Fi & Fantasy
  10766, // Soap
  10768  // War & Politics
]);

const KOREA_FICTION_GENRE_ID_SET = new Set(KOREA_FICTION_GENRE_IDS);
const KOREA_FICTION_GENRE_SQL = KOREA_FICTION_GENRE_IDS.join(", ");

export function hasKoreanFictionGenre(details) {
  if (!Array.isArray(details?.genres)) return false;
  return details.genres.some((genre) => KOREA_FICTION_GENRE_ID_SET.has(Number(genre?.id)));
}

export function isIncludedKoreanCatalogSeries(details) {
  return isIncludedKoreanScriptedSeries(details) && hasKoreanFictionGenre(details);
}

export async function pruneNonFictionKoreanCatalog(db, syncedSince) {
  if (!db || !syncedSince) return 0;

  const result = await db
    .prepare(
      `DELETE FROM shows
       WHERE tmdb_id IS NOT NULL
         AND (',' || COALESCE(origin_country, '') || ',') LIKE '%,KR,%'
         AND last_synced_at >= ?1
         AND NOT EXISTS (
           SELECT 1
           FROM show_genres sg
           JOIN genres g ON g.id = sg.genre_id
           WHERE sg.show_id = shows.id
             AND g.tmdb_genre_id IN (${KOREA_FICTION_GENRE_SQL})
         )`
    )
    .bind(syncedSince)
    .run();

  return Number(result?.meta?.changes || 0);
}

export async function syncTmdbKoreanCatalog(env, options = {}) {
  const marker = env?.DB
    ? await env.DB.prepare("SELECT CURRENT_TIMESTAMP AS started_at").first()
    : null;
  const result = await syncBaseKoreanCatalog(env, options);
  if (!result?.ok || !env?.DB || !marker?.started_at) return result;

  const recordsPruned = await pruneNonFictionKoreanCatalog(env.DB, marker.started_at);
  return {
    ...result,
    recordsPruned,
    recordsAccepted: Math.max(Number(result.recordsChanged || 0) - recordsPruned, 0),
    qualityPolicy: "kr_scripted_with_fiction_genre"
  };
}
