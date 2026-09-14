import fs from "node:fs";

function replaceOnce(path, before, after, label) {
  const text = fs.readFileSync(path, "utf8");
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: ${label} anchor count ${count}`);
  fs.writeFileSync(path, text.replace(before, after));
}

// src/index.js
replaceOnce(
  "src/index.js",
  'import { normalizeTitleRegion, withResolvedChineseTitle } from "./title-aliases.js";\n',
  'import { normalizeTitleRegion, withResolvedChineseTitle } from "./title-aliases.js";\nimport { normalizeCatalogMarket } from "./market.js";\n',
  "market import"
);
replaceOnce(
  "src/index.js",
  '  const titleRegion = requestedTitleRegion(url);\n  const queryPattern = query ? `%${query}%` : null;\n',
  '  const titleRegion = requestedTitleRegion(url);\n  const market = normalizeCatalogMarket(url.searchParams.get("market"));\n  const queryPattern = query ? `%${query}%` : null;\n',
  "shows market state"
);
replaceOnce(
  "src/index.js",
  `        )\n      ORDER BY\n        CASE s.status WHEN 'airing' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'planned' THEN 2 ELSE 3 END,\n        CASE WHEN s.status = 'upcoming' THEN COALESCE(s.next_air_date, '9999-12-31') END ASC,\n        COALESCE(s.popularity, 0) DESC,\n        s.id DESC\n      LIMIT ?3\`\n    ).bind(status, queryPattern, limit).all();`,
  `        )\n        AND (?3 = 'all' OR (',' || COALESCE(s.origin_country, '') || ',') LIKE '%,' || ?3 || ',%')\n      ORDER BY\n        CASE s.status WHEN 'airing' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'planned' THEN 2 ELSE 3 END,\n        CASE WHEN s.status = 'upcoming' THEN COALESCE(s.next_air_date, '9999-12-31') END ASC,\n        COALESCE(s.popularity, 0) DESC,\n        s.id DESC\n      LIMIT ?4\`\n    ).bind(status, queryPattern, market, limit).all();`,
  "shows market sql"
);
replaceOnce(
  "src/index.js",
  '        titleRegion,\n        phase: PHASE\n',
  '        titleRegion,\n        market,\n        phase: PHASE\n',
  "shows market meta"
);
replaceOnce(
  "src/index.js",
  '  const through = addDays(from, days - 1);\n  const titleRegion = requestedTitleRegion(url);\n',
  '  const through = addDays(from, days - 1);\n  const titleRegion = requestedTitleRegion(url);\n  const market = normalizeCatalogMarket(url.searchParams.get("market"));\n',
  "schedule market state"
);
replaceOnce(
  "src/index.js",
  '        s.english_title,\n        s.original_title,\n        s.poster_url,\n',
  '        s.english_title,\n        s.original_title,\n        s.origin_country,\n        s.poster_url,\n',
  "schedule origin country"
);
replaceOnce(
  "src/index.js",
  `      WHERE e.air_date BETWEEN ?1 AND ?2\n        AND s.status IN ('airing', 'upcoming', 'planned')\n      ORDER BY e.air_date ASC, COALESCE(e.air_timestamp, e.air_time, '99:99') ASC, s.english_title ASC\`\n    ).bind(from, through).all();`,
  `      WHERE e.air_date BETWEEN ?1 AND ?2\n        AND s.status IN ('airing', 'upcoming', 'planned')\n        AND (?3 = 'all' OR (',' || COALESCE(s.origin_country, '') || ',') LIKE '%,' || ?3 || ',%')\n      ORDER BY e.air_date ASC, COALESCE(e.air_timestamp, e.air_time, '99:99') ASC, s.english_title ASC\`\n    ).bind(from, through, market).all();`,
  "schedule market sql"
);
replaceOnce(
  "src/index.js",
  '        days,\n        titleRegion,\n        phase: PHASE,\n',
  '        days,\n        titleRegion,\n        market,\n        phase: PHASE,\n',
  "schedule market meta"
);

