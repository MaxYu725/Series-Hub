import {
  candidateRotationOffset,
  hasExcludedGenre,
  networkCandidateRotationOffset,
  networkDiscoveryPage,
  networkDiscoveryParams,
  normalizeTmdbSeries,
  selectNetworkSeedsForSync,
  selectRoundRobinCandidates
} from "./tmdb.js";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const INCLUDED_TYPES = new Set(["Scripted", "Miniseries"]);
const ACTIVE_CATALOG_STATUSES = new Set(["airing", "upcoming", "planned"]);
const EXCLUDED_GENRE_IDS = new Set([16, 99, 10762, 10763, 10764, 10767]);
const EXCLUDED_DISCOVER_GENRES = [...EXCLUDED_GENRE_IDS].join("|");
const KOREA_NETWORK_DISCOVERY_REQUEST_LIMIT = 4;
const KOREA_RECENT_FIRST_AIR_YEARS = 6;

export const KOREA_NETWORK_SEEDS = Object.freeze([
  { name: "KBS2", tmdbNetworkId: 342, recentFirstAirYears: 6 },
  { name: "MBC", tmdbNetworkId: 97, recentFirstAirYears: 6 },
  { name: "SBS", tmdbNetworkId: 156, recentFirstAirYears: 6 },
  { name: "tvN", tmdbNetworkId: 866, recentFirstAirYears: 6 },
  { name: "JTBC", tmdbNetworkId: 885, recentFirstAirYears: 6 },
  { name: "ENA", tmdbNetworkId: 5841, recentFirstAirYears: 6 },
  { name: "TVING", tmdbNetworkId: 3897, recentFirstAirYears: 8 },
  { name: "Netflix", tmdbNetworkId: 213, recentFirstAirYears: 8 },
  { name: "Disney+", tmdbNetworkId: 2739, recentFirstAirYears: 8 }
]);

export const KOREA_TMDB_SYNC_BUDGET = Object.freeze({
  broadDiscoveryRequests: 1,
  scheduleDiscoveryRequests: 1,
  networkDiscoveryRequests: Math.min(KOREA_NETWORK_DISCOVERY_REQUEST_LIMIT, KOREA_NETWORK_SEEDS.length),
  detailRequests: 18,
  totalExternalRequests:
    2 + Math.min(KOREA_NETWORK_DISCOVERY_REQUEST_LIMIT, KOREA_NETWORK_SEEDS.length) + 18
});

function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function daysAheadDate(days, now = new Date()) {
  const copy = new Date(now.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

function recentFirstAirDate(now = new Date()) {
  return `${now.getUTCFullYear() - KOREA_RECENT_FIRST_AIR_YEARS}-01-01`;
}

async function tmdbRequest(env, pathname, params = {}) {
  if (!env.TMDB_API_TOKEN) throw new Error("TMDB_API_TOKEN is not configured");

  const url = new URL(`${TMDB_API_BASE}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${env.TMDB_API_TOKEN}`
    }
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`TMDB ${response.status} ${pathname}: ${detail}`);
  }

  return response.json();
}

async function discoverKoreanCandidates(env, page, extraParams = {}) {
  return tmdbRequest(env, "/discover/tv", {
    include_adult: false,
    language: "en-US",
    page,
    sort_by: "popularity.desc",
    with_origin_country: "KR",
    with_type: "2|4",
    without_genres: EXCLUDED_DISCOVER_GENRES,
    ...extraParams
  });
}

async function getSeriesDetails(env, tmdbId) {
  return tmdbRequest(env, `/tv/${tmdbId}`, {
    language: "en-US",
    append_to_response: "translations"
  });
}

export function isIncludedKoreanScriptedSeries(details) {
  if (!details || !INCLUDED_TYPES.has(details.type)) return false;
  if (!Array.isArray(details.origin_country) || !details.origin_country.includes("KR")) return false;
  if (hasExcludedGenre(details)) return false;
  return true;
}

async function getSourceId(db) {
  let source = await db
    .prepare("SELECT id FROM sources WHERE source_key = 'tmdb_kr' LIMIT 1")
    .first();

  if (!source) {
    source = await db
      .prepare(
        `INSERT INTO sources (source_key, source_type, display_name, base_url, trust_level, enabled)
         VALUES ('tmdb_kr', 'metadata_api', 'TMDB · Korea', ?1, 'normal', 1)
         RETURNING id`
      )
      .bind(TMDB_API_BASE)
      .first();
  }

  return source.id;
}

