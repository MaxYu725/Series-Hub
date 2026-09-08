import test from "node:test";
import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";
const BENCHMARKS = ["MobLand", "The Five Star Weekend", "The Bear", "Dark Winds"];

test("Phase 7A.1 records post-merge production catalog benchmark presence", async () => {
  const results = [];
  for (const title of BENCHMARKS) {
    const response = await fetch(`${PRODUCTION_URL}/api/shows?limit=10&q=${encodeURIComponent(title)}`);
    assert.equal(response.ok, true, title);
    const payload = await response.json();
    const exact = (payload.data || []).find((row) => String(row.english_title || "").toLowerCase() === title.toLowerCase());
    results.push({
      title,
      present: Boolean(exact),
      show_id: exact?.id ?? null,
      tmdb_id: exact?.tmdb_id ?? null,
      status: exact?.status ?? null,
      networks: exact?.networks ?? null
    });
  }
  console.log("PHASE7A1_POST_MERGE_BENCHMARKS", JSON.stringify(results));
});
