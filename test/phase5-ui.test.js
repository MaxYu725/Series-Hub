import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../public/phase5-ui.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../public/phase5.css", import.meta.url), "utf8");

test("Phase 5A exposes My Shows without making it a Phase 1-4 app filter", () => {
  assert.match(html, /id="my-shows-filter"/);
  assert.match(html, /class="phase5-filter"/);
  assert.doesNotMatch(html, /class="filter[^\"]*"[^>]*id="my-shows-filter"/);
  assert.match(html, /phase5\.css/);
  assert.match(html, /phase5-ui\.js/);
});

test("My Shows reuses active catalog APIs instead of adding a backend tracking endpoint", () => {
  for (const status of ["airing", "upcoming", "planned"]) assert.match(ui, new RegExp(`"${status}"`));
  assert.match(ui, /fetch\(`\/api\/shows\?\$\{params\}`/);
  assert.doesNotMatch(ui, /\/api\/tracking|\/api\/favorites|method:\s*["']POST["']/);
});

test("tracking controls are accessible and local-browser scoped", () => {
  assert.match(ui, /aria-pressed/);
  assert.match(ui, /只儲存在這個瀏覽器/);
  assert.match(css, /\.tracking-toggle/);
});

test("Phase 5A keeps Phase 3 region state authoritative while My Shows is active", () => {
  assert.match(ui, /regionSelect\.disabled = true/);
  assert.match(ui, /regionSelect\.disabled = false/);
});

test("tracking decoration cannot create a MutationObserver feedback loop", () => {
  assert.match(ui, /function syncTrackingButton\(/);
  assert.match(ui, /if \(button\.textContent !== text\) button\.textContent = text/);
  assert.match(ui, /observer\.observe\(showGrid, \{ childList: true \}\)/);
  assert.doesNotMatch(ui, /observer\.observe\(showGrid, \{[^}]*subtree:\s*true/);
});
