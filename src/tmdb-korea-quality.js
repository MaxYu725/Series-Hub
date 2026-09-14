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

export function hasKoreanFictionGenre(details) {
  if (!Array.isArray(details?.genres)) return false;
  return details.genres.some((genre) => KOREA_FICTION_GENRE_ID_SET.has(Number(genre?.id)));
}

export function isIncludedKoreanCatalogSeries(details) {
  return isIncludedKoreanScriptedSeries(details) && hasKoreanFictionGenre(details);
}

async function pruneRejectedExistingKoreanCatalogSeries(db, tmdbIds) {
  let recordsPruned = 0;

  for (const tmdbId of tmdbIds) {
    const result = await db
      .prepare(
        `DELETE FROM shows
         WHERE tmdb_id = ?1
           AND (',' || COALESCE(origin_country, '') || ',') LIKE '%,KR,%'`
      )
      .bind(tmdbId)
      .run();
    recordsPruned += Number(result?.meta?.changes || 0);
  }

  return recordsPruned;
}

export async function syncTmdbKoreanCatalog(env, options = {}) {
  const callerIncludeDetails = typeof options.includeDetails === "function"
    ? options.includeDetails
    : null;
  const rejectedQualityTmdbIds = new Set();
  const includeDetails = (details) => {
    const qualityIncluded = isIncludedKoreanCatalogSeries(details);
    const tmdbId = Number(details?.id);
    if (!qualityIncluded && Number.isInteger(tmdbId) && tmdbId > 0) {
      rejectedQualityTmdbIds.add(tmdbId);
    }

    return qualityIncluded &&
      (!callerIncludeDetails || callerIncludeDetails(details));
  };

  const result = await syncBaseKoreanCatalog(env, {
    ...options,
    includeDetails
  });
  if (!result?.ok) return result;

  const recordsPruned = rejectedQualityTmdbIds.size
    ? await pruneRejectedExistingKoreanCatalogSeries(env.DB, rejectedQualityTmdbIds)
    : 0;

  return {
    ...result,
    recordsPruned,
    recordsAccepted: Number(result.recordsChanged || 0),
    qualityPolicy: "kr_scripted_with_fiction_genre_prewrite_with_stale_cleanup"
  };
}
