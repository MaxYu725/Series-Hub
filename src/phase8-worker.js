import phase7Worker from "./phase7-worker.js";
import { buildDiscovery } from "./phase8-discovery.js";
import { buildBrowse } from "./phase8-browse.js";
import { improveSearchPayload } from "./phase8-search.js";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

async function rankedGlobalSearch(request, env, ctx, url) {
  const response = await phase7Worker.fetch(request, env, ctx);
  if (!response.ok) return response;

  const query = String(url.searchParams.get("q") || "").trim().slice(0, 80);
  if (!query) return response;

  const payload = await response.json();
  return json(improveSearchPayload(payload, query), { status: response.status });
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

    if (request.method === "GET" && url.pathname === "/api/search") {
      return rankedGlobalSearch(request, env, ctx, url);
    }

    return phase7Worker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    return phase7Worker.scheduled(controller, env, ctx);
  }
};
