import { normalizeTitleRegion, withResolvedChineseTitle } from "./title-aliases.js";
import { PHASE8_SHOW_SELECT } from "./phase8-catalog.js";

export const BROWSE_SORTS = Object.freeze({
  popular: Object.freeze({ label: "熱門程度", orderBy: "COALESCE(s.popularity, 0) DESC, COALESCE(s.vote_count, 0) DESC, s.id DESC" }),
  rating: Object.freeze({ label: "評分", orderBy: "CASE WHEN COALESCE(s.vote_count, 0) >= 100 THEN COALESCE(s.vote_average, 0) ELSE 0 END DESC, COALESCE(s.vote_count, 0) DESC, COALESCE(s.popularity, 0) DESC, s.id DESC" }),
  newest: Object.freeze({ label: "最新首播", orderBy: "CASE WHEN s.first_air_date IS NULL THEN 1 ELSE 0 END, s.first_air_date DESC, COALESCE(s.popularity, 0) DESC, s.id DESC" }),
  oldest: Object.freeze({ label: "最早首播", orderBy: "CASE WHEN s.first_air_date IS NULL THEN 1 ELSE 0 END, s.first_air_date ASC, COALESCE(s.popularity, 0) DESC, s.id DESC" }),
  title: Object.freeze({ label: "劇名 A–Z", orderBy: "LOWER(COALESCE(s.english_title, s.original_title, '')) ASC, s.id ASC" })
});

export const BROWSE_STATUSES = Object.freeze([
  Object.freeze({ value: "airing", label: "播映中" }),
  Object.freeze({ value: "upcoming", label: "即將播映" }),
  Object.freeze({ value: "planned", label: "計劃播出" }),
  Object.freeze({ value: "completed", label: "已完結" })
]);

const STATUS_VALUES = new Set(BROWSE_STATUSES.map((item) => item.value));

function normalizeTextFacet(value, maxLength = 80) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

export function normalizeBrowseLimit(url) {
  const value = Number(url?.searchParams?.get("limit") || 48);
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 12), 100) : 48;
}

export function normalizeBrowseFilters(url) {
  const rawStatus = String(url?.searchParams?.get("status") || "").trim().toLowerCase();
  const rawSort = String(url?.searchParams?.get("sort") || "popular").trim().toLowerCase();
  const rawYear = String(url?.searchParams?.get("year") || "").trim();
  const currentYear = new Date().getUTCFullYear();
  const yearNumber = /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;

  return {
    network: normalizeTextFacet(url?.searchParams?.get("network")),
    genre: normalizeTextFacet(url?.searchParams?.get("genre")),
    status: STATUS_VALUES.has(rawStatus) ? rawStatus : null,
    year: yearNumber && yearNumber >= 1900 && yearNumber <= currentYear + 2 ? String(yearNumber) : null,
    sort: Object.hasOwn(BROWSE_SORTS, rawSort) ? rawSort : "popular"
  };
}

function buildBrowseWhere(filters) {
  const clauses = [];
  const bindings = [];

  if (filters.network) {
    clauses.push("EXISTS (SELECT 1 FROM show_networks bsn JOIN networks bn ON bn.id = bsn.network_id WHERE bsn.show_id = s.id AND bn.canonical_name = ?)");
    bindings.push(filters.network);
  }
  if (filters.genre) {
    clauses.push("EXISTS (SELECT 1 FROM show_genres bsg JOIN genres bg ON bg.id = bsg.genre_id WHERE bsg.show_id = s.id AND bg.name = ?)");
    bindings.push(filters.genre);
  }
  if (filters.status) {
    clauses.push("s.status = ?");
    bindings.push(filters.status);
  }
  if (filters.year) {
    clauses.push("substr(s.first_air_date, 1, 4) = ?");
    bindings.push(filters.year);
  }

  return {
    sql: clauses.length ? clauses.join(" AND ") : "1 = 1",
    bindings
  };
}

async function loadBrowseItems(env, titleRegion, filters, limit) {
  const where = buildBrowseWhere(filters);
  const statement = `${PHASE8_SHOW_SELECT}\nWHERE ${where.sql}\nORDER BY ${BROWSE_SORTS[filters.sort].orderBy}\nLIMIT ?`;
  const result = await env.DB.prepare(statement).bind(...where.bindings, limit).all();
  return (result.results || []).map((row) => withResolvedChineseTitle(row, titleRegion));
}

