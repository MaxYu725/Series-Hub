import test from "node:test";
import assert from "node:assert/strict";

import { lifecycleLabel, officialLifecycleProjection } from "../public/phase4-ui.js";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";
const EXPECTED_KEY = "13558ece6ebddff8d901a61e00be38e34ad5e4600c493e12ad639946b4549090";

async function fetchJson(path) {
  const response = await fetch(`${PRODUCTION_URL}${path}`, { headers: { "cache-control": "no-cache" } });
  assert.equal(response.status, 200, `${path} should return 200`);
  return response.json();
}

async function waitForAmazonEvidence() {
  let last = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    last = await fetchJson("/api/shows/1/lifecycle");
    const found = last.data?.find((event) => event.evidence_key === EXPECTED_KEY);
    if (found) return { payload: last, event: found };
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  assert.fail(`Amazon evidence did not appear in production; last count=${last?.meta?.count ?? "unknown"}`);
}

test("Reacher season 5 official Amazon evidence is live without replacing airing status", async () => {
  const [{ payload: lifecycle, event }, catalog, bulk] = await Promise.all([
    waitForAmazonEvidence(),
    fetchJson("/api/shows?q=Reacher&limit=20&region=HK"),
    fetchJson("/api/lifecycle")
  ]);

  const reacher = catalog.data?.find((show) => Number(show.id) === 1);
  assert.equal(reacher?.tmdb_id, 108978);
  assert.equal(reacher?.status, "airing");
  assert.equal(Number(reacher?.latest_season_number), 4);

  assert.equal(event.season_number, 5);
  assert.equal(event.event_type, "renewed");
  assert.equal(event.source_key, "amazon_entertainment");
  assert.equal(event.confidence, "official");
  assert.equal(event.trust_level, "official");
  assert.equal(event.source_published_at, "2026-05-11");
  assert.equal(event.source_url, "https://www.aboutamazon.com/news/entertainment/prime-video-reacher-how-to-watch");

  const official = officialLifecycleProjection(lifecycle.data || []);
  assert.equal(lifecycleLabel(official.decision), "第5季已續訂");

  const bulkRecord = bulk.data?.["1"];
  assert.ok(bulkRecord, "Reacher should be present in the active lifecycle bulk projection");
  assert.ok(bulkRecord.events?.some((row) => row.evidence_key === EXPECTED_KEY));

  console.log(JSON.stringify({
    catalogStatus: reacher.status,
    latestCatalogSeason: reacher.latest_season_number,
    lifecycleLabel: lifecycleLabel(official.decision),
    source: event.source_key,
    sourcePublishedAt: event.source_published_at
  }));
});