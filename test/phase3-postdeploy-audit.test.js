import test from "node:test";
import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";
const MERGED_AT = Date.parse("2026-08-24T12:09:23Z");

async function getJson(path) {
  let lastError;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const response = await fetch(`${PRODUCTION_URL}${path}`, {
        headers: { accept: "application/json" }
      });
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 10) await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  throw lastError;
}

function assertPostMergeSync(body, source) {
  assert.ok(body.data, `${source}: missing sync row`);
  assert.ok(["success", "success_with_warnings"].includes(body.data.status), `${source}: bad status ${body.data.status}`);
  const finishedAt = Date.parse(body.data.finished_at || "");
  assert.ok(Number.isFinite(finishedAt), `${source}: invalid finished_at`);
  assert.ok(finishedAt > MERGED_AT, `${source}: latest sync did not finish after Phase 3 merge`);
}

test("Phase 3 production post-deploy acceptance", async () => {
  const [health, audit, tmdb, tvmaze, shards] = await Promise.all([
    getJson("/health"),
    getJson("/api/title-audit"),
    getJson("/api/sync-status?source=tmdb"),
    getJson("/api/sync-status?source=tvmaze"),
    getJson("/api/shows?q=The%20Shards&region=HK&limit=10")
  ]);

  assert.equal(health.ok, true);
  assert.equal(health.service, "series-hub");
  assert.equal(health.phase, "3-regional-titles");
  assert.equal(health.titleAliasPolicy, "phase-3");
  assert.equal(health.databaseConfigured, true);
  assert.equal(health.databaseReachable, true);
  assert.equal(health.tmdbConfigured, true);
  assert.equal(health.tvmazeEnabled, true);

  assert.equal(audit.meta?.phase, "3-regional-titles");
  assert.equal(audit.meta?.policy, "phase-3");
  const total = Number(audit.data?.totalActive || 0);
  assert.ok(total >= 1, "active catalog must not be empty");
  assert.equal(Number(audit.data?.anyChinese?.count || 0), total, "Chinese title coverage regressed");
  assert.equal(Number(audit.data?.coverage?.HK?.count || 0), total, "HK title coverage regressed");
  assert.equal(Number(audit.data?.coverage?.TW?.count || 0), total, "TW title coverage regressed");
  assert.ok(Number(audit.data?.coverage?.CN?.count || 0) >= 24, "CN title coverage fell below accepted baseline");
  assert.ok(Number(audit.data?.manualOverrideShows || 0) >= 1, "manual override disappeared");

  assertPostMergeSync(tmdb, "TMDB");
  assertPostMergeSync(tvmaze, "TVmaze");

  const show = shards.data?.find((item) => item.english_title === "The Shards");
  assert.ok(show, "The Shards missing from production catalog");
  assert.equal(show.display_title_zh, "青春碎片");
  assert.equal(show.display_title_zh_region, "HK");
  assert.equal(show.display_title_zh_source, "manual");
  assert.equal(show.display_title_zh_confidence, "official");
  assert.equal(show.display_title_zh_fallback, false);

  const aliases = await getJson(`/api/shows/${show.id}/aliases?region=HK`);
  assert.equal(aliases.preferred?.title, "青春碎片");
  assert.equal(aliases.preferred?.region, "HK");
  assert.equal(aliases.preferred?.source, "manual");
  assert.equal(aliases.preferred?.confidence, "official");
  assert.equal(aliases.preferred?.fallback, false);

  const manual = aliases.data?.find((item) =>
    item.region === "HK"
    && item.title === "青春碎片"
    && item.source_key === "manual"
    && Number(item.is_preferred) === 1
    && item.confidence === "official"
  );
  assert.ok(manual, "manual preferred HK alias record missing");
});
