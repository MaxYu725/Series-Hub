import test from "node:test";
import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";
const CASES = [
  { title: "MobLand", tmdbId: 247718 },
  { title: "The Five Star Weekend", tmdbId: 283151 },
  { title: "The Bear", tmdbId: 136315 },
  { title: "Dark Winds", tmdbId: 128904 }
];

test("Phase 7B.1 diagnostic resolves production Series Hub identities", async () => {
  for (const item of CASES) {
    const response = await fetch(`${PRODUCTION_URL}/api/shows?q=${encodeURIComponent(item.title)}&limit=20`);
    assert.equal(response.ok, true, `${item.title}: production query failed`);
    const payload = await response.json();
    const matches = (payload.data || []).map((row) => ({
      id: row.id,
      tmdb_id: row.tmdb_id,
      english_title: row.english_title,
      original_title: row.original_title,
      status: row.status,
      latest_season_number: row.latest_season_number
    }));
    console.log(`PHASE7B1_IDENTITY ${item.title}: ${JSON.stringify(matches)}`);
    assert.ok(matches.some((row) => Number(row.tmdb_id) === item.tmdbId), `${item.title}: expected TMDB ${item.tmdbId} is not in production catalog`);
  }
});
