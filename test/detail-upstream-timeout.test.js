import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [detailBuilder, detailWorker, watchBuilder, detailUi] = await Promise.all([
  readFile(new URL("../src/phase6-details.js", import.meta.url), "utf8"),
  readFile(new URL("../src/phase6-worker.js", import.meta.url), "utf8"),
  readFile(new URL("../src/phase7-watch.js", import.meta.url), "utf8"),
  readFile(new URL("../public/show-details.js", import.meta.url), "utf8")
]);

function assertBoundedTmdbFetch(source, label) {
  assert.match(source, /const TMDB_REQUEST_TIMEOUT_MS = 3000;/, `${label} must keep a short TMDB timeout`);
  assert.match(source, /signal: AbortSignal\.timeout\(TMDB_REQUEST_TIMEOUT_MS\)/, `${label} TMDB fetch must be abortable`);
}

test("detail-page TMDB enrichment is bounded below the browser request budget", () => {
  assertBoundedTmdbFetch(detailBuilder, "detail media");
  assertBoundedTmdbFetch(detailWorker, "localized detail");
  assert.match(detailUi, /timeoutMs = 12000/);
});

test("watch-provider enrichment cannot remain pending indefinitely", () => {
  assertBoundedTmdbFetch(watchBuilder, "watch providers");
  assert.match(watchBuilder, /catch \(error\)[\s\S]*normalizeWatchProviders\(\{\}\)/);
});

test("detail media failure remains a soft fallback instead of failing the stored show", () => {
  assert.match(detailBuilder, /catch \(error\) \{\s*mediaError =/);
  assert.match(detailBuilder, /status: 200,[\s\S]*show: resolvedShow,[\s\S]*seasons,[\s\S]*media/);
  assert.match(detailWorker, /catch \{\s*\/\/ Stored English detail and the already-fetched media remain a safe fallback\./);
});
