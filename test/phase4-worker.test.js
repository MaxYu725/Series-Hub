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

function lifecycleIndexDb(rows) {
  return {
    prepare(sql) {
      assert.match(sql, /active_lifecycle_events/);
      return {
        async all() {
          return { results: rows };
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

test("Phase 4B lifecycle index groups active evidence by show and projects dimensions", async () => {
  const rows = [
    {
      id: 10,
      show_id: 4,
      season_number: 4,
      event_type: "renewed",
      source_published_at: "2024-12-16",
      is_retracted: 0,
      confidence: "official",
      trust_level: "official"
    },
    {
      id: 11,
      show_id: 4,
      season_number: 4,
      event_type: "final_season",
      source_published_at: "2024-12-16",
      is_retracted: 0,
      confidence: "official",
      trust_level: "official"
    },
    {
      id: 20,
      show_id: 58,
      season_number: 6,
      event_type: "pre_production",
      source_published_at: "2026-03-24",
      is_retracted: 0,
      confidence: "official",
      trust_level: "official"
    }
  ];

  const response = await worker.fetch(
    new Request("https://example.test/api/lifecycle"),
    { DB: lifecycleIndexDb(rows) },
    {}
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.meta.projectionPolicy, "phase-4b");
  assert.equal(payload.meta.showCount, 2);
  assert.equal(payload.meta.eventCount, 3);
  assert.equal(payload.data["4"].summary.decision.event_type, "final_season");
  assert.equal(payload.data["58"].summary.production.event_type, "pre_production");
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