import phase6Worker from "./phase6-worker.js";
import { buildWatchAvailability } from "./phase7-watch.js";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const watchMatch = request.method === "GET" && url.pathname.match(/^\/api\/shows\/(\d+)\/watch-providers$/);

    if (watchMatch) {
      try {
        const result = await buildWatchAvailability(env, Number(watchMatch[1]));
        return json(result.body, { status: result.status });
      } catch (error) {
        return json({
          ok: false,
          error: "watch_availability_failed",
          detail: error instanceof Error ? error.message : String(error)
        }, { status: 503 });
      }
    }

    return phase6Worker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    return phase6Worker.scheduled(controller, env, ctx);
  }
};
