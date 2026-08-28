import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const html = readFileSync(join(root, "public", "show.html"), "utf8");
const js = readFileSync(join(root, "public", "phase6c-ui.js"), "utf8");
const css = readFileSync(join(root, "public", "phase6c.css"), "utf8");
const stateJs = readFileSync(join(root, "public", "phase6c-state.js"), "utf8");
const stateCss = readFileSync(join(root, "public", "phase6c-state.css"), "utf8");
const worker = readFileSync(join(root, "src", "phase6-worker.js"), "utf8");

test("Phase 6C loads after the accepted 6B detail layers", () => {
  assert.match(html, /phase6c\.css/);
  assert.match(html, /phase6c-state\.css/);
  assert.match(html, /phase6c-ui\.js/);
  assert.match(html, /phase6c-state\.js/);
  assert.ok(html.indexOf("phase6b-ui.js") < html.indexOf("phase6c-ui.js"));
  assert.ok(html.indexOf("phase6c-ui.js") < html.indexOf("phase6c-state.js"));
  assert.match(html, /Phase 6C/);
});

test("Phase 6C exposes a read-only per-season episode route without a schema change", () => {
  assert.match(worker, /seasonEpisodesMatch/);
  assert.match(worker, /listSeasonEpisodes/);
  assert.match(worker, /se\.show_id = \?1 AND se\.season_number = \?2/);
  assert.match(worker, /e\.image_url/);
  assert.match(worker, /e\.runtime_minutes/);
  assert.match(worker, /LIMIT 200/);
  assert.match(worker, /return phase5eWorker\.scheduled\(controller, env, ctx\);/);
});

test("Phase 6C season navigation works by cards and a compact selector", () => {
  assert.match(js, /phase6c-season-select/);
  assert.match(js, /查看第 \$\{number\} 季集數/);
  assert.match(js, /event\.key !== "Enter" && event\.key !== " "/);
  assert.match(js, /card\.dataset\.seasonNumber/);
  assert.match(js, /scrollIntoView/);
});

test("Phase 6C episode cards surface image, overview, runtime and schedule state", () => {
  assert.match(js, /episode\.image_url/);
  assert.match(js, /episode\.overview/);
  assert.match(js, /runtime_minutes/);
  assert.match(js, /即將播出/);
  assert.match(js, /已播出/);
  assert.match(js, /時間待定/);
  assert.match(js, /timeZoneName: "short"/);
  assert.match(js, /\/api\/shows\/\$\{showId\}\/seasons\/\$\{number\}\/episodes/);
});

test("Phase 6C reuses existing local My Shows and viewing-state modules", () => {
  assert.match(stateJs, /from "\.\/tracking\.js"/);
  assert.match(stateJs, /from "\.\/viewing-state\.js"/);
  assert.match(stateJs, /saveTrackedShowIds\(toggleTrackedShowId/);
  assert.match(stateJs, /saveViewingStates\(setViewingState/);
  assert.match(stateJs, /series-hub-tracking-changed/);
  assert.match(stateCss, /phase6c-tracking-button/);
  assert.match(stateCss, /phase6c-viewing-control/);
});

test("Phase 6C remains usable on narrow mobile detail pages", () => {
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /phase6c-season-control/);
  assert.match(css, /phase6c-episode-card/);
  assert.match(css, /phase6c-episode-placeholder/);
  assert.match(stateCss, /@media \(max-width: 540px\)/);
});
