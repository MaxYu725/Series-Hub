import coreWorker, { deriveTmdbSyncKey } from "./index.js";
import { applyLifecycleEvidence } from "./lifecycle-admin.js";
import { summarizeLifecycleEvents } from "./lifecycle.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  for (const [key, value] of Object.entries(JSON_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function authorizeEditorialWrite(request, env) {
  if (!env.TMDB_API_TOKEN) return false;
  const provided = request.headers.get("x-series-hub-sync-key") || "";
  const expected = await deriveTmdbSyncKey(env.TMDB_API_TOKEN);
  return constantTimeEqual(provided, expected);
}

const LIFECYCLE_SELECT = `SELECT
  id,
  evidence_key,
  show_id,
  season_id,
  season_number,
  event_type,
  source_key,
  source_name,
  source_type,
  trust_level,
  source_url,
  source_title,
  source_published_at,
  confidence,
  evidence_note,
  is_retracted,
  created_at,
  updated_at
FROM active_lifecycle_events`;

async function showLifecycle(env, showId) {
  if (!env.DB) return json({ data: [], summary: null, meta: { showId, count: 0, evidencePolicy: "phase-4a" } });

  try {
    const show = await env.DB.prepare(
      `SELECT id, tmdb_id, english_title, original_title, status
       FROM shows
       WHERE id = ?1
       LIMIT 1`
    ).bind(showId).first();
    if (!show) return json({ ok: false, error: "show_not_found", showId }, { status: 404 });

    const result = await env.DB.prepare(
      `${LIFECYCLE_SELECT}
       WHERE show_id = ?1
       ORDER BY source_published_at DESC, id DESC`
    ).bind(showId).all();

    const events = result.results || [];
    return json({
      show,
      data: events,
      summary: summarizeLifecycleEvents(events),
      meta: {
        showId,
        count: events.length,
        evidencePolicy: "phase-4a",
        authoritativeFactsOnly: true
      }
    });
  } catch (error) {
    return json({
      ok: false,
      error: "lifecycle_query_failed",
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 503 });
  }
}

async function lifecycleIndex(env) {
  if (!env.DB) return json({ data: {}, meta: { showCount: 0, eventCount: 0, projectionPolicy: "phase-4b" } });

  try {
    const result = await env.DB.prepare(
      `${LIFECYCLE_SELECT}
       WHERE show_id IN (
         SELECT id FROM shows WHERE status IN ('airing', 'upcoming', 'planned')
       )
       ORDER BY show_id ASC, source_published_at DESC, id DESC`
    ).all();

    const events = result.results || [];
    const grouped = new Map();
    for (const event of events) {
      const showId = String(event.show_id);
      if (!grouped.has(showId)) grouped.set(showId, []);
      grouped.get(showId).push(event);
    }

    const data = {};
    for (const [showId, rows] of grouped) {
      data[showId] = {
        events: rows,
        summary: summarizeLifecycleEvents(rows)
      };
    }

    return json({
      data,
      meta: {
        showCount: grouped.size,
        eventCount: events.length,
        projectionPolicy: "phase-4b",
        authoritativeFactsOnly: true
      }
    });
  } catch (error) {
    return json({
      ok: false,
      error: "lifecycle_index_query_failed",
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 503 });
  }
}

async function lifecycleEvidenceWrite(request, env) {
  if (!env.TMDB_API_TOKEN) return json({ ok: false, error: "lifecycle_admin_not_configured" }, { status: 503 });
  if (!(await authorizeEditorialWrite(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const result = await applyLifecycleEvidence(request, env);
    return json(result.body, { status: result.status });
  } catch (error) {
    return json({
      ok: false,
      error: "lifecycle_evidence_failed",
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 502 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/lifecycle") return lifecycleIndex(env);

    const lifecycleMatch = request.method === "GET" && url.pathname.match(/^\/api\/shows\/(\d+)\/lifecycle$/);
    if (lifecycleMatch) return showLifecycle(env, Number(lifecycleMatch[1]));

    if (request.method === "POST" && url.pathname === "/api/internal/lifecycle-evidence") {
      return lifecycleEvidenceWrite(request, env);
    }

    return coreWorker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    return coreWorker.scheduled(controller, env, ctx);
  }
};