import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import phase8Worker from "../src/phase8-worker.js";
import {
  BROWSE_SORTS,
  BROWSE_STATUSES,
  buildBrowse,
  normalizeBrowseFilters,
  normalizeBrowseLimit
} from "../src/phase8-browse.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const ROW = Object.freeze({
  id: 77,
  tmdb_id: 7700,
  english_title: "Browse Example",
  original_title: "Browse Example",
  status: "airing",
  first_air_date: "2026-02-10",
  popularity: 81,
  vote_average: 8.4,
  vote_count: 900,
  title_zh_hk: "瀏覽示例",
  title_zh_hk_source: "tmdb",
  title_zh_hk_confidence: "normal",
  networks: "HBO",
  genres: "Drama",
  latest_season_number: 2
});

function fakeBrowseDb() {
  const sql = [];
  const bindings = [];
  return {
    sql,
    bindings,
    prepare(statement) {
      sql.push(statement);
      const bound = (...args) => {
        bindings.push(args);
        return {
          async all() {
            if (statement.includes("LEFT JOIN preferred_show_titles")) return { results: [ROW] };
            return { results: [] };
          },
          async first() {
            return { count: 1 };
          }
        };
      };
      return {
        bind: bound,
        async all() {
          if (statement.includes("FROM show_networks sn")) {
            return { results: [{ value: "HBO", count: 12 }, { value: "FX", count: 7 }] };
          }
          if (statement.includes("FROM show_genres sg")) {
            return { results: [{ value: "Drama", count: 15 }] };
          }
          if (statement.includes("FROM shows\n      WHERE status IN")) {
            return { results: [{ value: "airing", count: 9 }, { value: "completed", count: 20 }] };
          }
          if (statement.includes("substr(first_air_date, 1, 4) AS value")) {
            return { results: [{ value: "2026", count: 11 }, { value: "2025", count: 22 }] };
          }
          return { results: [] };
        }
      };
    }
  };
}

test("Phase 8B exposes bounded allowlisted filters and sorts", () => {
  assert.deepEqual(Object.keys(BROWSE_SORTS), ["popular", "rating", "newest", "oldest", "title"]);
  assert.deepEqual(BROWSE_STATUSES.map((item) => item.value), ["airing", "upcoming", "planned", "completed"]);

  const valid = normalizeBrowseFilters(new URL("https://example.test/api/discover?mode=browse&network=HBO&genre=Drama&status=airing&year=2026&sort=rating"));
  assert.deepEqual(valid, { network: "HBO", genre: "Drama", status: "airing", year: "2026", sort: "rating" });

  const invalid = normalizeBrowseFilters(new URL("https://example.test/api/discover?mode=browse&status=deleted&year=1800&sort=DROP%20TABLE"));
  assert.equal(invalid.status, null);
  assert.equal(invalid.year, null);
  assert.equal(invalid.sort, "popular");
  assert.equal(normalizeBrowseLimit(new URL("https://example.test/api/discover?limit=3")), 12);
  assert.equal(normalizeBrowseLimit(new URL("https://example.test/api/discover?limit=500")), 100);
});

test("Phase 8B binds network, genre, status and year instead of interpolating facet values", async () => {
  const DB = fakeBrowseDb();
  const result = await buildBrowse(
    { DB },
    new URL("https://example.test/api/discover?mode=browse&region=HK&network=HBO&genre=Drama&status=airing&year=2026&sort=newest&limit=24")
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.meta.phase, "8b-faceted-browse");
  assert.equal(result.body.meta.externalRequests, 0);
  assert.equal(result.body.meta.totalCount, 1);
  assert.equal(result.body.data.items[0].display_title_zh, "瀏覽示例");
  assert.equal(result.body.data.facets.networks[0].value, "HBO");
  assert.match(DB.sql.find((statement) => statement.includes("LEFT JOIN preferred_show_titles")), /bn\.canonical_name = \?/);
  assert.match(DB.sql.find((statement) => statement.includes("LEFT JOIN preferred_show_titles")), /bg\.name = \?/);
  assert.ok(DB.bindings.some((args) => args.includes("HBO") && args.includes("Drama") && args.includes("airing") && args.includes("2026")));
});

test("Phase 8 worker keeps featured discovery and faceted browse on the same endpoint", async () => {
  const response = await phase8Worker.fetch(
    new Request("https://example.test/api/discover?mode=browse&region=HK&network=HBO"),
    { DB: fakeBrowseDb() },
    {}
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.meta.phase, "8b-faceted-browse");
  assert.equal(payload.meta.filters.network, "HBO");
  assert.equal(payload.meta.externalRequests, 0);
});

test("Phase 8B UI separates featured rails from all-catalog facets", () => {
  const html = readFileSync(join(root, "public", "index.html"), "utf8");
  const ui = readFileSync(join(root, "public", "phase8-ui.js"), "utf8");
  const css = readFileSync(join(root, "public", "phase8.css"), "utf8");

  for (const id of [
    "phase8-featured-toggle",
    "phase8-browse-toggle",
    "phase8-network-filter",
    "phase8-genre-filter",
    "phase8-status-filter",
    "phase8-year-filter",
    "phase8-sort-filter",
    "phase8-reset-filters"
  ]) assert.match(html, new RegExp(`id=\\"${id}\\"`));

  assert.match(html, /Phase 8B/);
  assert.match(ui, /mode: "browse"/);
  assert.match(ui, /network/);
  assert.match(ui, /genre/);
  assert.match(ui, /status/);
  assert.match(ui, /year/);
  assert.match(ui, /sort/);
  assert.match(ui, /地區觀看供應仍由劇集詳情頁獨立顯示/);
  assert.match(css, /\.show-grid\.is-browse/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
