import test from "node:test";
import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";

async function json(path) {
  const response = await fetch(`${PRODUCTION_URL}${path}`, { headers: { "cache-control": "no-cache" } });
  assert.equal(response.status, 200, `${path} should return 200`);
  return response.json();
}

test("resolve Reacher production identity before official Amazon evidence seed", async () => {
  const catalog = await json("/api/shows?q=Reacher&limit=20&region=HK");
  const candidates = Array.isArray(catalog.data) ? catalog.data : [];
  const reacher = candidates.find((show) => String(show.english_title || show.original_title).toLowerCase() === "reacher");
  assert.ok(reacher, "Reacher must exist in the production catalog");
  assert.ok(Number.isSafeInteger(Number(reacher.id)) && Number(reacher.id) > 0, "Series Hub ID must be stable");
  assert.ok(Number.isSafeInteger(Number(reacher.tmdb_id)) && Number(reacher.tmdb_id) > 0, "TMDB ID must be present");

  const lifecycleResponse = await fetch(`${PRODUCTION_URL}/api/shows/${reacher.id}/lifecycle`, { headers: { "cache-control": "no-cache" } });
  assert.equal(lifecycleResponse.status, 200);
  const lifecycle = await lifecycleResponse.json();

  console.log(JSON.stringify({
    id: reacher.id,
    tmdb_id: reacher.tmdb_id,
    english_title: reacher.english_title,
    status: reacher.status,
    latest_season_number: reacher.latest_season_number,
    lifecycle_events: Array.isArray(lifecycle.data) ? lifecycle.data.map((event) => [event.id, event.season_number, event.event_type, event.source_key]) : []
  }));

  assert.equal(lifecycle.meta?.authoritativeFactsOnly, true);
});