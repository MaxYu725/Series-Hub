import { normalizeTitleRegion, withResolvedChineseTitle } from "./title-aliases.js";
import { PHASE8_SHOW_SELECT } from "./phase8-catalog.js";

export const DISCOVERY_SECTIONS = Object.freeze([
  Object.freeze({
    key: "popular_now",
    title: "熱門追看",
    description: "按目前 Series Hub 收錄劇集的 TMDB popularity 排序。",
    where: "s.status IN ('airing', 'upcoming', 'planned')",
    orderBy: "COALESCE(s.popularity, 0) DESC, COALESCE(s.vote_count, 0) DESC, s.id DESC"
  }),
  Object.freeze({
    key: "new_series",
    title: "近一年新劇",
    description: "過去 12 個月首播、目前仍屬活躍 catalog 的劇集。",
    where: "s.status IN ('airing', 'upcoming', 'planned') AND s.first_air_date IS NOT NULL AND s.first_air_date BETWEEN date('now', '-12 months') AND date('now')",
    orderBy: "s.first_air_date DESC, COALESCE(s.popularity, 0) DESC, s.id DESC"
  }),
  Object.freeze({
    key: "coming_soon",
    title: "即將開播",
    description: "已有未來日期的 upcoming 劇集，優先顯示最近開播項目。",
    where: "s.status = 'upcoming' AND COALESCE(s.next_air_date, s.first_air_date) >= date('now')",
    orderBy: "COALESCE(s.next_air_date, s.first_air_date) ASC, COALESCE(s.popularity, 0) DESC, s.id DESC"
  }),
  Object.freeze({
    key: "top_rated",
    title: "高評分",
    description: "至少 100 個 TMDB votes 的活躍劇集，避免極少樣本高分排在最前。",
    where: "s.status IN ('airing', 'upcoming', 'planned') AND COALESCE(s.vote_count, 0) >= 100 AND COALESCE(s.vote_average, 0) > 0",
    orderBy: "s.vote_average DESC, s.vote_count DESC, COALESCE(s.popularity, 0) DESC, s.id DESC"
  })
]);

export function normalizeDiscoveryLimit(url) {
  const value = Number(url?.searchParams?.get("limit") || 12);
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 4), 20) : 12;
}

async function loadSection(env, definition, titleRegion, limit) {
  const result = await env.DB.prepare(
    `${PHASE8_SHOW_SELECT}\nWHERE ${definition.where}\nORDER BY ${definition.orderBy}\nLIMIT ?1`
  ).bind(limit).all();

  return {
    key: definition.key,
    title: definition.title,
    description: definition.description,
    items: (result.results || []).map((row) => withResolvedChineseTitle(row, titleRegion))
  };
}

export async function buildDiscovery(env, url) {
  const titleRegion = normalizeTitleRegion(url?.searchParams?.get("region"));
  const limit = normalizeDiscoveryLimit(url);

  if (!env.DB) {
    return {
      status: 200,
      body: {
        data: { sections: DISCOVERY_SECTIONS.map(({ key, title, description }) => ({ key, title, description, items: [] })) },
        meta: { phase: "8a-discovery-home", titleRegion, limit, databaseConfigured: false, externalRequests: 0 }
      }
    };
  }

  try {
    const sections = await Promise.all(
      DISCOVERY_SECTIONS.map((definition) => loadSection(env, definition, titleRegion, limit))
    );
    return {
      status: 200,
      body: {
        data: { sections },
        meta: {
          phase: "8a-discovery-home",
          titleRegion,
          limit,
          sectionCount: sections.length,
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
        error: "discovery_query_failed",
        detail: error instanceof Error ? error.message : String(error)
      }
    };
  }
}
