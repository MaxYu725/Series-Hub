const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const WATCH_REGIONS = Object.freeze([
  { code: "HK", label: "香港" },
  { code: "US", label: "美國" }
]);
const WATCH_GROUPS = Object.freeze(["flatrate", "free", "ads", "rent", "buy"]);

function providerLogoUrl(path) {
  if (!path || typeof path !== "string") return null;
  return `${TMDB_IMAGE_BASE}/w92${path}`;
}

function safeTmdbWatchLink(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !(host === "themoviedb.org" || host.endsWith(".themoviedb.org"))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeProviderList(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && (item.provider_id !== null && item.provider_id !== undefined))
    .map((item) => ({
      provider_id: Number(item.provider_id),
      name: String(item.provider_name || "").trim() || `Provider ${item.provider_id}`,
      logo_url: providerLogoUrl(item.logo_path),
      display_priority: Number.isFinite(Number(item.display_priority)) ? Number(item.display_priority) : 9999
    }))
    .filter((item) => {
      if (!Number.isSafeInteger(item.provider_id) || item.provider_id <= 0 || seen.has(item.provider_id)) return false;
      seen.add(item.provider_id);
      return true;
    })
    .sort((left, right) => left.display_priority - right.display_priority || left.name.localeCompare(right.name));
}

function emptyRegion(region) {
  return {
    code: region.code,
    label: region.label,
    link: null,
    available: false,
    groups: Object.fromEntries(WATCH_GROUPS.map((group) => [group, []]))
  };
}

export function normalizeWatchProviders(payload = {}) {
  const results = payload?.results && typeof payload.results === "object" ? payload.results : {};
  const regions = {};

  for (const region of WATCH_REGIONS) {
    const source = results[region.code];
    if (!source || typeof source !== "object") {
      regions[region.code] = emptyRegion(region);
      continue;
    }

    const groups = Object.fromEntries(
      WATCH_GROUPS.map((group) => [group, normalizeProviderList(source[group])])
    );
    const available = WATCH_GROUPS.some((group) => groups[group].length > 0);
    regions[region.code] = {
      code: region.code,
      label: region.label,
      link: safeTmdbWatchLink(source.link),
      available,
      groups
    };
  }

  return {
    regions,
    attribution: {
      source: "JustWatch",
      via: "TMDB",
      required: true,
      url: "https://www.justwatch.com/"
    }
  };
}

async function tmdbWatchProvidersRequest(env, tmdbId) {
  const url = new URL(`${TMDB_API_BASE}/tv/${tmdbId}/watch/providers`);
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${env.TMDB_API_TOKEN}`
    }
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`TMDB ${response.status} watch providers request failed: ${detail}`);
  }
  return response.json();
}

async function loadShowIdentity(env, showId) {
  return env.DB.prepare(
    "SELECT id, tmdb_id, english_title, original_title FROM shows WHERE id = ?1 LIMIT 1"
  ).bind(showId).first();
}

export async function buildWatchAvailability(env, showId) {
  if (!env.DB) {
    return { status: 503, body: { ok: false, error: "database_not_configured" } };
  }

  const numericShowId = Number(showId);
  if (!Number.isSafeInteger(numericShowId) || numericShowId <= 0) {
    return { status: 400, body: { ok: false, error: "invalid_show_id" } };
  }

  const show = await loadShowIdentity(env, numericShowId);
  if (!show) return { status: 404, body: { ok: false, error: "show_not_found", showId: numericShowId } };

  const tmdbId = Number(show.tmdb_id);
  if (!env.TMDB_API_TOKEN || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
    return {
      status: 200,
      body: {
        data: normalizeWatchProviders({}),
        meta: {
          phase: "7c-watch-availability",
          showId: numericShowId,
          tmdbId: Number.isSafeInteger(tmdbId) && tmdbId > 0 ? tmdbId : null,
          configured: Boolean(env.TMDB_API_TOKEN),
          checkedRegions: WATCH_REGIONS.map((region) => region.code),
          error: null
        }
      }
    };
  }

  try {
    const payload = await tmdbWatchProvidersRequest(env, tmdbId);
    return {
      status: 200,
      body: {
        data: normalizeWatchProviders(payload),
        meta: {
          phase: "7c-watch-availability",
          showId: numericShowId,
          tmdbId,
          configured: true,
          checkedRegions: WATCH_REGIONS.map((region) => region.code),
          error: null
        }
      }
    };
  } catch (error) {
    return {
      status: 200,
      body: {
        data: normalizeWatchProviders({}),
        meta: {
          phase: "7c-watch-availability",
          showId: numericShowId,
          tmdbId,
          configured: true,
          checkedRegions: WATCH_REGIONS.map((region) => region.code),
          error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300)
        }
      }
    };
  }
}