async function beginSyncRun(db, sourceId) {
  const row = await db
    .prepare(
      `INSERT INTO sync_runs (source_id, run_type, status)
       VALUES (?1, 'catalog_kr', 'running')
       RETURNING id`
    )
    .bind(sourceId)
    .first();
  return row.id;
}

async function finishSyncRun(db, runId, status, recordsSeen, recordsChanged, errorSummary = null) {
  await db
    .prepare(
      `UPDATE sync_runs
       SET status = ?1,
           finished_at = CURRENT_TIMESTAMP,
           records_seen = ?2,
           records_changed = ?3,
           error_summary = ?4
       WHERE id = ?5`
    )
    .bind(status, recordsSeen, recordsChanged, errorSummary, runId)
    .run();
}

async function upsertShow(db, show) {
  const row = await db
    .prepare(
      `INSERT INTO shows (
        original_title, english_title, original_language, origin_country, overview,
        first_air_date, status, tmdb_status, series_type, poster_url, backdrop_url,
        popularity, vote_average, vote_count, homepage_url, last_air_date,
        next_air_date, number_of_seasons, number_of_episodes, in_production,
        tmdb_id, last_synced_at
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5,
        ?6, ?7, ?8, ?9, ?10, ?11,
        ?12, ?13, ?14, ?15, ?16,
        ?17, ?18, ?19, ?20,
        ?21, CURRENT_TIMESTAMP
      )
      ON CONFLICT(tmdb_id) DO UPDATE SET
        original_title = excluded.original_title,
        english_title = excluded.english_title,
        original_language = excluded.original_language,
        origin_country = excluded.origin_country,
        overview = excluded.overview,
        first_air_date = excluded.first_air_date,
        status = excluded.status,
        tmdb_status = excluded.tmdb_status,
        series_type = excluded.series_type,
        poster_url = excluded.poster_url,
        backdrop_url = excluded.backdrop_url,
        popularity = excluded.popularity,
        vote_average = excluded.vote_average,
        vote_count = excluded.vote_count,
        homepage_url = excluded.homepage_url,
        last_air_date = excluded.last_air_date,
        next_air_date = excluded.next_air_date,
        number_of_seasons = excluded.number_of_seasons,
        number_of_episodes = excluded.number_of_episodes,
        in_production = excluded.in_production,
        last_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id`
    )
    .bind(
      show.originalTitle,
      show.englishTitle,
      show.originalLanguage,
      show.originCountry,
      show.overview,
      show.firstAirDate,
      show.status,
      show.tmdbStatus,
      show.seriesType,
      show.posterUrl,
      show.backdropUrl,
      show.popularity,
      show.voteAverage,
      show.voteCount,
      show.homepageUrl,
      show.lastAirDate,
      show.nextAirDate,
      show.numberOfSeasons,
      show.numberOfEpisodes,
      show.inProduction,
      show.tmdbId
    )
    .first();

  return row.id;
}

async function replaceAliases(db, showId, aliases) {
  const statements = [
    db
      .prepare("DELETE FROM title_aliases WHERE show_id = ?1 AND season_id IS NULL AND source_key = 'tmdb'")
      .bind(showId)
  ];

  for (const alias of aliases) {
    statements.push(
      db
        .prepare(
          `INSERT INTO title_aliases (
            show_id, season_id, locale, region, title, source_key, is_preferred, confidence
          ) VALUES (?1, NULL, ?2, ?3, ?4, 'tmdb', ?5, 'normal')`
        )
        .bind(showId, alias.locale, alias.region, alias.title, alias.preferred ? 1 : 0)
    );
  }

  await db.batch(statements);
}

