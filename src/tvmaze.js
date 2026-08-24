const TVMAZE_API_BASE = "https://api.tvmaze.com";
const TMDB_API_BASE = "https://api.themoviedb.org/3";
const ACTIVE_STATUSES = new Set(["airing", "upcoming", "planned"]);
const SHOWS_PER_SYNC = 10;
const RETAIN_PAST_DAYS = 90;
const MAX_RETRIES = 3;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function decodeHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim() || null;
}

async function tvmazeRequest(pathname, params = {}, { allow404 = false } = {}) {
  const url = new URL(`${TVMAZE_API_BASE}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "Series-Hub/0.2 (https://series-hub.max-yu-jp.workers.dev)"
      },
      redirect: "follow"
    });

    if (allow404 && response.status === 404) return null;

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await delay(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2500 * (attempt + 1));
      continue;
    }

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`TVmaze ${response.status} ${pathname}: ${detail}`);
    }

    return response.json();
  }

  throw new Error(`TVmaze request retries exhausted: ${pathname}`);
}

async function tmdbExternalIds(env, tmdbId) {
  if (!env.TMDB_API_TOKEN || !tmdbId) return null;
  const response = await fetch(`${TMDB_API_BASE}/tv/${tmdbId}/external_ids`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${env.TMDB_API_TOKEN}`
    }
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`TMDB ${response.status} external_ids: ${detail}`);
  }
  return response.json();
}

export function selectRelevantEpisodes(episodes, now = new Date()) {
  const today = todayUtc(now);
  const threshold = daysAgoDate(RETAIN_PAST_DAYS, now);
  const valid = (Array.isArray(episodes) ? episodes : []).filter((episode) =>
    Number(episode?.season) > 0 &&
    Number(episode?.number) > 0 &&
    toDateOnly(episode?.airdate)
  );

  let latestPast = null;
  for (const episode of valid) {
    const date = toDateOnly(episode.airdate);
    if (date <= today && (!latestPast || date > latestPast.airdate || (date === latestPast.airdate && Number(episode.id) > Number(latestPast.id)))) {
      latestPast = episode;
    }
  }

  const selected = new Map();
  for (const episode of valid) {
    const date = toDateOnly(episode.airdate);
    if (date >= threshold) selected.set(episode.id, episode);
  }
  if (latestPast) selected.set(latestPast.id, latestPast);

  return [...selected.values()].sort((left, right) => {
    const dateCompare = String(left.airdate).localeCompare(String(right.airdate));
    if (dateCompare) return dateCompare;
    const seasonCompare = Number(left.season) - Number(right.season);
    if (seasonCompare) return seasonCompare;
    return Number(left.number) - Number(right.number);
  });
}

export function normalizeTvmazeEpisode(episode) {
  const seasonNumber = Number(episode?.season);
  const episodeNumber = Number(episode?.number);
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) return null;
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) return null;

  const airDate = toDateOnly(episode?.airdate);
  if (!airDate) return null;

  return {
    tvmazeId: Number.isFinite(Number(episode.id)) ? Number(episode.id) : null,
    seasonNumber,
    episodeNumber,
    name: typeof episode.name === "string" && episode.name.trim() ? episode.name.trim() : null,
    overview: decodeHtml(episode.summary),
    airDate,
    airTime: typeof episode.airtime === "string" && /^\d{2}:\d{2}$/.test(episode.airtime) ? episode.airtime : null,
    airTimestamp: typeof episode.airstamp === "string" && episode.airstamp ? episode.airstamp : null,
    runtimeMinutes: Number.isFinite(Number(episode.runtime)) ? Number(episode.runtime) : null,
    imageUrl: episode?.image?.original || episode?.image?.medium || null,
    sourceUrl: typeof episode.url === "string" ? episode.url : null
  };
}

export function lookupParamsForShow(show) {
  if (show?.imdb_id) return { imdb: show.imdb_id };
  if (show?.thetvdb_id) return { thetvdb: show.thetvdb_id };
  return null;
}