// src/phase6-worker.js
replaceOnce(
  "src/phase6-worker.js",
  'import { normalizeTitleRegion, withResolvedChineseTitle } from "./title-aliases.js";\n',
  'import { normalizeTitleRegion, withResolvedChineseTitle } from "./title-aliases.js";\nimport { normalizeCatalogMarket } from "./market.js";\n',
  "search market import"
);
replaceOnce(
  "src/phase6-worker.js",
  'async function episodeSearchMatches(env, query, titleRegion, limit) {\n',
  'async function episodeSearchMatches(env, query, titleRegion, market, limit) {\n',
  "episode search signature"
);
replaceOnce(
  "src/phase6-worker.js",
  '      s.english_title,\n      s.status,\n',
  '      s.english_title,\n      s.origin_country,\n      s.status,\n',
  "search origin country"
);
replaceOnce(
  "src/phase6-worker.js",
  `     )\n     ORDER BY COALESCE(s.popularity, 0) DESC, s.id DESC\n     LIMIT ?2\`\n  ).bind(pattern, limit).all();`,
  `     )\n       AND (?2 = 'all' OR (',' || COALESCE(s.origin_country, '') || ',') LIKE '%,' || ?2 || ',%')\n     ORDER BY COALESCE(s.popularity, 0) DESC, s.id DESC\n     LIMIT ?3\`\n  ).bind(pattern, market, limit).all();`,
  "episode search market sql"
);
replaceOnce(
  "src/phase6-worker.js",
  '  const titleRegion = normalizeTitleRegion(url.searchParams.get("region"));\n  if (!query) {\n    return json({ data: [], meta: { count: 0, query: null, titleRegion, global: true } });\n',
  '  const titleRegion = normalizeTitleRegion(url.searchParams.get("region"));\n  const market = normalizeCatalogMarket(url.searchParams.get("market"));\n  if (!query) {\n    return json({ data: [], meta: { count: 0, query: null, titleRegion, market, global: true } });\n',
  "global search market state"
);
replaceOnce(
  "src/phase6-worker.js",
  '    catalogUrl.searchParams.set("region", titleRegion);\n',
  '    catalogUrl.searchParams.set("region", titleRegion);\n    catalogUrl.searchParams.set("market", market);\n',
  "global search market forwarding"
);
replaceOnce(
  "src/phase6-worker.js",
  '    const episodeMatches = await episodeSearchMatches(env, query, titleRegion, limit);\n',
  '    const episodeMatches = await episodeSearchMatches(env, query, titleRegion, market, limit);\n',
  "episode search market call"
);
replaceOnce(
  "src/phase6-worker.js",
  '        titleRegion,\n        global: true,\n',
  '        titleRegion,\n        market,\n        global: true,\n',
  "search market meta"
);

// src/phase8-catalog.js
replaceOnce(
  "src/phase8-catalog.js",
  '  s.english_title,\n  s.status,\n',
  '  s.english_title,\n  s.origin_country,\n  s.status,\n',
  "phase8 origin country"
);

// src/phase8-discovery.js
replaceOnce(
  "src/phase8-discovery.js",
  'import { PHASE8_SHOW_SELECT } from "./phase8-catalog.js";\n',
  'import { PHASE8_SHOW_SELECT } from "./phase8-catalog.js";\nimport { normalizeCatalogMarket } from "./market.js";\n',
  "discovery market import"
);
replaceOnce(
  "src/phase8-discovery.js",
  'async function loadSection(env, definition, titleRegion, limit) {\n  const result = await env.DB.prepare(\n    `${PHASE8_SHOW_SELECT}\\nWHERE ${definition.where}\\nORDER BY ${definition.orderBy}\\nLIMIT ?1`\n  ).bind(limit).all();\n',
  'async function loadSection(env, definition, titleRegion, market, limit) {\n  const result = await env.DB.prepare(\n    `${PHASE8_SHOW_SELECT}\\nWHERE ${definition.where}\\n  AND (?1 = \'all\' OR (\',\' || COALESCE(s.origin_country, \'\') || \',\') LIKE \'%,\' || ?1 || \',%\')\\nORDER BY ${definition.orderBy}\\nLIMIT ?2`\n  ).bind(market, limit).all();\n',
  "discovery market sql"
);
replaceOnce(
  "src/phase8-discovery.js",
  '  const limit = normalizeDiscoveryLimit(url);\n',
  '  const limit = normalizeDiscoveryLimit(url);\n  const market = normalizeCatalogMarket(url?.searchParams?.get("market"));\n',
  "discovery market state"
);
replaceOnce(
  "src/phase8-discovery.js",
  '        meta: { phase: "8a-discovery-home", titleRegion, limit, databaseConfigured: false, externalRequests: 0 }\n',
  '        meta: { phase: "8a-discovery-home", titleRegion, market, limit, databaseConfigured: false, externalRequests: 0 }\n',
  "discovery empty meta"
);
replaceOnce(
  "src/phase8-discovery.js",
  '      DISCOVERY_SECTIONS.map((definition) => loadSection(env, definition, titleRegion, limit))\n',
  '      DISCOVERY_SECTIONS.map((definition) => loadSection(env, definition, titleRegion, market, limit))\n',
  "discovery market call"
);
replaceOnce(
  "src/phase8-discovery.js",
  '          titleRegion,\n          limit,\n',
  '          titleRegion,\n          market,\n          limit,\n',
  "discovery meta market"
);

