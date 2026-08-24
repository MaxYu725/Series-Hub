import test from "node:test";
import assert from "node:assert/strict";

import worker from "../src/phase4-worker.js";

function missingShowDb() {
  return {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              return null;
            }
          };
        }
      };
    }
  };
}

test("Phase 4 wrapper exposes lifecycle route without changing the core phase contract", async () => {
  const lifecycleResponse = await worker.fetch(
    new Request("https://example.test/api/shows/999/lifecycle"),
    { DB: missingShowDb() },
    {}
  );
  assert.equal(lifecycleResponse.status, 404);
  const lifecycle = await lifecycleResponse.json();
  assert.equal(lifecycle.error, "show_not_found");

  const healthResponse = await worker.fetch(
    new Request("https://example.test/health"),
    {},
    {}
  );
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.phase, "3-regional-titles");
  assert.equal(health.titleAliasPolicy, "phase-3");
});

test("lifecycle editorial endpoint rejects requests without the internal key", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/api/internal/lifecycle-evidence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "retract", eventId: 1, retractionNote: "test" })
    }),
    { TMDB_API_TOKEN: "test-token", DB: missingShowDb() },
    {}
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "unauthorized");
});