async function loadBrowseCount(env, filters) {
  const where = buildBrowseWhere(filters);
  const statement = env.DB.prepare(`SELECT COUNT(*) AS count FROM shows s WHERE ${where.sql}`);
  const row = where.bindings.length
    ? await statement.bind(...where.bindings).first()
    : await statement.first();
  return Number(row?.count) || 0;
}

export async function loadBrowseFacets(env) {
  if (!env.DB) {
    return { networks: [], genres: [], statuses: BROWSE_STATUSES.map((item) => ({ ...item, count: 0 })), years: [] };
  }

  const [networkResult, genreResult, statusResult, yearResult] = await Promise.all([
    env.DB.prepare(`SELECT n.canonical_name AS value, COUNT(DISTINCT sn.show_id) AS count
      FROM show_networks sn
      JOIN networks n ON n.id = sn.network_id
      JOIN shows s ON s.id = sn.show_id
      GROUP BY n.canonical_name
      HAVING COUNT(DISTINCT sn.show_id) > 0
      ORDER BY count DESC, value ASC
      LIMIT 40`).all(),
    env.DB.prepare(`SELECT g.name AS value, COUNT(DISTINCT sg.show_id) AS count
      FROM show_genres sg
      JOIN genres g ON g.id = sg.genre_id
      JOIN shows s ON s.id = sg.show_id
      GROUP BY g.name
      HAVING COUNT(DISTINCT sg.show_id) > 0
      ORDER BY count DESC, value ASC
      LIMIT 30`).all(),
    env.DB.prepare(`SELECT status AS value, COUNT(*) AS count
      FROM shows
      WHERE status IN ('airing', 'upcoming', 'planned', 'completed')
      GROUP BY status`).all(),
    env.DB.prepare(`SELECT substr(first_air_date, 1, 4) AS value, COUNT(*) AS count
      FROM shows
      WHERE first_air_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      GROUP BY substr(first_air_date, 1, 4)
      ORDER BY value DESC
      LIMIT 18`).all()
  ]);

  const statusCounts = new Map((statusResult.results || []).map((row) => [row.value, Number(row.count) || 0]));
  return {
    networks: (networkResult.results || []).map((row) => ({ value: row.value, label: row.value, count: Number(row.count) || 0 })),
    genres: (genreResult.results || []).map((row) => ({ value: row.value, label: row.value, count: Number(row.count) || 0 })),
    statuses: BROWSE_STATUSES.map((item) => ({ ...item, count: statusCounts.get(item.value) || 0 })),
    years: (yearResult.results || []).map((row) => ({ value: row.value, label: row.value, count: Number(row.count) || 0 }))
  };
}

export async function buildBrowse(env, url) {
  const titleRegion = normalizeTitleRegion(url?.searchParams?.get("region"));
  const limit = normalizeBrowseLimit(url);
  const filters = normalizeBrowseFilters(url);

  if (!env.DB) {
    return {
      status: 200,
      body: {
        data: { items: [], facets: await loadBrowseFacets(env) },
        meta: {
          phase: "8b-faceted-browse",
          titleRegion,
          limit,
          filters,
          resultCount: 0,
          totalCount: 0,
          databaseConfigured: false,
          externalRequests: 0
        }
      }
    };
  }

  try {
    const [items, facets, totalCount] = await Promise.all([
      loadBrowseItems(env, titleRegion, filters, limit),
      loadBrowseFacets(env),
      loadBrowseCount(env, filters)
    ]);
    return {
      status: 200,
      body: {
        data: { items, facets },
        meta: {
          phase: "8b-faceted-browse",
          titleRegion,
          limit,
          filters,
          resultCount: items.length,
          totalCount,
          truncated: totalCount > items.length,
          databaseConfigured: true,
          externalRequests: 0
        }
      }
    };
  } catch (error) {
    return {
      status: 503,
      body: {
        ok: false,
        error: "browse_query_failed",
        detail: error instanceof Error ? error.message : String(error)
      }
    };
  }
}
