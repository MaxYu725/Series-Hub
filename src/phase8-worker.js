import phase7Worker from "./phase7-worker.js";
import { buildDiscovery } from "./phase8-discovery.js";
import { buildBrowse } from "./phase8-browse.js";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/discover") {
      const result = url.searchParams.get("mode") === "browse"
        ? await buildBrowse(env, url)
        : await buildDiscovery(env, url);
      return json(result.body, { status: result.status });
    }

    return phase7Worker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    return phase7Worker.scheduled(controller, env, ctx);
  }
};