// src/phase8-browse.js
replaceOnce(
  "src/phase8-browse.js",
  'import { PHASE8_SHOW_SELECT } from "./phase8-catalog.js";\n',
  'import { PHASE8_SHOW_SELECT } from "./phase8-catalog.js";\nimport { normalizeCatalogMarket, catalogMarketPattern } from "./market.js";\n',
  "browse market import"
);
replaceOnce(
  "src/phase8-browse.js",
  '  return {\n    network: normalizeTextFacet(url?.searchParams?.get("network")),\n',
  '  return {\n    market: normalizeCatalogMarket(url?.searchParams?.get("market")),\n    network: normalizeTextFacet(url?.searchParams?.get("network")),\n',
  "browse filters market"
);
replaceOnce(
  "src/phase8-browse.js",
  '  const clauses = [];\n  const bindings = [];\n\n  if (filters.network) {\n',
  '  const clauses = [];\n  const bindings = [];\n\n  const marketPattern = catalogMarketPattern(filters.market);\n  if (marketPattern) {\n    clauses.push("(\',\' || COALESCE(s.origin_country, \'\') || \',\') LIKE ?");\n    bindings.push(marketPattern);\n  }\n\n  if (filters.network) {\n',
  "browse where market"
);
replaceOnce(
  "src/phase8-browse.js",
  'export async function loadBrowseFacets(env) {\n  if (!env.DB) {\n',
  'export async function loadBrowseFacets(env, marketValue = "all") {\n  if (!env.DB) {\n',
  "facets market signature"
);
replaceOnce(
  "src/phase8-browse.js",
  `  const [networkResult, genreResult, statusResult, yearResult] = await Promise.all([\n    env.DB.prepare(\`SELECT n.canonical_name AS value, COUNT(DISTINCT sn.show_id) AS count\n      FROM show_networks sn\n      JOIN networks n ON n.id = sn.network_id\n      JOIN shows s ON s.id = sn.show_id\n      GROUP BY n.canonical_name\n      HAVING COUNT(DISTINCT sn.show_id) > 0\n      ORDER BY count DESC, value ASC\n      LIMIT 40\`).all(),\n    env.DB.prepare(\`SELECT g.name AS value, COUNT(DISTINCT sg.show_id) AS count\n      FROM show_genres sg\n      JOIN genres g ON g.id = sg.genre_id\n      JOIN shows s ON s.id = sg.show_id\n      GROUP BY g.name\n      HAVING COUNT(DISTINCT sg.show_id) > 0\n      ORDER BY count DESC, value ASC\n      LIMIT 30\`).all(),\n    env.DB.prepare(\`SELECT status AS value, COUNT(*) AS count\n      FROM shows\n      WHERE status IN ('airing', 'upcoming', 'planned', 'completed')\n      GROUP BY status\`).all(),\n    env.DB.prepare(\`SELECT substr(first_air_date, 1, 4) AS value, COUNT(*) AS count\n      FROM shows\n      WHERE first_air_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'\n      GROUP BY substr(first_air_date, 1, 4)\n      ORDER BY value DESC\n      LIMIT 18\`).all()\n  ]);`,
  `  const market = normalizeCatalogMarket(marketValue);\n  const marketPattern = catalogMarketPattern(market);\n  const marketWhere = marketPattern ? "(',' || COALESCE(s.origin_country, '') || ',') LIKE ?1" : "1 = 1";\n  const runFacet = (sql) => {\n    const statement = env.DB.prepare(sql);\n    return marketPattern ? statement.bind(marketPattern).all() : statement.all();\n  };\n\n  const [networkResult, genreResult, statusResult, yearResult] = await Promise.all([\n    runFacet(\`SELECT n.canonical_name AS value, COUNT(DISTINCT sn.show_id) AS count\n      FROM show_networks sn\n      JOIN networks n ON n.id = sn.network_id\n      JOIN shows s ON s.id = sn.show_id\n      WHERE ${marketWhere}\n      GROUP BY n.canonical_name\n      HAVING COUNT(DISTINCT sn.show_id) > 0\n      ORDER BY count DESC, value ASC\n      LIMIT 40\`),\n    runFacet(\`SELECT g.name AS value, COUNT(DISTINCT sg.show_id) AS count\n      FROM show_genres sg\n      JOIN genres g ON g.id = sg.genre_id\n      JOIN shows s ON s.id = sg.show_id\n      WHERE ${marketWhere}\n      GROUP BY g.name\n      HAVING COUNT(DISTINCT sg.show_id) > 0\n      ORDER BY count DESC, value ASC\n      LIMIT 30\`),\n    runFacet(\`SELECT s.status AS value, COUNT(*) AS count\n      FROM shows s\n      WHERE s.status IN ('airing', 'upcoming', 'planned', 'completed')\n        AND ${marketWhere}\n      GROUP BY s.status\`),\n    runFacet(\`SELECT substr(s.first_air_date, 1, 4) AS value, COUNT(*) AS count\n      FROM shows s\n      WHERE s.first_air_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'\n        AND ${marketWhere}\n      GROUP BY substr(s.first_air_date, 1, 4)\n      ORDER BY value DESC\n      LIMIT 18\`)\n  ]);`,
  "market scoped facets"
);
replaceOnce(
  "src/phase8-browse.js",
  '        data: { items: [], facets: await loadBrowseFacets(env) },\n',
  '        data: { items: [], facets: await loadBrowseFacets(env, filters.market) },\n',
  "empty browse facets market"
);
replaceOnce(
  "src/phase8-browse.js",
  '      loadBrowseFacets(env),\n',
  '      loadBrowseFacets(env, filters.market),\n',
  "browse facets market"
);

