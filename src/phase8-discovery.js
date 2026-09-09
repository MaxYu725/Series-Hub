import { normalizeTitleRegion, withResolvedChineseTitle } from "./title-aliases.js";

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

const SHOW_SELECT = `SELECT
  s.id,
  s.tmdb_id,
  s.original_title,
  s.english_title,
  s.status,
  s.tmdb_status,
  s.poster_url,
  s.first_air_date,
  s.next_air_date,
  s.popularity,
  s.vote_average,
  s.vote_count,
  pt.title_zh_hk,
  pt.title_zh_hk_source,
  pt.title_zh_hk_confidence,
  pt.title_zh_tw,
  pt.title_zh_tw_source,
  pt.title_zh_tw_confidence,
  pt.title_zh_cn,
  pt.title_zh_cn_source,
  pt.title_zh_cn_confidence,
  (SELECT GROUP_CONCAT(ta.title, ' | ') FROM title_aliases ta WHERE ta.show_id = s.id AND ta.season_id IS NULL AND ta.locale = 'zh') AS chinese_aliases,
  (SELECT GROUP_CONCAT(n.canonical_name, ' · ') FROM show_networks sn JOIN networks n ON n.id = sn.network_id WHERE sn.show_id = s.id ORDER BY sn.is_primary DESC, n.canonical_name ASC) AS networks,
  (SELECT GROUP_CONCAT(g.name, ' · ') FROM show_genres sg JOIN genres g ON g.id = sg.genre_id WHERE sg.show_id = s.id ORDER BY g.name ASC) AS genres,
  (SELECT se.season_number FROM seasons se WHERE se.show_id = s.id ORDER BY se.season_number DESC LIMIT 1) AS latest_season_number
FROM shows s
LEFT JOIN preferred_show_titles pt ON pt.show_id = s.id`;

export function normalizeDiscoveryLimit(url) {
  const value = Number(url?.searchParams?.get("limit") || 12);
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 4), 20) : 12;
}

async function loadSection(env, definition, titleRegion, limit) {
  const result = await env.DB.prepare(
    `${SHOW_SELECT}\nWHERE ${definition.where}\nORDER BY ${definition.orderBy}\nLIMIT ?1`
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
        meta: { phase: "8a-discovery-home", titleRegion, limit, databaseConfigured: false }
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
