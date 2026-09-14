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

export async function syncTmdbKoreanCatalog(env, options = {}) {
  const callerIncludeDetails = typeof options.includeDetails === "function"
    ? options.includeDetails
    : null;
  const includeDetails = (details) =>
    isIncludedKoreanCatalogSeries(details) &&
    (!callerIncludeDetails || callerIncludeDetails(details));

  const result = await syncBaseKoreanCatalog(env, {
    ...options,
    includeDetails
  });
  if (!result?.ok) return result;

  return {
    ...result,
    recordsPruned: 0,
    recordsAccepted: Number(result.recordsChanged || 0),
    qualityPolicy: "kr_scripted_with_fiction_genre_prewrite"
  };
}
