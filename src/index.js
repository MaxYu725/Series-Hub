import { syncTmdbCatalog } from "./tmdb.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const PUBLIC_STATUSES = new Set(["airing", "upcoming", "planned", "completed", "unknown"]);
const SYNC_KEY_CONTEXT = "series-hub:tmdb-sync:v1:";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});

  for (const [key, value] of Object.entries(JSON_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }

  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers
  });
}

function routeNotFound(pathname) {
  return json(
    {
      ok: false,
      error: "not_found",
      path: pathname
    },
    { status: 404 }
  );
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
    phase: "1-tmdb-core",
    databaseConfigured,
    databaseReachable,
    tmdbConfigured: Boolean(env.TMDB_API_TOKEN),
    timestamp: new Date().toISOString()
  });
}

function normalizeLimit(url) {
  const limitValue = Number(url.searchParams.get("limit") || 50);
  return Number.isFinite(limitValue)
    ? Math.min(Math.max(Math.trunc(limitValue), 1), 100)
    : 50;
}

function normalizeStatus(url) {
  const requested = url.searchParams.get("status") || url.searchParams.get("view");
  return requested && PUBLIC_STATUSES.has(requested) ? requested : null;
}

function normalizeQuery(url) {
  const value = (url.searchParams.get("q") || "").trim();
  return value ? value.slice(0, 80) : null;
}

async function listShows(env, url) {
  if (!env.DB) {
    return json({
      data: [],
      meta: {
        count: 0,
        databaseConfigured: false,
        phase: "1-tmdb-core"
      }
    });
  }

  const limit = normalizeLimit(url);
  const status = normalizeStatus(url);
  const query = normalizeQuery(url);
  const queryPattern = query ? `%${query}%` : null;

  try {
    const result = await env.DB.prepare(
      `SELECT
        s.id,
        s.tmdb_id,
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
        s.updated_at,
        (
          SELECT ta.title
          FROM title_aliases ta
          WHERE ta.show_id = s.id
            AND ta.season_id IS NULL
            AND ta.locale = 'zh'
            AND ta.region = 'HK'
          ORDER BY ta.is_preferred DESC, ta.id ASC
          LIMIT 1
        ) AS title_zh_hk,
        (
          SELECT ta.title
          FROM title_aliases ta
          WHERE ta.show_id = s.id
            AND ta.season_id IS NULL
            AND ta.locale = 'zh'
            AND ta.region = 'TW'
          ORDER BY ta.is_preferred DESC, ta.id ASC
          LIMIT 1
        ) AS title_zh_tw,
        (
          SELECT ta.title
          FROM title_aliases ta
          WHERE ta.show_id = s.id
            AND ta.season_id IS NULL
            AND ta.locale = 'zh'
            AND ta.region = 'CN'
          ORDER BY ta.is_preferred DESC, ta.id ASC
          LIMIT 1
        ) AS title_zh_cn,
        (
          SELECT GROUP_CONCAT(n.canonical_name, ' · ')
          FROM show_networks sn
          JOIN networks n ON n.id = sn.network_id
          WHERE sn.show_id = s.id
          ORDER BY sn.is_primary DESC, n.canonical_name ASC
        ) AS networks,
        (
          SELECT GROUP_CONCAT(g.name, ' · ')
          FROM show_genres sg
          JOIN genres g ON g.id = sg.genre_id
          WHERE sg.show_id = s.id
          ORDER BY g.name ASC
        ) AS genres,
        (
          SELECT se.season_number
          FROM seasons se
          WHERE se.show_id = s.id
          ORDER BY se.season_number DESC
          LIMIT 1
        ) AS latest_season_number,
        (
          SELECT se.lifecycle_status
          FROM seasons se
          WHERE se.show_id = s.id
          ORDER BY se.season_number DESC
          LIMIT 1
        ) AS latest_season_status,
        (
          SELECT se.premiere_date
          FROM seasons se
          WHERE se.show_id = s.id
          ORDER BY se.season_number DESC
          LIMIT 1
        ) AS latest_season_premiere_date
      FROM shows s
      WHERE (?1 IS NULL OR s.status = ?1)
        AND (
          ?2 IS NULL
          OR s.english_title LIKE ?2 COLLATE NOCASE
          OR s.original_title LIKE ?2 COLLATE NOCASE
          OR EXISTS (
            SELECT 1
            FROM title_aliases search_alias
            WHERE search_alias.show_id = s.id
              AND search_alias.title LIKE ?2 COLLATE NOCASE
          )
        )
      ORDER BY
        CASE s.status
          WHEN 'airing' THEN 0
          WHEN 'upcoming' THEN 1
          WHEN 'planned' THEN 2
          ELSE 3
        END,
        CASE WHEN s.status = 'upcoming' THEN COALESCE(s.next_air_date, '9999-12-31') END ASC,
        COALESCE(s.popularity, 0) DESC,
        s.id DESC
      LIMIT ?3`
    )
      .bind(status, queryPattern, limit)
      .all();

    const rows = result.results || [];

    return json({
      data: rows,
      meta: {
        count: rows.length,
        databaseConfigured: true,
        tmdbConfigured: Boolean(env.TMDB_API_TOKEN),
        status,
        query,
        phase: "1-tmdb-core"
      }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: "database_query_failed",
        message: "D1 is bound but the Phase 1 catalog schema is not ready.",
        detail: error instanceof Error ? error.message : String(error)
      },
      { status: 503 }
    );
  }
}

async function lastSync(env) {
  if (!env.DB) return json({ data: null });

  try {
    const row = await env.DB.prepare(
      `SELECT
        sr.status,
        sr.started_at,
        sr.finished_at,
        sr.records_seen,
        sr.records_changed,
        sr.error_summary
      FROM sync_runs sr
      JOIN sources s ON s.id = sr.source_id
      WHERE s.source_key = 'tmdb'
      ORDER BY sr.id DESC
      LIMIT 1`
    ).first();

    return json({ data: row || null });
  } catch (error) {
    return json(
      {
        ok: false,
        error: "sync_status_query_failed",
        detail: error instanceof Error ? error.message : String(error)
      },
      { status: 503 }
    );
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
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function runTmdbSync(request, env) {
  if (!env.TMDB_API_TOKEN) {
    return json(
      { ok: false, error: "tmdb_not_configured" },
      { status: 503 }
    );
  }

  const provided = request.headers.get("x-series-hub-sync-key") || "";
  const expected = await deriveTmdbSyncKey(env.TMDB_API_TOKEN);
  if (!constantTimeEqual(provided, expected)) {
    return json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncTmdbCatalog(env);
    return json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    return json(
      {
        ok: false,
        error: "tmdb_sync_failed",
        detail: error instanceof Error ? error.message : String(error)
      },
      { status: 502 }
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return health(env);
    }

    if (request.method === "GET" && url.pathname === "/api/shows") {
      return listShows(env, url);
    }

    if (request.method === "GET" && url.pathname === "/api/sync-status") {
      return lastSync(env);
    }

    if (request.method === "POST" && url.pathname === "/api/internal/tmdb-sync") {
      return runTmdbSync(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return routeNotFound(url.pathname);
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller, env, ctx) {
    if (!env.TMDB_API_TOKEN) {
      console.warn("TMDB scheduled sync skipped: TMDB_API_TOKEN is not configured");
      return;
    }

    ctx.waitUntil(
      syncTmdbCatalog(env).catch((error) => {
        console.error("TMDB scheduled sync failed", error);
      })
    );
  }
};