async function enrichExternalIds(env, db, show) {
  if (show.imdb_id || show.thetvdb_id || !show.tmdb_id) return show;
  const external = await tmdbExternalIds(env, show.tmdb_id);
  const imdbId = typeof external?.imdb_id === "string" && external.imdb_id ? external.imdb_id : null;
  const thetvdbId = Number.isFinite(Number(external?.tvdb_id)) ? Number(external.tvdb_id) : null;

  await db
    .prepare(
      `UPDATE shows
       SET imdb_id = COALESCE(?1, imdb_id),
           thetvdb_id = COALESCE(?2, thetvdb_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?3`
    )
    .bind(imdbId, thetvdbId, show.id)
    .run();

  return { ...show, imdb_id: imdbId, thetvdb_id: thetvdbId };
}

async function lookupTvmazeShow(show) {
  if (show.tvmaze_id) return { id: Number(show.tvmaze_id) };

  if (show.imdb_id) {
    const result = await tvmazeRequest("/lookup/shows", { imdb: show.imdb_id }, { allow404: true });
    if (result?.id) return result;
  }

  if (show.thetvdb_id) {
    const result = await tvmazeRequest("/lookup/shows", { thetvdb: show.thetvdb_id }, { allow404: true });
    if (result?.id) return result;
  }

  return null;
}

async function getSourceId(db) {
  let source = await db
    .prepare("SELECT id FROM sources WHERE source_key = 'tvmaze' LIMIT 1")
    .first();

  if (!source) {
    source = await db
      .prepare(
        `INSERT INTO sources (source_key, source_type, display_name, base_url, trust_level, enabled)
         VALUES ('tvmaze', 'schedule_api', 'TVmaze', ?1, 'normal', 1)
         RETURNING id`
      )
      .bind(TVMAZE_API_BASE)
      .first();
  }

  return source.id;
}

async function beginSyncRun(db, sourceId) {
  const row = await db
    .prepare(
      `INSERT INTO sync_runs (source_id, run_type, status)
       VALUES (?1, 'episodes', 'running')
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

async function selectShowsForSync(db, limit) {
  const result = await db
    .prepare(
      `SELECT
        id,
        tmdb_id,
        english_title,
        status,
        imdb_id,
        thetvdb_id,
        tvmaze_id,
        tvmaze_synced_at
       FROM shows
       WHERE status IN ('airing', 'upcoming', 'planned')
         AND (tvmaze_id IS NOT NULL OR tmdb_id IS NOT NULL OR imdb_id IS NOT NULL OR thetvdb_id IS NOT NULL)
       ORDER BY
         CASE WHEN tvmaze_synced_at IS NULL THEN 0 ELSE 1 END,
         tvmaze_synced_at ASC,
         CASE status WHEN 'airing' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,
         popularity DESC,
         id ASC
       LIMIT ?1`
    )
    .bind(limit)
    .all();

  return result.results || [];
}

async function ensureSeason(db, show, seasonNumber) {
  let row = await db
    .prepare("SELECT id FROM seasons WHERE show_id = ?1 AND season_number = ?2 LIMIT 1")
    .bind(show.id, seasonNumber)
    .first();

  if (row) return row.id;

  const lifecycle = ACTIVE_STATUSES.has(show.status) ? show.status : "unknown";
  row = await db
    .prepare(
      `INSERT INTO seasons (show_id, season_number, name, lifecycle_status)
       VALUES (?1, ?2, ?3, ?4)
       RETURNING id`
    )
    .bind(show.id, seasonNumber, `Season ${seasonNumber}`, lifecycle)
    .first();

  return row.id;
}

async function replaceTvmazeEpisodes(db, show, normalizedEpisodes) {
  await db
    .prepare(
      `DELETE FROM episodes
       WHERE tvmaze_id IS NOT NULL
         AND season_id IN (SELECT id FROM seasons WHERE show_id = ?1)`
    )
    .bind(show.id)
    .run();

  let inserted = 0;
  for (const episode of normalizedEpisodes) {
    const seasonId = await ensureSeason(db, show, episode.seasonNumber);
    await db
      .prepare(
        `INSERT INTO episodes (
          season_id, episode_number, name, overview, air_date, air_time,
          runtime_minutes, tvmaze_id, air_timestamp, image_url, source_url, last_synced_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, CURRENT_TIMESTAMP)
        ON CONFLICT(season_id, episode_number) DO UPDATE SET
          name = excluded.name,
          overview = excluded.overview,
          air_date = excluded.air_date,
          air_time = excluded.air_time,
          runtime_minutes = excluded.runtime_minutes,
          tvmaze_id = excluded.tvmaze_id,
          air_timestamp = excluded.air_timestamp,
          image_url = excluded.image_url,
          source_url = excluded.source_url,
          last_synced_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        seasonId,
        episode.episodeNumber,
        episode.name,
        episode.overview,
        episode.airDate,
        episode.airTime,
        episode.runtimeMinutes,
        episode.tvmazeId,
        episode.airTimestamp,
        episode.imageUrl,
        episode.sourceUrl
      )
      .run();
    inserted += 1;
  }

  return inserted;
}

