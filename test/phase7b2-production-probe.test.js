import test from "node:test";
import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";
const EXPECTED_KEY = "b0fea84fd2ac38eb59cd7bfe66be2a2bda3ff880b5db9a9085de470a5c2656f2";

test("Phase 7B.2 AMC Global Media evidence is visible in production", async () => {
  const response = await fetch(`${PRODUCTION_URL}/api/shows/1980/lifecycle`);
  assert.equal(response.ok, true);
  const payload = await response.json();
  const event = payload.data?.find((row) => row.evidence_key === EXPECTED_KEY);

  assert.ok(event, "Phase 7B.2 Dead City S3 evidence fingerprint is missing from production");
  assert.equal(event.show_id, 1980);
  assert.equal(event.season_number, 3);
  assert.equal(event.event_type, "premiere_dated");
  assert.equal(event.source_key, "amc_global_media_press");
  assert.equal(event.confidence, "official");
  assert.equal(Number(event.is_retracted), 0);
  console.log("PHASE7B2_PRODUCTION", JSON.stringify(event));
});
