import test from "node:test";
import assert from "node:assert/strict";

const productionUrl = process.env.PRODUCTION_URL;

if (process.env.CI === "true" && productionUrl) {
  test("production is running the Phase 1 TMDB core", async () => {
    const [healthResponse, showsResponse, syncResponse] = await Promise.all([
      fetch(`${productionUrl}/health`, { cache: "no-store" }),
      fetch(`${productionUrl}/api/shows?limit=5`, { cache: "no-store" }),
      fetch(`${productionUrl}/api/sync-status`, { cache: "no-store" })
    ]);

    assert.equal(healthResponse.status, 200);
    assert.equal(showsResponse.status, 200);
    assert.equal(syncResponse.status, 200);

    const health = await healthResponse.json();
    const shows = await showsResponse.json();
    const sync = await syncResponse.json();

    assert.equal(health.ok, true);
    assert.equal(health.phase, "1-tmdb-core");
    assert.equal(health.databaseConfigured, true);
    assert.equal(health.databaseReachable, true);
    assert.equal(shows.meta?.phase, "1-tmdb-core");
    assert.ok(Array.isArray(shows.data));
    assert.ok(Object.prototype.hasOwnProperty.call(sync, "data"));
  });
}
