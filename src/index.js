import { syncTmdbCatalog } from "./tmdb.js";
import { syncTvmazeEpisodes } from "./tvmaze.js";
import { applyTitleOverride } from "./title-admin.js";
import { normalizeTitleRegion, withResolvedChineseTitle } from "./title-aliases.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const PHASE = "3-regional-titles";
const PUBLIC_STATUSES = new Set(["airing", "upcoming", "planned", "completed", "unknown"]);
const SYNC_SOURCES = new Set(["tmdb", "tvmaze"]);
const SYNC_KEY_CONTEXT = "series-hub:tmdb-sync:v1:";
const TMDB_CRON = "17 */6 * * *";
const TVMAZE_CRON = "47 */6 * * *";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  for (const [key, value] of Object.entries(JSON_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

function routeNotFound(pathname) {
  return json({ ok: false, error: "not_found", path: pathname }, { status: 404 });
}

async function health(env) {
  const databaseConfigured = Boolean(env.DB);
  let databaseReachable = null;

  if (databaseConfigured) {
    try {
      await env.DB.prepare("SELECT 1 AS ok").first();
      databaseReachable = true;
    } catch {
      databaseReachable = false;
    }
  }

  return json({
    ok: true,
    service: "series-hub",
    phase: PHASE,
    databaseConfigured,
    databaseReachable,
    tmdbConfigured: Boolean(env.TMDB_API_TOKEN),
    tvmazeEnabled: true,
    titleAliasPolicy: "phase-3",
    timestamp: new Date().toISOString()
  });
}

function normalizeLimit(url) {
  const limitValue = Number(url.searchParams.get("limit") || 50);
  return Number.isFinite(limitValue) ? Math.min(Math.max(Math.trunc(limitValue), 1), 100) : 50;
}

function normalizeStatus(url) {
  const requested = url.searchParams.get("status") || url.searchParams.get("view");
  return requested && PUBLIC_STATUSES.has(requested) ? requested : null;
}

function normalizeQuery(url) {
  const value = (url.searchParams.get("q") || "").trim();
  return value ? value.slice(0, 80) : null;
}

function requestedTitleRegion(url) {
  return normalizeTitleRegion(url.searchParams.get("region"));
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(date, days) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function resolveRows(rows, titleRegion) {
  return rows.map((row) => withResolvedChineseTitle(row, titleRegion));
}

async function listShows(env, url) {
  if (!env.DB) {
    return json({ data: [], meta: { count: 0, databaseConfigured: false, phase: PHASE } });
  }

  const limit = normalizeLimit(url);
  const status = normalizeStatus(url);
  const query = normalizeQuery(url);
  const titleRegion = requestedTitleRegion(url);
  const queryPattern = query ? `%${query}%` : null;

  try {
    const result = await env.DB.prepare(
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
        s.updated_at,
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
        (SELECT se.lifecycle_status FROM seasons se WHERE se.show_id = s.id ORDER BY se.season_number DESC LIMIT 1) AS latest_season_status,
        (SELECT se.premiere_date FROM seasons se WHERE se.show_id = s.id ORDER BY se.season_number DESC LIMIT 1) AS latest_season_premiere_date,
        (SELECT e.air_date FROM episodes e JOIN seasons se ON se.id = e.season_id WHERE se.show_id = s.id AND e.air_date <= date('now') ORDER BY e.air_date DESC, e.episode_number DESC LIMIT 1) AS tvmaze_last_episode_date,
        (SELECT e.air_date FROM episodes e JOIN seasons se ON se.id = e.season_id WHERE se.show_id = s.id AND e.air_date >= date('now') ORDER BY e.air_date ASC, e.episode_number ASC LIMIT 1) AS tvmaze_next_episode_date
      FROM shows s
      LEFT JOIN preferred_show_titles pt ON pt.show_id = s.id
      WHERE (?1 IS NULL OR s.status = ?1)
        AND (
          ?2 IS NULL
          OR s.english_title LIKE ?2 COLLATE NOCASE
          OR s.original_title LIKE ?2 COLLATE NOCASE
          OR EXISTS (SELECT 1 FROM title_aliases search_alias WHERE search_alias.show_id = s.id AND search_alias.title LIKE ?2 COLLATE NOCASE)
        )
      ORDER BY
        CASE s.status WHEN 'airing' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'planned' THEN 2 ELSE 3 END,
        CASE WHEN s.status = 'upcoming' THEN COALESCE(s.next_air_date, '9999-12-31') END ASC,
        COALESCE(s.popularity, 0) DESC,
        s.id DESC
      LIMIT ?3`
    ).bind(status, queryPattern, limit).all();

    const rows = resolveRows(result.results || [], titleRegion);
    return json({
      data: rows,
      meta: {
        count: rows.length,
        databaseConfigured: true,
        tmdbConfigured: Boolean(env.TMDB_API_TOKEN),
        status,
        query,
        titleRegion,
        phase: PHASE
      }
    });
  } catch (error) {
    return json({
      ok: false,
      error: "database_query_failed",
      message: "D1 is bound but the current catalog schema is not ready.",
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 503 });
  }
}

async function listSchedule(env, url) {
  if (!env.DB) return json({ data: [], meta: { count: 0, phase: PHASE } });

  const from = validDate(url.searchParams.get("from")) ? url.searchParams.get("from") : todayUtc();
  const requestedDays = Number(url.searchParams.get("days") || 7);
  const days = Number.isFinite(requestedDays) ? Math.min(Math.max(Math.trunc(requestedDays), 1), 14) : 7;
  const through = addDays(from, days - 1);
  const titleRegion = requestedTitleRegion(url);

  try {
    const result = await env.DB.prepare(
      `SELECT
        e.id,
        e.tvmaze_id,
        e.episode_number,
        e.name AS episode_name,
        e.overview AS episode_overview,
        e.air_date,
        e.air_time,
        e.air_timestamp,
        e.runtime_minutes,
        e.image_url,
        e.source_url,
        se.season_number,
        s.id AS show_id,
        s.tmdb_id,
        s.english_title,
        s.original_title,
        s.poster_url,
        s.status AS show_status,
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
        (SELECT GROUP_CONCAT(n.canonical_name, ' · ') FROM show_networks sn JOIN networks n ON n.id = sn.network_id WHERE sn.show_id = s.id ORDER BY sn.is_primary DESC, n.canonical_name ASC) AS networks
      FROM episodes e
      JOIN seasons se ON se.id = e.season_id
      JOIN shows s ON s.id = se.show_id
      LEFT JOIN preferred_show_titles pt ON pt.show_id = s.id
      WHERE e.air_date BETWEEN ?1 AND ?2
        AND s.status IN ('airing', 'upcoming', 'planned')
      ORDER BY e.air_date ASC, COALESCE(e.air_timestamp, e.air_time, '99:99') ASC, s.english_title ASC`
    ).bind(from, through).all();

    const rows = resolveRows(result.results || [], titleRegion);
    return json({
      data: rows,
      meta: {
        count: rows.length,
        from,
        through,
        days,
        titleRegion,
        phase: PHASE,
        source: "TVmaze",
        attribution_url: "https://www.tvmaze.com"
      }
    });
  } catch (error) {
    return json({ ok: false, error: "schedule_query_failed", detail: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}

async function listShowEpisodes(env, showId, url) {
  if (!env.DB) return json({ data: [], meta: { count: 0, showId, phase: PHASE } });
  const limit = normalizeLimit(url);

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
       WHERE se.show_id = ?1
       ORDER BY e.air_date DESC, se.season_number DESC, e.episode_number DESC
       LIMIT ?2`
    ).bind(showId, limit).all();

    const rows = result.results || [];
    return json({
      data: rows,
      meta: { count: rows.length, showId, phase: PHASE, source: "TVmaze", attribution_url: "https://www.tvmaze.com" }
    });
  } catch (error) {
    return json({ ok: false, error: "episodes_query_failed", detail: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}

async function listShowAliases(env, showId, url) {
  if (!env.DB) return json({ data: [], meta: { count: 0, showId, phase: PHASE } });
  const titleRegion = requestedTitleRegion(url);

  try {
    const [aliasesResult, preferred] = await Promise.all([
      env.DB.prepare(
        `SELECT
          id,
          locale,
          region,
          title,
          source_key,
          is_preferred,
          confidence,
          created_at,
          updated_at
        FROM title_aliases
        WHERE show_id = ?1 AND season_id IS NULL
        ORDER BY
          locale ASC,
          region ASC,
          CASE
            WHEN source_key = 'manual' AND is_preferred = 1 THEN 0
            WHEN is_preferred = 1 THEN 1
            WHEN source_key = 'manual' THEN 2
            ELSE 3
          END ASC,
          CASE confidence
            WHEN 'official' THEN 0
            WHEN 'high' THEN 1
            WHEN 'normal' THEN 2
            WHEN 'unverified' THEN 3
            ELSE 4
          END ASC,
          updated_at DESC,
          id DESC`
      ).bind(showId).all(),
      env.DB.prepare(
        `SELECT * FROM preferred_show_titles WHERE show_id = ?1 LIMIT 1`
      ).bind(showId).first()
    ]);

    const data = aliasesResult.results || [];
    const resolved = withResolvedChineseTitle(preferred || {}, titleRegion);
    return json({
      data,
      preferred: {
        title: resolved.display_title_zh,
        requestedRegion: resolved.display_title_zh_requested_region,
        region: resolved.display_title_zh_region,
        source: resolved.display_title_zh_source,
        confidence: resolved.display_title_zh_confidence,
        fallback: resolved.display_title_zh_fallback
      },
      meta: { count: data.length, showId, titleRegion, phase: PHASE }
    });
  } catch (error) {
    return json({ ok: false, error: "aliases_query_failed", detail: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}

function coverageEntry(count, total) {
  const numericCount = Number(count || 0);
  const numericTotal = Number(total || 0);
  return {
    count: numericCount,
    percent: numericTotal > 0 ? Math.round((numericCount / numericTotal) * 1000) / 10 : 0
  };
}

async function titleAudit(env) {
  if (!env.DB) return json({ data: null, meta: { phase: PHASE } });

  try {
    const [summary, showsResult] = await Promise.all([
      env.DB.prepare(
        `SELECT
          COUNT(*) AS total_active,
          SUM(CASE WHEN pt.title_zh_hk IS NOT NULL THEN 1 ELSE 0 END) AS hk_count,
          SUM(CASE WHEN pt.title_zh_tw IS NOT NULL THEN 1 ELSE 0 END) AS tw_count,
          SUM(CASE WHEN pt.title_zh_cn IS NOT NULL THEN 1 ELSE 0 END) AS cn_count,
          SUM(CASE WHEN pt.title_zh_hk IS NOT NULL OR pt.title_zh_tw IS NOT NULL OR pt.title_zh_cn IS NOT NULL THEN 1 ELSE 0 END) AS any_zh_count,
          SUM(CASE WHEN pt.title_zh_hk_source = 'manual' OR pt.title_zh_tw_source = 'manual' OR pt.title_zh_cn_source = 'manual' THEN 1 ELSE 0 END) AS manual_override_shows
        FROM shows s
        LEFT JOIN preferred_show_titles pt ON pt.show_id = s.id
        WHERE s.status IN ('airing', 'upcoming', 'planned')`
      ).first(),
      env.DB.prepare(
        `SELECT
          s.id,
          s.english_title,
          s.status,
          pt.title_zh_hk,
          pt.title_zh_tw,
          pt.title_zh_cn
        FROM shows s
        LEFT JOIN preferred_show_titles pt ON pt.show_id = s.id
        WHERE s.status IN ('airing', 'upcoming', 'planned')
        ORDER BY COALESCE(s.popularity, 0) DESC, s.id DESC`
      ).all()
    ]);

    const total = Number(summary?.total_active || 0);
    const shows = showsResult.results || [];
    const missing = Object.fromEntries(
      ["HK", "TW", "CN"].map((region) => {
        const field = `title_zh_${region.toLowerCase()}`;
        return [region, shows.filter((show) => !show[field]).map((show) => ({ id: show.id, title: show.english_title, status: show.status }))];
      })
    );

    return json({
      data: {
        totalActive: total,
        anyChinese: coverageEntry(summary?.any_zh_count, total),
        coverage: {
          HK: coverageEntry(summary?.hk_count, total),
          TW: coverageEntry(summary?.tw_count, total),
          CN: coverageEntry(summary?.cn_count, total)
        },
        manualOverrideShows: Number(summary?.manual_override_shows || 0),
        missing
      },
      meta: { phase: PHASE, policy: "phase-3", sourcePriority: ["manual-preferred", "preferred-source", "manual-alias", "other-alias"] }
    });
  } catch (error) {
    return json({ ok: false, error: "title_audit_failed", detail: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}

async function lastSync(env, url) {
  if (!env.DB) return json({ data: null });
  const requested = url.searchParams.get("source") || "tmdb";
  const sourceKey = SYNC_SOURCES.has(requested) ? requested : "tmdb";

  try {
    const row = await env.DB.prepare(
      `SELECT
        s.source_key,
        sr.run_type,
        sr.status,
        sr.started_at,
        sr.finished_at,
        sr.records_seen,
        sr.records_changed,
        sr.error_summary
      FROM sync_runs sr
      JOIN sources s ON s.id = sr.source_id
      WHERE s.source_key = ?1
      ORDER BY sr.id DESC
      LIMIT 1`
    ).bind(sourceKey).first();

    return json({ data: row || null, meta: { source: sourceKey, phase: PHASE } });
  } catch (error) {
    return json({ ok: false, error: "sync_status_query_failed", detail: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function deriveTmdbSyncKey(token) {
  if (!token) return null;
  const encoded = new TextEncoder().encode(`${SYNC_KEY_CONTEXT}${token}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function authorizeSync(request, env) {
  if (!env.TMDB_API_TOKEN) return false;
  const provided = request.headers.get("x-series-hub-sync-key") || "";
  const expected = await deriveTmdbSyncKey(env.TMDB_API_TOKEN);
  return constantTimeEqual(provided, expected);
}

async function runTitleOverride(request, env) {
  if (!env.TMDB_API_TOKEN) return json({ ok: false, error: "title_admin_not_configured" }, { status: 503 });
  if (!(await authorizeSync(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const result = await applyTitleOverride(request, env);
    return json(result.body, { status: result.status });
  } catch (error) {
    return json({ ok: false, error: "title_override_failed", detail: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}

async function runTmdbSync(request, env) {
  if (!env.TMDB_API_TOKEN) return json({ ok: false, error: "tmdb_not_configured" }, { status: 503 });
  if (!(await authorizeSync(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const result = await syncTmdbCatalog(env);
    return json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    return json({ ok: false, error: "tmdb_sync_failed", detail: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}

async function runTvmazeSync(request, env) {
  if (!env.TMDB_API_TOKEN) return json({ ok: false, error: "tmdb_not_configured_for_mapping" }, { status: 503 });
  if (!(await authorizeSync(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const result = await syncTvmazeEpisodes(env);
    return json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    return json({ ok: false, error: "tvmaze_sync_failed", detail: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") return health(env);
    if (request.method === "GET" && url.pathname === "/api/shows") return listShows(env, url);
    if (request.method === "GET" && url.pathname === "/api/schedule") return listSchedule(env, url);
    if (request.method === "GET" && url.pathname === "/api/title-audit") return titleAudit(env);
    if (request.method === "GET" && url.pathname === "/api/sync-status") return lastSync(env, url);

    const aliasesMatch = request.method === "GET" && url.pathname.match(/^\/api\/shows\/(\d+)\/aliases$/);
    if (aliasesMatch) return listShowAliases(env, Number(aliasesMatch[1]), url);

    const episodeMatch = request.method === "GET" && url.pathname.match(/^\/api\/shows\/(\d+)\/episodes$/);
    if (episodeMatch) return listShowEpisodes(env, Number(episodeMatch[1]), url);

    if (request.method === "POST" && url.pathname === "/api/internal/title-override") return runTitleOverride(request, env);
    if (request.method === "POST" && url.pathname === "/api/internal/tmdb-sync") return runTmdbSync(request, env);
    if (request.method === "POST" && url.pathname === "/api/internal/tvmaze-sync") return runTvmazeSync(request, env);

    if (url.pathname.startsWith("/api/")) return routeNotFound(url.pathname);
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    if (!env.TMDB_API_TOKEN) {
      console.warn("Scheduled sync skipped: TMDB_API_TOKEN is not configured");
      return;
    }

    if (controller.cron === TVMAZE_CRON) {
      ctx.waitUntil(syncTvmazeEpisodes(env).catch((error) => console.error("TVmaze scheduled sync failed", error)));
      return;
    }

    if (controller.cron === TMDB_CRON || !controller.cron) {
      ctx.waitUntil(syncTmdbCatalog(env).catch((error) => console.error("TMDB scheduled sync failed", error)));
    }
  }
};