async function markShowSync(db, showId, tvmazeId = null) {
  await db
    .prepare(
      `UPDATE shows
       SET tvmaze_id = COALESCE(?1, tvmaze_id),
           tvmaze_synced_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?2`
    )
    .bind(tvmazeId, showId)
    .run();
}

export async function syncTvmazeEpisodes(env, options = {}) {
  if (!env.DB) throw new Error("D1 binding DB is required");

  const limit = Math.min(Math.max(Number(options.limit) || SHOWS_PER_SYNC, 1), SHOWS_PER_SYNC);
  const sourceId = await getSourceId(env.DB);
  const runId = await beginSyncRun(env.DB, sourceId);
  const warnings = [];
  let recordsSeen = 0;
  let recordsChanged = 0;
  let showsMapped = 0;
  let showsProcessed = 0;

  try {
    const shows = await selectShowsForSync(env.DB, limit);
    recordsSeen = shows.length;

    for (const originalShow of shows) {
      let show = originalShow;
      try {
        show = await enrichExternalIds(env, env.DB, show);
        const mapped = await lookupTvmazeShow(show);
        if (!mapped?.id) {
          warnings.push(`${show.english_title || show.id}: no exact TVmaze lookup match`);
          await markShowSync(env.DB, show.id);
          continue;
        }

        const tvmazeId = Number(mapped.id);
        if (!show.tvmaze_id) showsMapped += 1;
        await markShowSync(env.DB, show.id, tvmazeId);

        const episodes = await tvmazeRequest(`/shows/${tvmazeId}/episodes`);
        const relevant = selectRelevantEpisodes(episodes)
          .map(normalizeTvmazeEpisode)
          .filter(Boolean);

        recordsChanged += await replaceTvmazeEpisodes(env.DB, show, relevant);
        showsProcessed += 1;
      } catch (error) {
        warnings.push(`${show.english_title || show.id}: ${error instanceof Error ? error.message : String(error)}`);
        await markShowSync(env.DB, show.id);
      }
    }

    const status = warnings.length ? "success_with_warnings" : "success";
    await finishSyncRun(
      env.DB,
      runId,
      status,
      recordsSeen,
      recordsChanged,
      warnings.length ? warnings.slice(0, 8).join(" | ").slice(0, 1000) : null
    );

    return {
      ok: true,
      source: "tvmaze",
      recordsSeen,
      recordsChanged,
      showsMapped,
      showsProcessed,
      warnings: warnings.length
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishSyncRun(env.DB, runId, "failed", recordsSeen, recordsChanged, message.slice(0, 1000));
    throw error;
  }
}