async function replaceNetworks(db, showId, networks) {
  await db.prepare("DELETE FROM show_networks WHERE show_id = ?1").bind(showId).run();

  for (const network of networks) {
    const row = await db
      .prepare(
        `INSERT INTO networks (tmdb_network_id, canonical_name, origin_country, logo_url)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(tmdb_network_id) DO UPDATE SET
           canonical_name = excluded.canonical_name,
           origin_country = excluded.origin_country,
           logo_url = excluded.logo_url,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`
      )
      .bind(network.tmdbNetworkId, network.name, network.originCountry, network.logoUrl)
      .first();

    await db
      .prepare(
        `INSERT OR REPLACE INTO show_networks (show_id, network_id, is_primary)
         VALUES (?1, ?2, ?3)`
      )
      .bind(showId, row.id, network.isPrimary)
      .run();
  }
}

async function replaceGenres(db, showId, genres) {
  await db.prepare("DELETE FROM show_genres WHERE show_id = ?1").bind(showId).run();

  for (const genre of genres) {
    const row = await db
      .prepare(
        `INSERT INTO genres (tmdb_genre_id, name)
         VALUES (?1, ?2)
         ON CONFLICT(tmdb_genre_id) DO UPDATE SET
           name = excluded.name,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`
      )
      .bind(genre.tmdbGenreId, genre.name)
      .first();

    await db
      .prepare("INSERT OR REPLACE INTO show_genres (show_id, genre_id) VALUES (?1, ?2)")
      .bind(showId, row.id)
      .run();
  }
}

