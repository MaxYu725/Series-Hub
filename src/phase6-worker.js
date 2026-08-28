import phase5eWorker from "./phase5e-worker.js";
import { buildShowDetail } from "./phase6-details.js";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const REGION_LANGUAGE = Object.freeze({ HK: "zh-HK", TW: "zh-TW", CN: "zh-CN" });

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const detailsMatch = request.method === "GET" && url.pathname.match(/^\/api\/shows\/(\d+)\/details$/);

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

    return phase5eWorker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    return phase5eWorker.scheduled(controller, env, ctx);
  }
};
