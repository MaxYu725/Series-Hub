import {
  isIncludedUsScriptedSeries,
  isTargetNetworkSeries,
  normalizeLifecycle
} from "./tmdb.js";
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
const ACTIVE_CATALOG_STATUSES = new Set(["airing", "upcoming", "planned"]);

export function hasKoreanFictionGenre(details) {
  if (!Array.isArray(details?.genres)) return false;
  return details.genres.some((genre) => KOREA_FICTION_GENRE_ID_SET.has(Number(genre?.id)));
}

export function isIncludedKoreanCatalogSeries(details) {
  return isIncludedKoreanScriptedSeries(details) && hasKoreanFictionGenre(details);
}

export function isEligibleForUsCatalog(details, now = new Date()) {
  return isIncludedUsScriptedSeries(details) &&
    isTargetNetworkSeries(details) &&
    ACTIVE_CATALOG_STATUSES.has(normalizeLifecycle(details, now).status);
}

async function pruneRejectedExistingKoreanCatalogSeries(db, details, now) {
  if (isEligibleForUsCatalog(details, now)) return 0;

  const tmdbId = Number(details?.id);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return 0;

  const result = await db
    .prepare(
      `DELETE FROM shows
       WHERE tmdb_id = ?1
         AND (',' || COALESCE(origin_country, '') || ',') LIKE '%,KR,%'`
    )
    .bind(tmdbId)
    .run();

  return Number(result?.meta?.changes || 0);
}

export async function syncTmdbKoreanCatalog(env, options = {}) {
  const callerIncludeDetails = typeof options.includeDetails === "function"
    ? options.includeDetails
    : null;
  const callerOnRejectedDetails = typeof options.onRejectedDetails === "function"
    ? options.onRejectedDetails
    : null;
  const qualityNow = options.now instanceof Date && Number.isFinite(options.now.getTime())
    ? options.now
    : new Date();
  let recordsPruned = 0;

  const includeDetails = (details) =>
    isIncludedKoreanCatalogSeries(details) &&
    (!callerIncludeDetails || callerIncludeDetails(details));

  const onRejectedDetails = async (details, db) => {
    if (!isIncludedKoreanCatalogSeries(details)) {
      recordsPruned += await pruneRejectedExistingKoreanCatalogSeries(db, details, qualityNow);
    }
    if (callerOnRejectedDetails) await callerOnRejectedDetails(details, db);
  };

  const result = await syncBaseKoreanCatalog(env, {
    ...options,
    includeDetails,
    onRejectedDetails
  });
  if (!result?.ok) return result;

  return {
    ...result,
    recordsPruned,
    recordsAccepted: Number(result.recordsChanged || 0),
    qualityPolicy: "kr_scripted_with_fiction_genre_prewrite_with_stale_cleanup"
  };
}
