import { normalizeTitleRegion, withResolvedChineseTitle } from "./title-aliases.js";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const YOUTUBE_KEY_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;

function imageUrl(path, size = "w780") {
  if (!path || typeof path !== "string") return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

async function tmdbDetailRequest(env, tmdbId) {
  if (!env.TMDB_API_TOKEN) throw new Error("TMDB_API_TOKEN is not configured");

  const url = new URL(`${TMDB_API_BASE}/tv/${tmdbId}`);
  url.searchParams.set("language", "en-US");
  url.searchParams.set("append_to_response", "images,videos,content_ratings");
  url.searchParams.set("include_image_language", "en,null");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${env.TMDB_API_TOKEN}`
    }
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`TMDB ${response.status} detail request failed: ${detail}`);
  }

  return response.json();
}

function uniqueByPath(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const path = item?.file_path;
    if (!path || seen.has(path)) return false;
    seen.add(path);
    return true;
  });
}

function imageScore(image) {
  return Number(image?.vote_average || 0) * 1000 + Number(image?.vote_count || 0);
}

export function normalizeTmdbImages(images = {}) {
  const backdrops = uniqueByPath(images.backdrops)
    .sort((left, right) => imageScore(right) - imageScore(left))
    .slice(0, 12)
    .map((image) => ({
      kind: "backdrop",
      width: Number(image.width) || null,
      height: Number(image.height) || null,
      preview_url: imageUrl(image.file_path, "w780"),
      full_url: imageUrl(image.file_path, "original")
    }));

  const posters = uniqueByPath(images.posters)
    .sort((left, right) => imageScore(right) - imageScore(left))
    .slice(0, 8)
    .map((image) => ({
      kind: "poster",
      width: Number(image.width) || null,
      height: Number(image.height) || null,
      preview_url: imageUrl(image.file_path, "w500"),
      full_url: imageUrl(image.file_path, "original")
    }));

  return { backdrops, posters };
}

function videoRank(video) {
  let score = 0;
  if (video?.official) score += 100;
  if (video?.type === "Trailer") score += 80;
  else if (video?.type === "Teaser") score += 50;
  else if (video?.type === "Clip") score += 10;
  if (video?.iso_639_1 === "en") score += 5;
  const published = Date.parse(video?.published_at || "");
  if (Number.isFinite(published)) score += published / 1e13;
  return score;
}

export function normalizeTmdbVideos(videos = []) {
  return (videos || [])
    .filter((video) => video?.site === "YouTube" && YOUTUBE_KEY_PATTERN.test(String(video?.key || "")))
    .sort((left, right) => videoRank(right) - videoRank(left))
    .slice(0, 8)
    .map((video) => ({
      key: video.key,
      name: video.name || video.type || "Trailer",
      type: video.type || null,
      official: Boolean(video.official),
      published_at: video.published_at || null,
      watch_url: `https://www.youtube.com/watch?v=${video.key}`,
      embed_url: `https://www.youtube-nocookie.com/embed/${video.key}?rel=0`
    }));
}

function usContentRating(details) {
  const rows = details?.content_ratings?.results || [];
  const us = rows.find((row) => row?.iso_3166_1 === "US");
  return us?.rating || null;
}

export function normalizeTmdbDetailMedia(details = {}) {
  const images = normalizeTmdbImages(details.images || {});
  const videos = normalizeTmdbVideos(details.videos?.results || []);
  return {
    available: true,
    tagline: details.tagline || null,
    content_rating_us: usContentRating(details),
    created_by: (details.created_by || []).map((person) => person?.name).filter(Boolean).slice(0, 6),
    images,
    videos,
    primary_trailer: videos[0] || null
  };
}

async function loadStoredShow(env, showId) {
  return env.DB.prepare(
    `SELECT
      s.id,
      s.tmdb_id,
      s.tvmaze_id,
      s.original_title,
      s.english_title,
      s.original_language,
      s.origin_country,
      s.overview,
      s.first_air_date,
      s.status,
      s.tmdb_status,
      s.series_type,
      s.poster_url,
      s.backdrop_url,
      s.popularity,
      s.vote_average,
      s.vote_count,
      s.homepage_url,
      s.last_air_date,
      s.next_air_date,
      s.number_of_seasons,
      s.number_of_episodes,
      s.in_production,
      s.last_synced_at,
      s.tvmaze_synced_at,
      pt.title_zh_hk,
      pt.title_zh_hk_source,
      pt.title_zh_hk_confidence,
      pt.title_zh_tw,
      pt.title_zh_tw_source,
      pt.title_zh_tw_confidence,
      pt.title_zh_cn,
      pt.title_zh_cn_source,
      pt.title_zh_cn_confidence,
      (SELECT GROUP_CONCAT(ta.title, ' | ') FROM title_aliases ta WHERE ta.show_id = s.id AND ta.season_id IS NULL AND ta.locale = 'zh') AS chinese_aliases,
      (SELECT GROUP_CONCAT(n.canonical_name, ' · ') FROM show_networks sn JOIN networks n ON n.id = sn.network_id WHERE sn.show_id = s.id ORDER BY sn.is_primary DESC, n.canonical_name ASC) AS networks,
      (SELECT GROUP_CONCAT(g.name, ' · ') FROM show_genres sg JOIN genres g ON g.id = sg.genre_id WHERE sg.show_id = s.id ORDER BY g.name ASC) AS genres
    FROM shows s
    LEFT JOIN preferred_show_titles pt ON pt.show_id = s.id
    WHERE s.id = ?1
    LIMIT 1`
  ).bind(showId).first();
}

async function loadSeasons(env, showId) {
  const result = await env.DB.prepare(
    `SELECT
      id,
      tmdb_id,
      season_number,
      name,
      overview,
      premiere_date,
      episode_count,
      lifecycle_status,
      updated_at
    FROM seasons
    WHERE show_id = ?1 AND season_number > 0
    ORDER BY season_number DESC`
  ).bind(showId).all();
  return result.results || [];
}

export async function buildShowDetail(env, showId, requestedRegion) {
  if (!env.DB) {
    return { status: 503, body: { ok: false, error: "database_not_configured" } };
  }

  const numericShowId = Number(showId);
  if (!Number.isSafeInteger(numericShowId) || numericShowId <= 0) {
    return { status: 400, body: { ok: false, error: "invalid_show_id" } };
  }

  const show = await loadStoredShow(env, numericShowId);
  if (!show) return { status: 404, body: { ok: false, error: "show_not_found", showId: numericShowId } };

  const titleRegion = normalizeTitleRegion(requestedRegion);
  const resolvedShow = withResolvedChineseTitle(show, titleRegion);
  const seasons = await loadSeasons(env, numericShowId);

  let media = {
    available: false,
    tagline: null,
    content_rating_us: null,
    created_by: [],
    images: { backdrops: [], posters: [] },
    videos: [],
    primary_trailer: null
  };
  let mediaError = null;

  if (show.tmdb_id && env.TMDB_API_TOKEN) {
    try {
      const details = await tmdbDetailRequest(env, show.tmdb_id);
      media = normalizeTmdbDetailMedia(details);
    } catch (error) {
      mediaError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    status: 200,
    body: {
      data: {
        show: resolvedShow,
        seasons,
        media
      },
      meta: {
        phase: "6a-show-details",
        showId: numericShowId,
        titleRegion,
        tmdbMediaConfigured: Boolean(env.TMDB_API_TOKEN),
        mediaError
      }
    }
  };
}
