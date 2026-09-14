import phase8Worker from "./phase8-worker.js";
import { deriveTmdbSyncKey } from "./index.js";
import { syncTmdbKoreanCatalog } from "./tmdb-korea.js";

const KOREA_SYNC_CRON = "17 */6 * * *";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function authorizeSync(request, env) {
  if (!env.TMDB_API_TOKEN) return false;
  const provided = request.headers.get("x-series-hub-sync-key") || "";
  const expected = await deriveTmdbSyncKey(env.TMDB_API_TOKEN);
  return constantTimeEqual(provided, expected);
}

async function runKoreanTmdbSync(request, env) {
  if (!env.TMDB_API_TOKEN) {
    return json({ ok: false, error: "tmdb_not_configured" }, { status: 503 });
  }
  if (!(await authorizeSync(request, env))) {
    return json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncTmdbKoreanCatalog(env);
    return json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    return json({
      ok: false,
      error: "tmdb_korea_sync_failed",
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 502 });
  }
}

async function koreanSyncStatus(env) {
  if (!env.DB) return json({ data: null, meta: { source: "tmdb_kr", phase: "10a-korea-catalog" } });

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
      WHERE s.source_key = 'tmdb_kr'
      ORDER BY sr.id DESC
      LIMIT 1`
    ).first();

    return json({
      data: row || null,
      meta: { source: "tmdb_kr", market: "KR", phase: "10a-korea-catalog" }
    });
  } catch (error) {
    return json({
      ok: false,
      error: "korea_sync_status_query_failed",
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 503 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/internal/tmdb-sync-kr") {
      return runKoreanTmdbSync(request, env);
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/sync-status" &&
      url.searchParams.get("source") === "tmdb_kr"
    ) {
      return koreanSyncStatus(env);
    }

    return phase8Worker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    await phase8Worker.scheduled(controller, env, ctx);

    if (controller.cron === KOREA_SYNC_CRON && env.TMDB_API_TOKEN) {
      ctx.waitUntil(
        syncTmdbKoreanCatalog(env).catch((error) =>
          console.error("TMDB Korea scheduled sync failed", error)
        )
      );
    }
  }
};
