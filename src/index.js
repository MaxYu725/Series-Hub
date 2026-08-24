const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

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
    phase: "0-foundation",
    databaseConfigured,
    databaseReachable,
    timestamp: new Date().toISOString()
  });
}

async function listShows(env, url) {
  if (!env.DB) {
    return json({
      data: [],
      meta: {
        count: 0,
        databaseConfigured: false,
        phase: "0-foundation"
      }
    });
  }

  const limitValue = Number(url.searchParams.get("limit") || 50);
  const limit = Number.isFinite(limitValue)
    ? Math.min(Math.max(Math.trunc(limitValue), 1), 100)
    : 50;

  try {
    const result = await env.DB.prepare(
      `SELECT
        id,
        original_title,
        original_language,
        origin_country,
        first_air_date,
        status,
        poster_url,
        backdrop_url,
        updated_at
      FROM shows
      ORDER BY updated_at DESC, id DESC
      LIMIT ?1`
    )
      .bind(limit)
      .all();

    const rows = result.results || [];

    return json({
      data: rows,
      meta: {
        count: rows.length,
        databaseConfigured: true,
        phase: "0-foundation"
      }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: "database_query_failed",
        message: "D1 is bound but the Series Hub schema is not ready.",
        detail: error instanceof Error ? error.message : String(error)
      },
      { status: 503 }
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

    if (url.pathname.startsWith("/api/")) {
      return routeNotFound(url.pathname);
    }

    return env.ASSETS.fetch(request);
  }
};
