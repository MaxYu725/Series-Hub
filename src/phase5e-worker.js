import phase4Worker from "./phase4-worker.js";
import { syncTvmazeEpisodes } from "./tvmaze.js";

export const TVMAZE_CONVERGENCE_CRON = "47 * * * *";

function jsonResponse(payload, response) {
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(payload, null, 2), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function enrichCatalogNextEpisodes(request, response, env) {
  if (!env.DB || !response.ok) return response;
  const url = new URL(request.url);
  if (url.pathname !== "/api/shows") return response;

  let payload;
  try {
    payload = await response.json();
  } catch {
    return response;
  }

  const shows = Array.isArray(payload?.data) ? payload.data : [];
  const showIds = [...new Set(shows.map((show) => Number(show?.id)).filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (showIds.length === 0) return jsonResponse(payload, response);

  const placeholders = showIds.map((_, index) => `?${index + 1}`).join(", ");
  const result = await env.DB.prepare(
    `SELECT
      se.show_id,
      se.season_number,
      e.episode_number,
      e.name AS episode_name,
      e.air_date,
      e.air_time,
      e.air_timestamp,
      e.source_url
     FROM episodes e
     JOIN seasons se ON se.id = e.season_id
     WHERE se.show_id IN (${placeholders})
       AND (
         (e.air_timestamp IS NOT NULL AND datetime(e.air_timestamp) >= datetime('now'))
         OR (e.air_timestamp IS NULL AND e.air_date >= date('now'))
       )
     ORDER BY
       se.show_id ASC,
       CASE WHEN e.air_timestamp IS NULL THEN 1 ELSE 0 END ASC,
       COALESCE(e.air_timestamp, e.air_date || 'T23:59:59Z') ASC,
       se.season_number ASC,
       e.episode_number ASC`
  ).bind(...showIds).all();

  const nextByShow = new Map();
  for (const episode of result.results || []) {
    const showId = Number(episode.show_id);
    if (!nextByShow.has(showId)) nextByShow.set(showId, episode);
  }

  payload.data = shows.map((show) => {
    const next = nextByShow.get(Number(show.id));
    if (!next) return show;
    return {
      ...show,
      tvmaze_next_episode_date: next.air_date || show.tvmaze_next_episode_date || null,
      tvmaze_next_episode_air_time: next.air_time || null,
      tvmaze_next_episode_timestamp: next.air_timestamp || null,
      tvmaze_next_episode_name: next.episode_name || null,
      tvmaze_next_episode_season_number: Number(next.season_number) || null,
      tvmaze_next_episode_number: Number(next.episode_number) || null,
      tvmaze_next_episode_source_url: next.source_url || null
    };
  });

  return jsonResponse(payload, response);
}

export default {
  async fetch(request, env, ctx) {
    const response = await phase4Worker.fetch(request, env, ctx);
    return enrichCatalogNextEpisodes(request, response, env);
  },

  async scheduled(controller, env, ctx) {
    if (controller.cron === TVMAZE_CONVERGENCE_CRON) {
      if (!env.TMDB_API_TOKEN) {
        console.warn("Hourly TVmaze convergence skipped: TMDB_API_TOKEN is not configured");
        return;
      }

      ctx.waitUntil(
        syncTvmazeEpisodes(env).catch((error) => console.error("Hourly TVmaze convergence failed", error))
      );
      return;
    }

    return phase4Worker.scheduled(controller, env, ctx);
  }
};
