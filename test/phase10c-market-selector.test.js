import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { catalogMarketPattern, normalizeCatalogMarket } from "../src/market.js";
import { normalizeBrowseFilters } from "../src/phase8-browse.js";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Phase 10C normalizes only supported catalog markets", () => {
  assert.equal(normalizeCatalogMarket(), "all");
  assert.equal(normalizeCatalogMarket("all"), "all");
  assert.equal(normalizeCatalogMarket("US"), "US");
  assert.equal(normalizeCatalogMarket("us"), "US");
  assert.equal(normalizeCatalogMarket("KR"), "KR");
  assert.equal(normalizeCatalogMarket("kr"), "KR");
  assert.equal(normalizeCatalogMarket("JP"), "all");
  assert.equal(catalogMarketPattern("all"), null);
  assert.equal(catalogMarketPattern("US"), "%,US,%");
  assert.equal(catalogMarketPattern("KR"), "%,KR,%");
});

test("Phase 10C browse filters carry the same market contract", () => {
  assert.equal(normalizeBrowseFilters(new URL("https://series.test/api/discover?market=KR")).market, "KR");
  assert.equal(normalizeBrowseFilters(new URL("https://series.test/api/discover?market=US")).market, "US");
  assert.equal(normalizeBrowseFilters(new URL("https://series.test/api/discover?market=invalid")).market, "all");
});

test("Phase 10C applies market filtering to catalog, schedule, discovery, browse and search", () => {
  const index = source("src/index.js");
  const phase6 = source("src/phase6-worker.js");
  const phase8Catalog = source("src/phase8-catalog.js");
  const phase8Discovery = source("src/phase8-discovery.js");
  const phase8Browse = source("src/phase8-browse.js");

  assert.match(index, /normalizeCatalogMarket\(url\.searchParams\.get\("market"\)\)/);
  assert.match(index, /COALESCE\(s\.origin_country, ''\).*LIKE '%,' \|\| \?3 \|\| ',%'/s);
  assert.match(index, /s\.origin_country,[\s\S]*FROM episodes e/);

  assert.match(phase6, /catalogUrl\.searchParams\.set\("market", market\)/);
  assert.match(phase6, /episodeSearchMatches\(env, query, titleRegion, market, limit\)/);
  assert.match(phase6, /COALESCE\(s\.origin_country, ''\).*\?2/s);

  assert.match(phase8Catalog, /s\.origin_country/);
  assert.match(phase8Discovery, /normalizeCatalogMarket/);
  assert.match(phase8Discovery, /COALESCE\(s\.origin_country, ''\)/);
  assert.match(phase8Browse, /catalogMarketPattern\(filters\.market\)/);
  assert.match(phase8Browse, /loadBrowseFacets\(env, filters\.market\)/);
});

test("Phase 10C exposes one persistent shared market selector across UI controllers", () => {
  const html = source("public/index.html");
  const app = source("public/app.js");
  const phase8 = source("public/phase8-ui.js");
  const globalSearch = source("public/global-search.js");

  assert.match(html, /id="market-select"/);
  assert.match(html, /option value="all">全部<\/option>/);
  assert.match(html, /option value="US">美國<\/option>/);
  assert.match(html, /option value="KR">韓國<\/option>/);

  for (const uiSource of [app, phase8, globalSearch]) {
    assert.match(uiSource, /series-hub-catalog-market/);
    assert.match(uiSource, /#market-select/);
    assert.match(uiSource, /market/);
  }

  assert.match(app, /URLSearchParams\(\{ status: view\.status, limit: "60", region: state\.titleRegion, market: state\.market \}\)/);
  assert.match(app, /URLSearchParams\(\{ from, days: String\(apiDays\), region: state\.titleRegion, market: state\.market \}\)/);
  assert.match(phase8, /URLSearchParams\(\{ region, market, limit: "12" \}\)/);
  assert.match(globalSearch, /URLSearchParams\(\{ q: query, region, market, limit: "100" \}\)/);
});