async function upsertSeasons(db, showId, seasons) {
  for (const season of seasons) {
    await db
      .prepare(
        `INSERT INTO seasons (
          show_id, season_number, name, overview, premiere_date,
          episode_count, lifecycle_status, tmdb_id
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(show_id, season_number) DO UPDATE SET
          name = excluded.name,
          overview = excluded.overview,
          premiere_date = excluded.premiere_date,
          episode_count = excluded.episode_count,
          lifecycle_status = excluded.lifecycle_status,
          tmdb_id = excluded.tmdb_id,
          updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        showId,
        season.seasonNumber,
        season.name,
        season.overview,
        season.premiereDate,
        season.episodeCount,
        season.lifecycleStatus,
        season.tmdbId
      )
      .run();
  }
}

async function persistSeries(db, normalized) {
  const showId = await upsertShow(db, normalized);
  await replaceAliases(db, showId, normalized.aliases);
  await replaceNetworks(db, showId, normalized.networks);
  await replaceGenres(db, showId, normalized.genres);
  await upsertSeasons(db, showId, normalized.seasons);
  return showId;
}

async function fetchDetailsInBatches(env, candidates, batchSize = 5) {
  const results = [];
  for (let index = 0; index < candidates.length; index += batchSize) {
    const batch = candidates.slice(index, index + batchSize);
    const settled = await Promise.allSettled(
      batch.map((candidate) => getSeriesDetails(env, candidate.id))
    );
    settled.forEach((result, resultIndex) => {
      results.push({ candidate: batch[resultIndex], result });
    });
  }
  return results;
}

function uniqueCandidateCount(feeds) {
  const ids = new Set();
  for (const feed of feeds || []) {
    for (const item of feed || []) {
      if (item?.id !== null && item?.id !== undefined) ids.add(item.id);
    }
  }
  return ids.size;
}

export async function syncTmdbKoreanCatalog(env, options = {}) {
  if (!env.DB) throw new Error("D1 binding DB is required");
  if (!env.TMDB_API_TOKEN) {
    return { ok: false, skipped: true, reason: "tmdb_not_configured" };
  }

  const detailLimit = Math.min(
    Math.max(Number(options.detailLimit) || KOREA_TMDB_SYNC_BUDGET.detailRequests, 1),
    KOREA_TMDB_SYNC_BUDGET.detailRequests
  );
  const requestedMaxShows = Number(options.maxShows);
  const maxShows = Number.isFinite(requestedMaxShows) && requestedMaxShows > 0
    ? Math.min(Math.max(Math.trunc(requestedMaxShows), 1), detailLimit)
    : detailLimit;
  const now = options.now instanceof Date && Number.isFinite(options.now.getTime())
    ? options.now
    : new Date();
  const includeDetails = typeof options.includeDetails === "function"
    ? options.includeDetails
    : null;

  const sourceId = await getSourceId(env.DB);
  const runId = await beginSyncRun(env.DB, sourceId);
  let recordsSeen = 0;
  let recordsChanged = 0;
  let recordsRejected = 0;
  const warnings = [];

  try {
    const activeNetworkSeeds = selectNetworkSeedsForSync(
      KOREA_NETWORK_SEEDS,
      KOREA_TMDB_SYNC_BUDGET.networkDiscoveryRequests,
      now
    );
    const networkDiscoveries = activeNetworkSeeds.map((seed) => ({
      seed,
      page: networkDiscoveryPage(seed, now)
    }));
    const networkFeeds = [];
    for (const { seed, page } of networkDiscoveries) {
      const result = await discoverKoreanCandidates(env, page, networkDiscoveryParams(seed, now));
      networkFeeds.push(result.results || []);
    }

    const scheduled = await discoverKoreanCandidates(env, 1, {
      "air_date.gte": todayUtc(now),
      "air_date.lte": daysAheadDate(90, now)
    });
    const scheduleFeeds = [scheduled.results || []];

    const broad = await discoverKoreanCandidates(env, 1, {
      "first_air_date.gte": recentFirstAirDate(now)
    });
    const broadFeeds = [broad.results || []];

    const candidateFeeds = [...networkFeeds, ...scheduleFeeds, ...broadFeeds];
    recordsSeen = uniqueCandidateCount(candidateFeeds);
    const candidateOffset = candidateRotationOffset(candidateFeeds, detailLimit, now);
    const activeFeedCount = Math.max(
      1,
      candidateFeeds.filter((feed) => Array.isArray(feed) && feed.length > 0).length
    );
    const candidateStride = Math.max(1, Math.floor(detailLimit / activeFeedCount));
    const networkCandidateOffsets = networkFeeds.map((feed, index) =>
      networkCandidateRotationOffset(
        networkDiscoveries[index].seed,
        networkDiscoveries[index].page,
        feed.length,
        candidateStride,
        now,
        KOREA_NETWORK_SEEDS,
        KOREA_TMDB_SYNC_BUDGET.networkDiscoveryRequests
      )
    );
    const candidateOffsets = [
      ...networkCandidateOffsets,
      ...scheduleFeeds.map(() => candidateOffset),
      ...broadFeeds.map(() => candidateOffset)
    ];
    const selectedCandidates = selectRoundRobinCandidates(
      candidateFeeds,
      detailLimit,
      candidateOffsets
    );
    const detailsResults = await fetchDetailsInBatches(env, selectedCandidates);

    for (const entry of detailsResults) {
      if (recordsChanged >= maxShows) break;
      if (entry.result.status === "rejected") {
        warnings.push(`TMDB ${entry.candidate.id}: ${String(entry.result.reason)}`);
        continue;
      }

      const details = entry.result.value;
      if (!isIncludedKoreanScriptedSeries(details)) continue;
      if (includeDetails && !includeDetails(details)) {
        recordsRejected += 1;
        continue;
      }
      const normalized = normalizeTmdbSeries(details, now);
      if (!ACTIVE_CATALOG_STATUSES.has(normalized.status)) continue;

      await persistSeries(env.DB, normalized);
      recordsChanged += 1;
    }

    const status = warnings.length ? "success_with_warnings" : "success";
    await finishSyncRun(
      env.DB,
      runId,
      status,
      recordsSeen,
      recordsChanged,
      warnings.length ? warnings.slice(0, 5).join(" | ").slice(0, 1000) : null
    );

    return {
      ok: true,
      source: "tmdb_kr",
      market: "KR",
      recordsSeen,
      recordsSelected: selectedCandidates.length,
      recordsChanged,
      recordsRejected,
      discoveryRequests: candidateFeeds.length,
      networkSeeds: activeNetworkSeeds.map((seed) => seed.name),
      networkPages: networkDiscoveries.map(({ seed, page }) => ({ name: seed.name, page })),
      networkCandidateOffsets: networkDiscoveries.map(({ seed, page }, index) => ({
        name: seed.name,
        page,
        offset: networkCandidateOffsets[index]
      })),
      externalRequestBudget: candidateFeeds.length + selectedCandidates.length,
      warnings: warnings.length
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishSyncRun(env.DB, runId, "failed", recordsSeen, recordsChanged, message.slice(0, 1000));
    throw error;
  }
}