// public/index.html
replaceOnce(
  "public/index.html",
  `          <label class="region-box">\n            <span class="search-label">譯名地區</span>`,
  `          <label class="region-box">\n            <span class="search-label">劇集地區</span>\n            <select id="market-select" aria-label="劇集地區">\n              <option value="all">全部</option>\n              <option value="US">美國</option>\n              <option value="KR">韓國</option>\n            </select>\n          </label>\n\n          <label class="region-box">\n            <span class="search-label">譯名地區</span>`,
  "market selector markup"
);
replaceOnce(
  "public/index.html",
  '      <section class="catalog-tools" aria-label="探索、排程、劇集搜尋、譯名地區與狀態篩選">',
  '      <section class="catalog-tools" aria-label="探索、排程、劇集搜尋、劇集地區、譯名地區與狀態篩選">',
  "market selector aria"
);

// public/app.js
replaceOnce(
  "public/app.js",
  'const TITLE_REGION_STORAGE_KEY = "series-hub-title-region";\nconst TITLE_REGION_LABELS = Object.freeze({ HK: "香港", TW: "台灣", CN: "中國大陸" });\n',
  'const TITLE_REGION_STORAGE_KEY = "series-hub-title-region";\nconst MARKET_STORAGE_KEY = "series-hub-catalog-market";\nconst TITLE_REGION_LABELS = Object.freeze({ HK: "香港", TW: "台灣", CN: "中國大陸" });\nconst MARKET_LABELS = Object.freeze({ all: "全部地區", US: "美國", KR: "韓國" });\n',
  "app market constants"
);
replaceOnce(
  "public/app.js",
  'function saveTitleRegion(region) {\n  try {\n    window.localStorage.setItem(TITLE_REGION_STORAGE_KEY, region);\n  } catch {\n    // Storage is optional. The active in-memory preference still works.\n  }\n}\n\nconst state = {\n',
  'function saveTitleRegion(region) {\n  try {\n    window.localStorage.setItem(TITLE_REGION_STORAGE_KEY, region);\n  } catch {\n    // Storage is optional. The active in-memory preference still works.\n  }\n}\n\nfunction storedMarket() {\n  try {\n    const value = window.localStorage.getItem(MARKET_STORAGE_KEY);\n    return Object.hasOwn(MARKET_LABELS, value) ? value : "all";\n  } catch {\n    return "all";\n  }\n}\n\nfunction saveMarket(market) {\n  try {\n    window.localStorage.setItem(MARKET_STORAGE_KEY, market);\n  } catch {\n    // Storage is optional. The active in-memory preference still works.\n  }\n}\n\nconst state = {\n',
  "app market persistence"
);
replaceOnce(
  "public/app.js",
  '  query: "",\n  titleRegion: storedTitleRegion(),\n',
  '  query: "",\n  titleRegion: storedTitleRegion(),\n  market: storedMarket(),\n',
  "app state market"
);
replaceOnce(
  "public/app.js",
  'const searchInput = document.querySelector("#search-input");\nconst titleRegionSelect = document.querySelector("#title-region-select");\n\ntitleRegionSelect.value = state.titleRegion;\n',
  'const searchInput = document.querySelector("#search-input");\nconst titleRegionSelect = document.querySelector("#title-region-select");\nconst marketSelect = document.querySelector("#market-select");\n\ntitleRegionSelect.value = state.titleRegion;\nif (marketSelect) marketSelect.value = state.market;\n',
  "app market element"
);
replaceOnce(
  "public/app.js",
  '  const regionLabel = TITLE_REGION_LABELS[state.titleRegion];\n',
  '  const regionLabel = TITLE_REGION_LABELS[state.titleRegion];\n  const marketLabel = MARKET_LABELS[state.market] || MARKET_LABELS.all;\n',
  "app render market label"
);
replaceOnce(
  "public/app.js",
  '    ? `中文名優先使用${regionLabel}譯名；同日多集會合併為一張劇集卡，精確時間按 ${browserTimeZone} 顯示。`\n    : `中文名優先使用${regionLabel}譯名；播映中劇集會直接顯示下一集已確認時間，未有逐集資料時明確標示待確認。`;\n',
  '    ? `目前顯示${marketLabel}劇集；中文名優先使用${regionLabel}譯名；同日多集會合併為一張劇集卡，精確時間按 ${browserTimeZone} 顯示。`\n    : `目前顯示${marketLabel}劇集；中文名優先使用${regionLabel}譯名；播映中劇集會直接顯示下一集已確認時間，未有逐集資料時明確標示待確認。`;\n',
  "app render market context"
);
replaceOnce(
  "public/app.js",
  '  const params = new URLSearchParams({ status: view.status, limit: "60", region: state.titleRegion });\n',
  '  const params = new URLSearchParams({ status: view.status, limit: "60", region: state.titleRegion, market: state.market });\n',
  "catalog market param"
);
replaceOnce(
  "public/app.js",
  '  const params = new URLSearchParams({ from, days: String(apiDays), region: state.titleRegion });\n',
  '  const params = new URLSearchParams({ from, days: String(apiDays), region: state.titleRegion, market: state.market });\n',
  "schedule market param"
);
replaceOnce(
  "public/app.js",
  'async function loadCurrentView() {\n  const requestId = ++state.requestId;\n',
  'async function loadCurrentView() {\n  if (Object.hasOwn(TITLE_REGION_LABELS, titleRegionSelect?.value)) state.titleRegion = titleRegionSelect.value;\n  if (Object.hasOwn(MARKET_LABELS, marketSelect?.value)) state.market = marketSelect.value;\n  const requestId = ++state.requestId;\n',
  "sync selectors before load"
);
replaceOnce(
  "public/app.js",
  'titleRegionSelect.addEventListener("change", () => {\n  const region = titleRegionSelect.value;\n  if (!Object.hasOwn(TITLE_REGION_LABELS, region) || region === state.titleRegion) return;\n  state.titleRegion = region;\n  saveTitleRegion(region);\n  state.shows = [];\n  state.episodes = [];\n  loadCurrentView();\n});\n\nwindow.addEventListener("series-hub:retry", (event) => {\n',
  'titleRegionSelect.addEventListener("change", () => {\n  const region = titleRegionSelect.value;\n  if (!Object.hasOwn(TITLE_REGION_LABELS, region) || region === state.titleRegion) return;\n  state.titleRegion = region;\n  saveTitleRegion(region);\n  state.shows = [];\n  state.episodes = [];\n  loadCurrentView();\n});\n\nmarketSelect?.addEventListener("change", () => {\n  const market = marketSelect.value;\n  if (!Object.hasOwn(MARKET_LABELS, market) || market === state.market) return;\n  state.market = market;\n  saveMarket(market);\n  state.shows = [];\n  state.episodes = [];\n  loadCurrentView();\n});\n\nwindow.addEventListener("series-hub:retry", (event) => {\n',
  "market change listener"
);

