const TMDB_WEB_BASE = "https://www.themoviedb.org/tv";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/original";

function toDateOnly(value) {
  if (!value || typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function normalizeKoreanTmdbNextEpisode(details, now = new Date()) {
  const episode = details?.next_episode_to_air;
  if (!episode) return null;

  const showTmdbId = Number(details?.id);
  const tmdbId = Number(episode.id);
  const seasonNumber = Number(episode.season_number);
  const episodeNumber = Number(episode.episode_number);
  const airDate = toDateOnly(episode.air_date);
  const today = todayUtc(now);

  if (!Number.isInteger(showTmdbId) || showTmdbId <= 0) return null;
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return null;
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) return null;
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) return null;
  if (!airDate || airDate < today) return null;

  const stillPath = typeof episode.still_path === "string" && episode.still_path
    ? episode.still_path
    : null;
  const hasRuntime = episode.runtime !== null && episode.runtime !== undefined && episode.runtime !== "";

  return {
    tmdbId,
    seasonNumber,
    episodeNumber,
    name: typeof episode.name === "string" && episode.name.trim() ? episode.name.trim() : null,
    overview: typeof episode.overview === "string" && episode.overview.trim() ? episode.overview.trim() : null,
    airDate,
    runtimeMinutes: hasRuntime && Number.isFinite(Number(episode.runtime)) && Number(episode.runtime) >= 0
      ? Number(episode.runtime)
      : null,
    imageUrl: stillPath ? `${TMDB_IMAGE_BASE}${stillPath}` : null,
    sourceUrl: `${TMDB_WEB_BASE}/${showTmdbId}/season/${seasonNumber}/episode/${episodeNumber}`
  };
}

async function findTvmazeFutureSchedule(db, showId, today) {
  return db
    .prepare(
      `SELECT e.id
       FROM episodes e
       JOIN seasons s ON s.id = e.season_id
       WHERE s.show_id = ?1
         AND e.tvmaze_id IS NOT NULL
         AND e.air_date >= ?2
       LIMIT 1`
    )
    .bind(showId, today)
    .first();
}

async function pruneFutureTmdbFallbacks(db, showId, today, keepTmdbId = null) {
  const result = await db
    .prepare(
      `DELETE FROM episodes
       WHERE tvmaze_id IS NULL
         AND tmdb_id IS NOT NULL
         AND source_url LIKE 'https://www.themoviedb.org/tv/%'
         AND air_date >= ?2
         AND season_id IN (SELECT id FROM seasons WHERE show_id = ?1)
         AND (?3 IS NULL OR tmdb_id <> ?3)`
    )
    .bind(showId, today, keepTmdbId)
    .run();

  return Number(result?.meta?.changes || 0);
}

async function findSeasonId(db, showId, seasonNumber) {
  const row = await db
    .prepare("SELECT id FROM seasons WHERE show_id = ?1 AND season_number = ?2 LIMIT 1")
    .bind(showId, seasonNumber)
    .first();
  return Number(row?.id) || null;
}

export async function syncKoreanTmdbNextEpisodeFallback(db, {
  showId,
  details,
  now = new Date()
} = {}) {
  const numericShowId = Number(showId);
  if (!db || !Number.isInteger(numericShowId) || numericShowId <= 0) {
    throw new Error("A valid D1 database and showId are required for Korean schedule fallback");
  }

  const effectiveNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const today = todayUtc(effectiveNow);
  const tvmazeFuture = await findTvmazeFutureSchedule(db, numericShowId, today);

  if (tvmazeFuture) {
    const pruned = await pruneFutureTmdbFallbacks(db, numericShowId, today);
    return { applied: 0, pruned, reason: "tvmaze_future_present" };
  }

  const nextEpisode = normalizeKoreanTmdbNextEpisode(details, effectiveNow);
  if (!nextEpisode) {
    const pruned = await pruneFutureTmdbFallbacks(db, numericShowId, today);
    return { applied: 0, pruned, reason: "tmdb_next_episode_unavailable" };
  }

  const pruned = await pruneFutureTmdbFallbacks(
    db,
    numericShowId,
    today,
    nextEpisode.tmdbId
  );
  const seasonId = await findSeasonId(db, numericShowId, nextEpisode.seasonNumber);
  if (!seasonId) {
    return { applied: 0, pruned, reason: "season_missing" };
  }

  const result = await db
    .prepare(
      `INSERT INTO episodes (
        season_id, episode_number, name, overview, air_date, air_time,
        runtime_minutes, tmdb_id, image_url, source_url, last_synced_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, ?8, ?9, CURRENT_TIMESTAMP)
      ON CONFLICT(season_id, episode_number) DO UPDATE SET
        name = COALESCE(excluded.name, episodes.name),
        overview = COALESCE(excluded.overview, episodes.overview),
        air_date = excluded.air_date,
        runtime_minutes = COALESCE(excluded.runtime_minutes, episodes.runtime_minutes),
        tmdb_id = excluded.tmdb_id,
        image_url = COALESCE(excluded.image_url, episodes.image_url),
        source_url = excluded.source_url,
        last_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE episodes.tvmaze_id IS NULL`
    )
    .bind(
      seasonId,
      nextEpisode.episodeNumber,
      nextEpisode.name,
      nextEpisode.overview,
      nextEpisode.airDate,
      nextEpisode.runtimeMinutes,
      nextEpisode.tmdbId,
      nextEpisode.imageUrl,
      nextEpisode.sourceUrl
    )
    .run();

  return {
    applied: Number(result?.meta?.changes || 0) > 0 ? 1 : 0,
    pruned,
    reason: "tmdb_next_episode"
  };
}
