const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const TERMINAL_STATUSES = new Set(["Ended", "Canceled"]);
const INCLUDED_TYPES = new Set(["Scripted", "Miniseries"]);
const ANIMATION_GENRE_ID = 16;

function toDateOnly(value) {
  if (!value || typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function daysAgoDate(days, now = new Date()) {
  const copy = new Date(now.getTime());
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy.toISOString().slice(0, 10);
}

export function tmdbImageUrl(path, size = "w500") {
  if (!path || typeof path !== "string") return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

async function tmdbRequest(env, pathname, params = {}) {
  if (!env.TMDB_API_TOKEN) {
    throw new Error("TMDB_API_TOKEN is not configured");
  }

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

export function isIncludedUsScriptedSeries(details) {
  if (!details || !INCLUDED_TYPES.has(details.type)) return false;
  if (!Array.isArray(details.origin_country) || !details.origin_country.includes("US")) return false;
  if (Array.isArray(details.genres) && details.genres.some((genre) => genre.id === ANIMATION_GENRE_ID)) return false;
  return true;
}

function futureSeasonDate(details, today) {
  const dates = (details.seasons || [])
    .filter((season) => Number(season.season_number) > 0)
    .map((season) => toDateOnly(season.air_date))
    .filter((date) => date && date > today)
    .sort();

  return dates[0] || null;
}

export function normalizeLifecycle(details, now = new Date()) {
  const today = todayUtc(now);
  const recentThreshold = daysAgoDate(35, now);
  const firstAirDate = toDateOnly(details.first_air_date);
  const lastAirDate = toDateOnly(details.last_episode_to_air?.air_date || details.last_air_date);
  const explicitNextAirDate = toDateOnly(details.next_episode_to_air?.air_date);
  const nextSeasonDate = futureSeasonDate(details, today);
  const nextAirDate = explicitNextAirDate || nextSeasonDate;
  const tmdbStatus = details.status || "Unknown";

  if (firstAirDate && firstAirDate > today) {
    return { status: "upcoming", lastAirDate, nextAirDate: firstAirDate };
  }

  if (nextAirDate && nextAirDate >= today) {
    if (firstAirDate && firstAirDate <= today) {
      return { status: "airing", lastAirDate, nextAirDate };
    }
    return { status: "upcoming", lastAirDate, nextAirDate };
  }

  if (!TERMINAL_STATUSES.has(tmdbStatus) && lastAirDate && lastAirDate >= recentThreshold) {
    return { status: "airing", lastAirDate, nextAirDate: null };
  }

  if (TERMINAL_STATUSES.has(tmdbStatus)) {
    return { status: "completed", lastAirDate, nextAirDate: null };
  }

  if (["Returning Series", "In Production", "Planned", "Pilot"].includes(tmdbStatus)) {
    return { status: "planned", lastAirDate, nextAirDate: null };
  }

  return { status: "unknown", lastAirDate, nextAirDate: null };
}

function normalizeSeasonLifecycle(season, showLifecycle, latestSeasonNumber, today) {
  const seasonNumber = Number(season.season_number);
  const premiereDate = toDateOnly(season.air_date);

  if (premiereDate && premiereDate > today) return "upcoming";
  if (seasonNumber === latestSeasonNumber && showLifecycle === "airing") return "airing";
  if (seasonNumber === latestSeasonNumber && showLifecycle === "planned") return "planned";
  if (premiereDate && premiereDate <= today) return "completed";
  return "unknown";
}

function preferredTranslationName(translation) {
  const dataName = translation?.data?.name;
  if (typeof dataName === "string" && dataName.trim()) return dataName.trim();
  if (typeof translation?.name === "string" && translation.name.trim()) return translation.name.trim();
  return null;
}

export function extractTitleAliases(details) {
  const aliases = [];
  const seen = new Set();

  const add = (locale, region, title, preferred = false) => {
    if (!title) return;
    const clean = title.trim();
    const key = `${locale}|${region || ""}|${clean}`;
    if (!clean || seen.has(key)) return;
    seen.add(key);
    aliases.push({ locale, region, title: clean, preferred });
  };

  add("en", "US", details.name || details.original_name, true);

  const translations = details.translations?.translations || [];
  for (const translation of translations) {
    if (translation.iso_639_1 !== "zh") continue;
    const region = translation.iso_3166_1 || null;
    if (!["HK", "TW", "CN"].includes(region)) continue;
    add("zh", region, preferredTranslationName(translation), true);
  }

  return aliases;
}

export function normalizeTmdbSeries(details, now = new Date()) {
  const lifecycle = normalizeLifecycle(details, now);
  const seasons = (details.seasons || []).filter((season) => Number(season.season_number) > 0);
  const latestSeasonNumber = seasons.reduce(
    (max, season) => Math.max(max, Number(season.season_number) || 0),
    0
  );
  const today = todayUtc(now);

  return {
    tmdbId: details.id,
    originalTitle: details.original_name || details.name || `TMDB ${details.id}`,
    englishTitle: details.name || details.original_name || `TMDB ${details.id}`,
    originalLanguage: details.original_language || null,
    originCountry: Array.isArray(details.origin_country) ? details.origin_country.join(",") : null,
    overview: details.overview || null,
    firstAirDate: toDateOnly(details.first_air_date),
    status: lifecycle.status,
    tmdbStatus: details.status || null,
    seriesType: details.type || null,
    posterUrl: tmdbImageUrl(details.poster_path, "w500"),
    backdropUrl: tmdbImageUrl(details.backdrop_path, "w780"),
    popularity: Number.isFinite(details.popularity) ? details.popularity : null,
    voteAverage: Number.isFinite(details.vote_average) ? details.vote_average : null,
    voteCount: Number.isFinite(details.vote_count) ? details.vote_count : null,
    homepageUrl: details.homepage || null,
    lastAirDate: lifecycle.lastAirDate,
    nextAirDate: lifecycle.nextAirDate,
    numberOfSeasons: Number.isFinite(details.number_of_seasons) ? details.number_of_seasons : seasons.length,
    numberOfEpisodes: Number.isFinite(details.number_of_episodes) ? details.number_of_episodes : null,
    inProduction: details.in_production ? 1 : 0,
    aliases: extractTitleAliases(details),
    networks: (details.networks || []).map((network, index) => ({
      tmdbNetworkId: network.id,
      name: network.name,
      originCountry: network.origin_country || null,
      logoUrl: tmdbImageUrl(network.logo_path, "w300"),
      isPrimary: index === 0 ? 1 : 0
    })),
    genres: (details.genres || []).map((genre) => ({
      tmdbGenreId: genre.id,
      name: genre.name
    })),
    seasons: seasons.map((season) => ({
      tmdbId: season.id,
      seasonNumber: Number(season.season_number),
      name: season.name || null,
      overview: season.overview || null,
      premiereDate: toDateOnly(season.air_date),
      episodeCount: Number.isFinite(season.episode_count) ? season.episode_count : null,
      lifecycleStatus: normalizeSeasonLifecycle(
        season,
        lifecycle.status,
        latestSeasonNumber,
        today
      )
    }))
  };
}

async function discoverCandidates(env, page) {
  return tmdbRequest(env, "/discover/tv", {
    include_adult: false,
    language: "en-US",
    page,
    sort_by: "popularity.desc",
    with_origin_country: "US"
  });
}

async function getSeriesDetails(env, tmdbId) {
  return tmdbRequest(env, `/tv/${tmdbId}`, {
    language: "en-US",
    append_to_response: "translations"
  });
}

async function getSourceId(db) {
  let source = await db
    .prepare("SELECT id FROM sources WHERE source_key = 'tmdb' LIMIT 1")
    .first();

  if (!source) {
    source = await db
      .prepare(
        `INSERT INTO sources (source_key, source_type, display_name, base_url, trust_level, enabled)
         VALUES ('tmdb', 'metadata_api', 'TMDB', ?1, 'normal', 1)
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
       VALUES (?1, 'catalog', 'running')
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

export async function syncTmdbCatalog(env, options = {}) {
  if (!env.DB) throw new Error("D1 binding DB is required");
  if (!env.TMDB_API_TOKEN) {
    return {
      ok: false,
      skipped: true,
      reason: "tmdb_not_configured"
    };
  }

  const pages = Math.min(Math.max(Number(options.pages) || 2, 1), 2);
  const maxShows = Math.min(Math.max(Number(options.maxShows) || 24, 1), 30);
  const sourceId = await getSourceId(env.DB);
  const runId = await beginSyncRun(env.DB, sourceId);
  let recordsSeen = 0;
  let recordsChanged = 0;
  const warnings = [];

  try {
    const candidates = [];
    for (let page = 1; page <= pages; page += 1) {
      const discovered = await discoverCandidates(env, page);
      for (const item of discovered.results || []) {
        if (!candidates.some((candidate) => candidate.id === item.id)) candidates.push(item);
      }
    }

    recordsSeen = candidates.length;
    const detailsResults = await fetchDetailsInBatches(env, candidates);

    for (const entry of detailsResults) {
      if (recordsChanged >= maxShows) break;

      if (entry.result.status === "rejected") {
        warnings.push(`TMDB ${entry.candidate.id}: ${entry.result.reason}`);
        continue;
      }

      const details = entry.result.value;
      if (!isIncludedUsScriptedSeries(details)) continue;

      const normalized = normalizeTmdbSeries(details);
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
      source: "tmdb",
      recordsSeen,
      recordsChanged,
      warnings: warnings.length
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishSyncRun(env.DB, runId, "failed", recordsSeen, recordsChanged, message.slice(0, 1000));
    throw error;
  }
}