// public/phase8-ui.js
replaceOnce(
  "public/phase8-ui.js",
  'const regionSelect = document.querySelector("#title-region-select");\n',
  'const regionSelect = document.querySelector("#title-region-select");\nconst marketSelect = document.querySelector("#market-select");\n',
  "phase8 market element"
);
replaceOnce(
  "public/phase8-ui.js",
  'const STATUS_LABELS = Object.freeze({\n',
  'const MARKET_LABELS = Object.freeze({ all: "全部地區", US: "美國", KR: "韓國" });\n\nconst STATUS_LABELS = Object.freeze({\n',
  "phase8 market labels"
);
replaceOnce(
  "public/phase8-ui.js",
  'function saveRegion(region) {\n  try {\n    window.localStorage.setItem("series-hub-title-region", region);\n  } catch {\n    // Optional preference only.\n  }\n}\n\nfunction chineseTitle(show) {\n',
  'function saveRegion(region) {\n  try {\n    window.localStorage.setItem("series-hub-title-region", region);\n  } catch {\n    // Optional preference only.\n  }\n}\n\nfunction currentMarket() {\n  return Object.hasOwn(MARKET_LABELS, marketSelect?.value) ? marketSelect.value : "all";\n}\n\nfunction saveMarket(market) {\n  try {\n    window.localStorage.setItem("series-hub-catalog-market", market);\n  } catch {\n    // Optional preference only.\n  }\n}\n\nfunction chineseTitle(show) {\n',
  "phase8 market helpers"
);
replaceOnce(
  "public/phase8-ui.js",
  '  viewKicker.textContent = mode === "personal" ? "FOR YOU" : "DISCOVER";\n\n  if (mode === "browse") {\n',
  '  viewKicker.textContent = mode === "personal" ? "FOR YOU" : "DISCOVER";\n  const marketLabel = MARKET_LABELS[currentMarket()] || MARKET_LABELS.all;\n\n  if (mode === "browse") {\n',
  "phase8 market context state"
);
replaceOnce(
  "public/phase8-ui.js",
  '    viewContext.textContent = "按原始平台、類型、狀態及首播年份篩選 Series Hub catalog；地區觀看供應仍由劇集詳情頁獨立顯示。";\n',
  '    viewContext.textContent = `目前顯示${marketLabel}劇集；按原始平台、類型、狀態及首播年份篩選 Series Hub catalog；地區觀看供應仍由劇集詳情頁獨立顯示。`;\n',
  "browse market context"
);
replaceOnce(
  "public/phase8-ui.js",
  '    viewContext.textContent = "推薦排序只使用這個瀏覽器內的追蹤與追劇狀態；伺服器只收到通用 catalog request。";\n',
  '    viewContext.textContent = `目前顯示${marketLabel}劇集；推薦排序只使用這個瀏覽器內的追蹤與追劇狀態；伺服器只收到通用 catalog request。`;\n',
  "personal market context"
);
replaceOnce(
  "public/phase8-ui.js",
  '    viewContext.textContent = "從已收錄的美劇 catalog 即時整理熱門、新劇、即將開播與高評分內容；不額外呼叫 TMDB discovery。";\n',
  '    viewContext.textContent = `從已收錄的${marketLabel} catalog 即時整理熱門、新劇、即將開播與高評分內容；不額外呼叫 TMDB discovery。`;\n',
  "featured neutral market context"
);
replaceOnce(
  "public/phase8-ui.js",
  'async function fetchFeatured(region, timeoutMs = 12000) {\n',
  'async function fetchFeatured(region, market, timeoutMs = 12000) {\n',
  "featured market signature"
);
replaceOnce(
  "public/phase8-ui.js",
  '    const params = new URLSearchParams({ region, limit: "12" });\n',
  '    const params = new URLSearchParams({ region, market, limit: "12" });\n',
  "featured market param"
);
replaceOnce(
  "public/phase8-ui.js",
  'async function fetchBrowse(region, timeoutMs = 12000) {\n',
  'async function fetchBrowse(region, market, timeoutMs = 12000) {\n',
  "browse market signature"
);
replaceOnce(
  "public/phase8-ui.js",
  '    const params = new URLSearchParams({ region, mode: "browse", limit: "80", sort: filters.sort });\n',
  '    const params = new URLSearchParams({ region, market, mode: "browse", limit: "80", sort: filters.sort });\n',
  "browse market param"
);
replaceOnce(
  "public/phase8-ui.js",
  'async function fetchPersonalPool(region, timeoutMs = 12000) {\n',
  'async function fetchPersonalPool(region, market, timeoutMs = 12000) {\n',
  "personal market signature"
);
replaceOnce(
  "public/phase8-ui.js",
  '    const params = new URLSearchParams({ region, mode: "browse", limit: "100", sort: "popular" });\n',
  '    const params = new URLSearchParams({ region, market, mode: "browse", limit: "100", sort: "popular" });\n',
  "personal market param"
);
for (const [label, loader, fetcher, modeName] of [
  ["featured", "loadFeatured", "fetchFeatured", "featured"],
  ["personal", "loadPersonal", "fetchPersonalPool", "personal"],
  ["browse", "loadBrowse", "fetchBrowse", "browse"]
]) {
  replaceOnce(
    "public/phase8-ui.js",
    `  const region = currentRegion();\n  contentPanel?.setAttribute("aria-busy", "true");`,
    `  const region = currentRegion();\n  const market = currentMarket();\n  contentPanel?.setAttribute("aria-busy", "true");`,
    `${label} market state`
  );
  replaceOnce(
    "public/phase8-ui.js",
    `    const payload = await ${fetcher}(region);`,
    `    const payload = await ${fetcher}(region, market);`,
    `${label} market fetch`
  );
  replaceOnce(
    "public/phase8-ui.js",
    `currentRegion() !== region) return;`,
    `currentRegion() !== region || currentMarket() !== market) return;`,
    `${label} stale market guard`
  );
}
replaceOnce(
  "public/phase8-ui.js",
  'if (discoverButton && regionSelect && contentPanel && showGrid && scheduleList && emptyState) {\n',
  'if (discoverButton && regionSelect && marketSelect && contentPanel && showGrid && scheduleList && emptyState) {\n',
  "phase8 market required"
);
replaceOnce(
  "public/phase8-ui.js",
  '  window.addEventListener("change", (event) => {\n    if (event.target !== regionSelect || !active) return;\n    event.stopImmediatePropagation();\n    saveRegion(currentRegion());\n    if (mode === "browse") loadBrowse();\n    else if (mode === "personal") loadPersonal();\n    else loadFeatured();\n  }, true);\n',
  '  window.addEventListener("change", (event) => {\n    if (!active || (event.target !== regionSelect && event.target !== marketSelect)) return;\n    event.stopImmediatePropagation();\n    if (event.target === regionSelect) saveRegion(currentRegion());\n    if (event.target === marketSelect) saveMarket(currentMarket());\n    if (mode === "browse") loadBrowse();\n    else if (mode === "personal") loadPersonal();\n    else loadFeatured();\n  }, true);\n',
  "phase8 selector change"
);

