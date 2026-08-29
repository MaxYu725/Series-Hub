import phase5eWorker from "./phase5e-worker.js";
import { buildShowDetail } from "./phase6-details.js";
import { normalizeTitleRegion, withResolvedChineseTitle } from "./title-aliases.js";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const REGION_LANGUAGE = Object.freeze({ HK: "zh-HK", TW: "zh-TW", CN: "zh-CN" });

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

function normalizeSearchQuery(url) {
  const value = (url.searchParams.get("q") || "").trim();
  return value ? value.slice(0, 80) : null;
}

function normalizeSearchLimit(url) {
  const value = Number(url.searchParams.get("limit") || 60);
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 1), 100) : 60;
}

async function localizeDetailBody(env, body, region) {
  const show = body?.data?.show;
  const tmdbId = Number(show?.tmdb_id);
  const language = REGION_LANGUAGE[region] || REGION_LANGUAGE.HK;
  if (!env.TMDB_API_TOKEN || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) return body;

  try {
    const url = new URL(`${TMDB_API_BASE}/tv/${tmdbId}`);
    url.searchParams.set("language", language);
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${env.TMDB_API_TOKEN}`
      }
    });
    if (!response.ok) return body;

    const localized = await response.json();
    if (localized?.overview) show.overview = localized.overview;
    if (localized?.tagline && body.data.media) body.data.media.tagline = localized.tagline;

    const localizedSeasons = new Map(
      (localized?.seasons || [])
        .filter((season) => Number.isInteger(Number(season?.season_number)))
        .map((season) => [Number(season.season_number), season])
    );
    for (const season of body?.data?.seasons || []) {
      const translated = localizedSeasons.get(Number(season.season_number));
      if (!translated) continue;
      if (translated.name) season.localized_name = translated.name;
      if (translated.overview) season.localized_overview = translated.overview;
    }

    body.meta = { ...body.meta, detailLanguage: language, localizedText: Boolean(localized?.overview || localized?.tagline) };
  } catch {
    // Stored English detail and the already-fetched media remain a safe fallback.
  }
  return body;
}

async function listSeasonEpisodes(env, showId, seasonNumber) {
  if (!env.DB) {
    return json({ data: [], meta: { count: 0, showId, seasonNumber, source: "TVmaze", databaseConfigured: false } });
  }
  if (!Number.isSafeInteger(showId) || showId <= 0 || !Number.isSafeInteger(seasonNumber) || seasonNumber <= 0) {
    return json({ ok: false, error: "invalid_season_episode_request" }, { status: 400 });
  }

  try {
    const result = await env.DB.prepare(
      `SELECT
        e.id,
        e.tvmaze_id,
        se.season_number,
        e.episode_number,
        e.name,
        e.overview,
        e.air_date,
        e.air_time,
        e.air_timestamp,
        e.runtime_minutes,
        e.image_url,
        e.source_url
       FROM episodes e
       JOIN seasons se ON se.id = e.season_id
       WHERE se.show_id = ?1 AND se.season_number = ?2
       ORDER BY
         CASE WHEN e.episode_number IS NULL THEN 1 ELSE 0 END,
         e.episode_number ASC,
         COALESCE(e.air_timestamp, e.air_date, '9999-12-31') ASC
       LIMIT 200`
    ).bind(showId, seasonNumber).all();

    const rows = result.results || [];
    return json({
      data: rows,
      meta: {
        count: rows.length,
        showId,
        seasonNumber,
        source: "TVmaze",
        attribution_url: "https://www.tvmaze.com",
        phase: "6c-season-episodes"
      }
    });
  } catch (error) {
    return json({
      ok: false,
      error: "season_episodes_query_failed",
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 503 });
  }
}

async function episodeSearchMatches(env, query, titleRegion, limit) {
  if (!env.DB) return [];
  const pattern = `%${query}%`;
  const result = await env.DB.prepare(
    `SELECT
      s.id,
      s.tmdb_id,
      s.original_title,
      s.english_title,
      s.status,
      s.tmdb_status,
      s.poster_url,
      s.vote_average,
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
      (SELECT GROUP_CONCAT(g.name, ' · ') FROM show_genres sg JOIN genres g ON g.id = sg.genre_id WHERE sg.show_id = s.id ORDER BY g.name ASC) AS genres,
      (SELECT se.season_number FROM seasons se WHERE se.show_id = s.id ORDER BY se.season_number DESC LIMIT 1) AS latest_season_number,
      (SELECT e2.name FROM episodes e2 JOIN seasons se2 ON se2.id = e2.season_id WHERE se2.show_id = s.id AND e2.name LIKE ?1 COLLATE NOCASE ORDER BY COALESCE(e2.air_timestamp, e2.air_date, '') DESC, e2.episode_number DESC LIMIT 1) AS search_match_episode,
      (SELECT se2.season_number FROM episodes e2 JOIN seasons se2 ON se2.id = e2.season_id WHERE se2.show_id = s.id AND e2.name LIKE ?1 COLLATE NOCASE ORDER BY COALESCE(e2.air_timestamp, e2.air_date, '') DESC, e2.episode_number DESC LIMIT 1) AS search_match_season_number,
      (SELECT e2.episode_number FROM episodes e2 JOIN seasons se2 ON se2.id = e2.season_id WHERE se2.show_id = s.id AND e2.name LIKE ?1 COLLATE NOCASE ORDER BY COALESCE(e2.air_timestamp, e2.air_date, '') DESC, e2.episode_number DESC LIMIT 1) AS search_match_episode_number
     FROM shows s
     LEFT JOIN preferred_show_titles pt ON pt.show_id = s.id
     WHERE EXISTS (
       SELECT 1
       FROM episodes search_episode
       JOIN seasons search_season ON search_season.id = search_episode.season_id
       WHERE search_season.show_id = s.id
         AND search_episode.name LIKE ?1 COLLATE NOCASE
     )
     ORDER BY COALESCE(s.popularity, 0) DESC, s.id DESC
     LIMIT ?2`
  ).bind(pattern, limit).all();

  return (result.results || []).map((row) => withResolvedChineseTitle(row, titleRegion));
}

async function globalSearch(request, env, ctx, url) {
  const query = normalizeSearchQuery(url);
  const limit = normalizeSearchLimit(url);
  const titleRegion = normalizeTitleRegion(url.searchParams.get("region"));
  if (!query) {
    return json({ data: [], meta: { count: 0, query: null, titleRegion, global: true } });
  }

  try {
    const catalogUrl = new URL(request.url);
    catalogUrl.pathname = "/api/shows";
    catalogUrl.search = "";
    catalogUrl.searchParams.set("q", query);
    catalogUrl.searchParams.set("limit", String(limit));
    catalogUrl.searchParams.set("region", titleRegion);

    const catalogResponse = await phase5eWorker.fetch(new Request(catalogUrl.toString(), request), env, ctx);
    if (!catalogResponse.ok) return catalogResponse;
    const catalogPayload = await catalogResponse.json();
    const titleMatches = Array.isArray(catalogPayload?.data) ? catalogPayload.data : [];
    const episodeMatches = await episodeSearchMatches(env, query, titleRegion, limit);
    const episodeByShow = new Map(episodeMatches.map((show) => [Number(show.id), show]));

    const merged = [];
    const seen = new Set();
    for (const show of titleMatches) {
      const id = Number(show.id);
      const episodeMatch = episodeByShow.get(id);
      merged.push(episodeMatch ? {
        ...show,
        search_match_episode: episodeMatch.search_match_episode || null,
        search_match_season_number: episodeMatch.search_match_season_number || null,
        search_match_episode_number: episodeMatch.search_match_episode_number || null
      } : show);
      seen.add(id);
      if (merged.length >= limit) break;
    }
    for (const show of episodeMatches) {
      const id = Number(show.id);
      if (seen.has(id) || merged.length >= limit) continue;
      merged.push(show);
      seen.add(id);
    }

    return json({
      data: merged,
      meta: {
        count: merged.length,
        query,
        titleRegion,
        global: true,
        titleMatchCount: titleMatches.length,
        episodeMatchCount: episodeMatches.length
      }
    });
  } catch (error) {
    return json({
      ok: false,
      error: "global_search_failed",
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 503 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const detailsMatch = request.method === "GET" && url.pathname.match(/^\/api\/shows\/(\d+)\/details$/);
    const seasonEpisodesMatch = request.method === "GET" && url.pathname.match(/^\/api\/shows\/(\d+)\/seasons\/(\d+)\/episodes$/);

    if (request.method === "GET" && url.pathname === "/api/search") {
      return globalSearch(request, env, ctx, url);
    }

    if (detailsMatch) {
      try {
        const region = url.searchParams.get("region");
        const result = await buildShowDetail(env, Number(detailsMatch[1]), region);
        if (result.status === 200) await localizeDetailBody(env, result.body, result.body?.meta?.titleRegion || region);
        return json(result.body, { status: result.status });
      } catch (error) {
        return json({
          ok: false,
          error: "show_detail_failed",
          detail: error instanceof Error ? error.message : String(error)
        }, { status: 503 });
      }
    }

    if (seasonEpisodesMatch) {
      return listSeasonEpisodes(env, Number(seasonEpisodesMatch[1]), Number(seasonEpisodesMatch[2]));
    }

    return phase5eWorker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    return phase5eWorker.scheduled(controller, env, ctx);
  }
};
