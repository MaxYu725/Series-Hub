import test from "node:test";
import assert from "node:assert/strict";

import {
  isTargetNetworkSeries,
  normalizeLifecycle
} from "../src/tmdb.js";

const NOW = new Date("2026-08-24T12:00:00Z");

function series(overrides = {}) {
  return {
    first_air_date: "2024-01-01",
    last_air_date: "2026-05-15",
    last_episode_to_air: { air_date: "2026-05-15" },
    next_episode_to_air: null,
    status: "Returning Series",
    seasons: [{ season_number: 1, air_date: "2024-01-01" }],
    networks: [{ name: "ABC" }],
    ...overrides
  };
}

test("a returning series after a long hiatus with a future episode is upcoming", () => {
  const lifecycle = normalizeLifecycle(
    series({ next_episode_to_air: { air_date: "2026-10-15" } }),
    NOW
  );

  assert.equal(lifecycle.status, "upcoming");
  assert.equal(lifecycle.nextAirDate, "2026-10-15");
});

test("a recently active weekly series with a future episode remains airing", () => {
  const lifecycle = normalizeLifecycle(
    series({
      last_air_date: "2026-08-20",
      last_episode_to_air: { air_date: "2026-08-20" },
      next_episode_to_air: { air_date: "2026-08-27" }
    }),
    NOW
  );

  assert.equal(lifecycle.status, "airing");
  assert.equal(lifecycle.nextAirDate, "2026-08-27");
});

test("major US scripted networks and streamers are in Phase 1B scope", () => {
  for (const name of ["Apple TV", "HBO", "Prime Video", "FX", "FOX", "Hulu", "Paramount+", "Peacock"]) {
    assert.equal(isTargetNetworkSeries({ networks: [{ name }] }), true, name);
  }
});

test("non-target broad-discovery sources do not enter the MVP catalog", () => {
  assert.equal(isTargetNetworkSeries({ networks: [{ name: "YouTube" }, { name: "Spotify" }] }), false);
  assert.equal(isTargetNetworkSeries({ networks: [{ name: "TNT" }, { name: "TBS" }] }), false);
  assert.equal(isTargetNetworkSeries({ networks: [] }), false);
});