// public/global-search.js
replaceOnce(
  "public/global-search.js",
  'const regionSelect = document.querySelector("#title-region-select");\n',
  'const regionSelect = document.querySelector("#title-region-select");\nconst marketSelect = document.querySelector("#market-select");\n',
  "search market element"
);
replaceOnce(
  "public/global-search.js",
  'const REGION_LABELS = Object.freeze({ HK: "香港", TW: "台灣", CN: "中國大陸" });\n',
  'const REGION_LABELS = Object.freeze({ HK: "香港", TW: "台灣", CN: "中國大陸" });\nconst MARKET_LABELS = Object.freeze({ all: "全部地區", US: "美國", KR: "韓國" });\n',
  "search market labels"
);
replaceOnce(
  "public/global-search.js",
  'function currentQuery() {\n  return searchInput?.value.trim() || "";\n}\n\nfunction setGlobalSearchHeading(query) {\n',
  'function currentQuery() {\n  return searchInput?.value.trim() || "";\n}\n\nfunction currentMarket() {\n  return Object.hasOwn(MARKET_LABELS, marketSelect?.value) ? marketSelect.value : "all";\n}\n\nfunction saveMarket(market) {\n  try {\n    window.localStorage.setItem("series-hub-catalog-market", market);\n  } catch {\n    // Optional preference only.\n  }\n}\n\nfunction setGlobalSearchHeading(query) {\n',
  "search market helpers"
);
replaceOnce(
  "public/global-search.js",
  '  viewContext.textContent = `正在搜尋整個劇集庫，包括劇名、中文譯名及單集名稱。搜尋字：${query}`;\n',
  '  viewContext.textContent = `正在搜尋${MARKET_LABELS[currentMarket()] || MARKET_LABELS.all}劇集庫，包括劇名、中文譯名及單集名稱。搜尋字：${query}`;\n',
  "search market heading"
);
replaceOnce(
  "public/global-search.js",
  '  if (regionSelect) regionSelect.disabled = false;\n',
  '  if (regionSelect) regionSelect.disabled = false;\n  if (marketSelect) marketSelect.disabled = false;\n',
  "search market enabled"
);
replaceOnce(
  "public/global-search.js",
  'async function fetchSearch(query, region, timeoutMs = 12000) {\n',
  'async function fetchSearch(query, region, market, timeoutMs = 12000) {\n',
  "search market signature"
);
replaceOnce(
  "public/global-search.js",
  '    const params = new URLSearchParams({ q: query, region, limit: "100" });\n',
  '    const params = new URLSearchParams({ q: query, region, market, limit: "100" });\n',
  "search market param"
);
replaceOnce(
  "public/global-search.js",
  '  const region = currentRegion();\n  setSearchModeVisuals();\n',
  '  const region = currentRegion();\n  const market = currentMarket();\n  setSearchModeVisuals();\n',
  "search market state"
);
replaceOnce(
  "public/global-search.js",
  '    const payload = await fetchSearch(query, region);\n    if (!active || activeRequest !== requestId || currentQuery() !== query || currentRegion() !== region) return;\n',
  '    const payload = await fetchSearch(query, region, market);\n    if (!active || activeRequest !== requestId || currentQuery() !== query || currentRegion() !== region || currentMarket() !== market) return;\n',
  "search market request"
);
replaceOnce(
  "public/global-search.js",
  'if (searchInput && regionSelect && contentPanel && showGrid && scheduleList && emptyState) {\n',
  'if (searchInput && regionSelect && marketSelect && contentPanel && showGrid && scheduleList && emptyState) {\n',
  "search market required"
);
replaceOnce(
  "public/global-search.js",
  '  document.addEventListener("change", (event) => {\n    if (event.target !== regionSelect || !active || allowUnderlyingRegionChange) return;\n    event.stopImmediatePropagation();\n    saveRegion(currentRegion());\n    window.clearTimeout(searchTimer);\n    const query = currentQuery();\n    if (query) searchTimer = window.setTimeout(() => runGlobalSearch(query), 0);\n  }, true);\n',
  '  document.addEventListener("change", (event) => {\n    if (!active || (event.target !== regionSelect && event.target !== marketSelect)) return;\n    if (event.target === regionSelect && allowUnderlyingRegionChange) return;\n    event.stopImmediatePropagation();\n    if (event.target === regionSelect) saveRegion(currentRegion());\n    if (event.target === marketSelect) saveMarket(currentMarket());\n    window.clearTimeout(searchTimer);\n    const query = currentQuery();\n    if (query) searchTimer = window.setTimeout(() => runGlobalSearch(query), 0);\n  }, true);\n',
  "search selector change"
);

console.log("Phase 10C market selector patch applied");
