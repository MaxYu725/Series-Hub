import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const html = readFileSync(join(root, "public", "index.html"), "utf8");
const phase8Ui = readFileSync(join(root, "public", "phase8-ui.js"), "utf8");
const phase8eUi = readFileSync(join(root, "public", "phase8e-ui.js"), "utf8");
const searchUi = readFileSync(join(root, "public", "global-search.js"), "utf8");
const css = readFileSync(join(root, "public", "phase8.css"), "utf8");
const signals = readFileSync(join(root, "public", "local-catalog-signals.js"), "utf8");

test("Phase 8E exposes accessible Explore mode state without changing the three-mode product model", () => {
  assert.match(html, /Phase 8E/);
  for (const id of ["phase8-featured-toggle", "phase8-personal-toggle", "phase8-browse-toggle"]) {
    assert.match(html, new RegExp(`id=\\"${id}\\"[^>]*aria-pressed=\\"false\\"[^>]*aria-controls=\\"show-grid\\"`));
  }
  assert.ok(html.indexOf('/phase8e-ui.js') < html.indexOf('/phase8-ui.js'));
  assert.match(phase8eUi, /setAttribute\("aria-pressed"/);
  assert.match(phase8eUi, /MutationObserver\(syncPressedState\)/);
});

test("clearing global search restores the exact originating Explore mode", () => {
  assert.match(phase8eUi, /series-hub:search-origin/);
  assert.match(phase8eUi, /detail:\s*\{ view: "discover", mode \}/);
  assert.match(searchUi, /previousDiscoveryMode/);
  assert.match(searchUi, /pendingDiscoveryMode/);
  assert.match(searchUi, /series-hub:search-origin/);
  assert.match(searchUi, /series-hub:restore-discovery/);
  assert.match(phase8eUi, /series-hub:restore-discovery/);
  assert.match(phase8eUi, /MODE_BUTTONS\[mode\]/);
});

test("all Phase 8 network-backed views retain bounded loading and explicit failure states", () => {
  assert.match(phase8Ui, /async function fetchFeatured\(region, timeoutMs = 12000\)/);
  assert.match(phase8Ui, /async function fetchBrowse\(region, timeoutMs = 12000\)/);
  assert.match(phase8Ui, /async function fetchPersonalPool\(region, timeoutMs = 12000\)/);
  assert.match(searchUi, /async function fetchSearch\(query, region, timeoutMs = 12000\)/);
  assert.match(phase8Ui, /探索內容暫時無法使用/);
  assert.match(phase8Ui, /為你推薦暫時無法使用/);
  assert.match(phase8Ui, /劇集瀏覽暫時無法使用/);
  assert.match(searchUi, /全域搜尋暫時無法使用/);
});

test("mobile acceptance keeps featured rails horizontal and browse/personal grids compact", () => {
  assert.match(css, /\.discovery-rail \{[\s\S]*?grid-auto-flow:\s*column[\s\S]*?overflow-x:\s*auto/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.phase8-mode-button,[\s\S]*?min-height:\s*44px/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.show-grid\.is-browse,[\s\S]*?\.show-grid\.is-personal \{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});

test("personal discovery privacy boundary remains browser-local during Phase 8 closeout", () => {
  assert.match(phase8Ui, /mode: "browse", limit: "100", sort: "popular"/);
  assert.doesNotMatch(phase8Ui, /params\.set\(["'](?:tracked|tracking|viewing|viewing_state|show_ids|taste)/i);
  assert.match(phase8Ui, /伺服器只收到通用 catalog request/);
  assert.match(signals, /LOCAL_CATALOG_SIGNAL_LIMIT = 300/);
  assert.match(signals, /return \{ id, networks, genres \}/);
  assert.doesNotMatch(signals, /title:\s*show|poster_url:\s*show|search_term|watch_date/);
});
