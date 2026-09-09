import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const wrangler = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
const phase8Worker = fs.readFileSync("src/phase8-worker.js", "utf8");
const phase7Worker = fs.readFileSync("src/phase7-worker.js", "utf8");
const phase6Worker = fs.readFileSync("src/phase6-worker.js", "utf8");
const phase5eWorker = fs.readFileSync("src/phase5e-worker.js", "utf8");
const tvmazeSource = fs.readFileSync("src/tvmaze.js", "utf8");

test("Phase 5E-C bounded TVmaze convergence survives later Worker wrappers without cadence changes", () => {
  assert.equal(wrangler.main, "./src/phase8-worker.js");
  assert.deepEqual(wrangler.triggers?.crons, [
    "7 * * * *",
    "17 */6 * * *",
    "47 * * * *"
  ]);
  assert.match(phase8Worker, /import phase7Worker from "\.\/phase7-worker\.js"/);
  assert.match(phase8Worker, /return phase7Worker\.scheduled\(controller, env, ctx\);/);
  assert.match(phase7Worker, /import phase6Worker from "\.\/phase6-worker\.js"/);
  assert.match(phase7Worker, /return phase6Worker\.scheduled\(controller, env, ctx\);/);
  assert.match(phase6Worker, /import phase5eWorker from "\.\/phase5e-worker\.js"/);
  assert.match(phase6Worker, /return phase5eWorker\.scheduled\(controller, env, ctx\);/);
  assert.match(phase5eWorker, /TVMAZE_CONVERGENCE_CRON = "47 \* \* \* \*"/);
  assert.match(phase5eWorker, /syncTvmazeEpisodes\(env\)/);
});

test("Phase 5E-C keeps each TVmaze invocation capped at ten shows", () => {
  assert.match(tvmazeSource, /const SHOWS_PER_SYNC = 10;/);
  assert.match(
    tvmazeSource,
    /Math\.min\(Math\.max\(Number\(options\.limit\) \|\| SHOWS_PER_SYNC, 1\), SHOWS_PER_SYNC\)/
  );
});

test("Phase 5E-C still delegates core fetch and non-TVmaze cron behavior after D4 catalog enrichment", () => {
  assert.match(phase5eWorker, /const response = await phase4Worker\.fetch\(request, env, ctx\);/);
  assert.match(phase5eWorker, /url\.pathname !== "\/api\/shows"/);
  assert.match(phase5eWorker, /return enrichCatalogNextEpisodes\(request, response, env\);/);
  assert.match(phase5eWorker, /return phase4Worker\.scheduled\(controller, env, ctx\);/);
  assert.doesNotMatch(phase5eWorker, /syncTmdbCatalog/);
  assert.doesNotMatch(phase5eWorker, /runEpisodeReminderDelivery/);
});