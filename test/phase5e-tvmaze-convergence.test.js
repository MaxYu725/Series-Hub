import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const wrangler = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
const phase5eWorker = fs.readFileSync("src/phase5e-worker.js", "utf8");
const tvmazeSource = fs.readFileSync("src/tvmaze.js", "utf8");

test("Phase 5E-C runs bounded TVmaze convergence hourly without changing TMDB or reminder cadence", () => {
  assert.equal(wrangler.main, "./src/phase5e-worker.js");
  assert.deepEqual(wrangler.triggers?.crons, [
    "7 * * * *",
    "17 */6 * * *",
    "47 * * * *"
  ]);
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
