import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const html = readFileSync(join(root, "public", "index.html"), "utf8");
const searchJs = readFileSync(join(root, "public", "global-search.js"), "utf8");
const worker = readFileSync(join(root, "src", "phase6-worker.js"), "utf8");

test("global search owns search input before view-specific handlers", () => {
  assert.match(html, /global-search\.js/);
  assert.ok(html.indexOf("/global-search.js") > html.indexOf("/app.js"));
  assert.ok(html.indexOf("/global-search.js") < html.indexOf("/phase5-ui.js"));
  assert.match(searchJs, /document\.addEventListener\("input"[\s\S]*event\.stopImmediatePropagation\(\)/);
});

test("typing uses a dedicated global search endpoint instead of the current tab", () => {
  assert.match(searchJs, /\/api\/search\?\$\{params\}/);
  assert.match(searchJs, /viewKicker\.textContent = "SEARCH"/);
  assert.match(searchJs, /viewTitle\.textContent = "搜尋結果"/);
  assert.match(searchJs, /搜尋整個劇集庫/);
  assert.match(searchJs, /\.filter\.active, #my-shows-filter\.active/);
});

test("clearing search restores the previous view rather than walking every tab", () => {
  assert.match(searchJs, /previousView/);
  assert.match(searchJs, /previousWasMyShows/);
  assert.match(searchJs, /restoreAfterClear/);
  assert.match(searchJs, /series-hub:retry/);
  assert.match(searchJs, /myShowsButton\?\.click\(\)/);
});

test("global search backend deliberately omits status and reuses the catalog query", () => {
  assert.match(worker, /url\.pathname === "\/api\/search"/);
  assert.match(worker, /catalogUrl\.pathname = "\/api\/shows"/);
  assert.match(worker, /catalogUrl\.search = ""/);
  assert.match(worker, /catalogUrl\.searchParams\.set\("q", query\)/);
  assert.doesNotMatch(worker, /catalogUrl\.searchParams\.set\("status"/);
});

test("episode titles can resolve their parent show in global search", () => {
  assert.match(worker, /search_episode\.name LIKE \?1 COLLATE NOCASE/);
  assert.match(worker, /search_match_episode/);
  assert.match(worker, /search_match_season_number/);
  assert.match(worker, /search_match_episode_number/);
  assert.match(searchJs, /單集命中：/);
});

test("a global miss says the whole catalog was searched", () => {
  assert.match(searchJs, /整個劇集庫找不到符合的劇集/);
  assert.match(searchJs, /沒有任何劇集名稱、中文譯名或單集名稱符合/);
});
