import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDiscovery, DISCOVERY_SECTIONS, normalizeDiscoveryLimit } from "../src/phase8-discovery.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function fakeDb(row) {
  const sql = [];
  return {
    sql,
    prepare(statement) {
      sql.push(statement);
      return {
        bind() {
          return {
            async all() {
              return { results: [row] };
            }
          };
        }
      };
    }
  };
}

const ROW = Object.freeze({
  id: 42,
  tmdb_id: 4242,
  english_title: "Example Show",
  original_title: "Example Show",
  status: "airing",
  popularity: 50,
  vote_average: 8.2,
  vote_count: 1200,
  title_zh_hk: "示例劇集",
  title_zh_hk_source: "tmdb",
  title_zh_hk_confidence: "normal",
  networks: "HBO",
  genres: "Drama",
  latest_season_number: 2
});

test("Phase 8A defines four catalog-only discovery rails", () => {
  assert.deepEqual(DISCOVERY_SECTIONS.map((section) => section.key), [
    "popular_now",
    "new_series",
    "coming_soon",
    "top_rated"
  ]);
  assert.match(DISCOVERY_SECTIONS.find((section) => section.key === "new_series").where, /-12 months/);
  assert.match(DISCOVERY_SECTIONS.find((section) => section.key === "top_rated").where, /vote_count/);
});

test("discovery limit is bounded for horizontal rails", () => {
  assert.equal(normalizeDiscoveryLimit(new URL("https://example.test/api/discover")), 12);
  assert.equal(normalizeDiscoveryLimit(new URL("https://example.test/api/discover?limit=2")), 4);
  assert.equal(normalizeDiscoveryLimit(new URL("https://example.test/api/discover?limit=99")), 20);
});

test("discovery resolves regional Chinese titles without external requests", async () => {
  const DB = fakeDb(ROW);
  const result = await buildDiscovery({ DB }, new URL("https://example.test/api/discover?region=HK&limit=8"));

  assert.equal(result.status, 200);
  assert.equal(result.body.meta.phase, "8a-discovery-home");
  assert.equal(result.body.meta.externalRequests, 0);
  assert.equal(result.body.meta.sectionCount, 4);
  assert.equal(DB.sql.length, 4);
  assert.equal(result.body.data.sections[0].items[0].display_title_zh, "示例劇集");
  assert.equal(result.body.data.sections[0].items[0].display_title_zh_region, "HK");
});

test("Phase 8 worker and homepage expose discovery without replacing existing views", () => {
  const worker = readFileSync(join(root, "src", "phase8-worker.js"), "utf8");
  const wrangler = readFileSync(join(root, "wrangler.jsonc"), "utf8");
  const html = readFileSync(join(root, "public", "index.html"), "utf8");
  const ui = readFileSync(join(root, "public", "phase8-ui.js"), "utf8");

  assert.match(worker, /url\.pathname === "\/api\/discover"/);
  assert.match(worker, /return phase7Worker\.fetch/);
  assert.match(wrangler, /"main": "\.\/src\/phase8-worker\.js"/);
  assert.match(html, /id="discover-filter"/);
  assert.match(html, /phase8\.css/);
  assert.match(html, /phase8-ui\.js/);
  assert.match(ui, /熱門追看/);
  assert.match(ui, /近一年新劇/);
  assert.match(ui, /即將開播/);
  assert.match(ui, /高評分/);
  assert.match(ui, /\/api\/discover\?\$\{params\}/);
});

test("discovery view keeps global search and normal navigation separable", () => {
  const ui = readFileSync(join(root, "public", "phase8-ui.js"), "utf8");
  assert.match(ui, /releaseGlobalSearch/);
  assert.match(ui, /bridge\.className = "filter"/);
  assert.match(ui, /window\.addEventListener\("input"/);
  assert.match(ui, /showGrid\.classList\.remove\("is-discovery"\)/);
});
