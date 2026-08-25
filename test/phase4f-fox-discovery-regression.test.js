import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/tmdb.js", import.meta.url), "utf8");

test("Phase 4F keeps genre persistence wired to genre_id", () => {
  assert.match(source, /INSERT OR REPLACE INTO show_genres \(show_id, genre_id\) VALUES \(\?1, \?2\)/);
  assert.doesNotMatch(source, /show_genres \(show_id, network_id\)/);
});

test("Phase 4F applies the recent first-air window only through network discovery params", () => {
  assert.match(source, /networkDiscoveryParams\(seed, now\)/);
  assert.match(source, /recentFirstAirYears: 3/);
  assert.match(source, /totalExternalRequests: 2 \+ CORE_NETWORK_SEEDS\.length \+ 40/);
});
