import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const html = readFileSync(join(root, "public", "show.html"), "utf8");
const css = readFileSync(join(root, "public", "phase6c1.css"), "utf8");

test("Phase 6C.1 loads after the existing Phase 6C detail styles", () => {
  assert.match(html, /phase6c1\.css/);
  assert.ok(html.indexOf("phase6c-state.css") < html.indexOf("phase6c1.css"));
});

test("potentially long season, episode and secondary-video lists are horizontal rails", () => {
  assert.match(css, /\.detail-seasons[\s\S]*\.phase6c-episode-list[\s\S]*\.detail-trailer-list/);
  assert.match(css, /grid-auto-flow:\s*column/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /scroll-snap-type:\s*x proximity/);
  assert.match(css, /-webkit-overflow-scrolling:\s*touch/);
});

test("season and episode cards expose a next-card peek on mobile instead of filling an endless vertical list", () => {
  assert.match(css, /\.detail-seasons\s*\{[\s\S]*grid-auto-columns:\s*min\(78vw, 300px\)/);
  assert.match(css, /\.phase6c-episode-list\s*\{[\s\S]*grid-auto-columns:\s*min\(82vw, 360px\)/);
  assert.match(css, /scroll-snap-align:\s*start/);
});

test("episode rail preserves complete image-first cards while keeping text-heavy lifecycle evidence vertical", () => {
  assert.match(css, /\.phase6c-episode-card,[\s\S]*\.phase6c-episode-skeleton\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /aspect-ratio:\s*16 \/ 9/);
  assert.doesNotMatch(css, /\.detail-lifecycle\b/);
});
