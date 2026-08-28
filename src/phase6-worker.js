import phase5eWorker from "./phase5e-worker.js";
import { buildShowDetail } from "./phase6-details.js";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const detailsMatch = request.method === "GET" && url.pathname.match(/^\/api\/shows\/(\d+)\/details$/);

    if (detailsMatch) {
      try {
        const result = await buildShowDetail(env, Number(detailsMatch[1]), url.searchParams.get("region"));
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
