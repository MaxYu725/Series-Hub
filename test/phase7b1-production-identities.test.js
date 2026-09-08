import test from "node:test";
import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";

test("Phase 7B.1 diagnostic inventories production Series Hub identities", async () => {
  const response = await fetch(`${PRODUCTION_URL}/api/shows?limit=100`);
  assert.equal(response.ok, true, "production catalog query failed");
  const payload = await response.json();
  const shows = (payload.data || []).map((row) => ({
    id: row.id,
    tmdb_id: row.tmdb_id,
    english_title: row.english_title,
    original_title: row.original_title,
    status: row.status,
    latest_season_number: row.latest_season_number,
    networks: row.networks
  }));
  console.log(`PHASE7B1_CATALOG ${JSON.stringify(shows)}`);
  assert.ok(shows.length > 0, "production catalog is empty");
});
