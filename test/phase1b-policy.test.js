import test from "node:test";
import assert from "node:assert/strict";

import {
  CORE_NETWORK_SEEDS,
  TMDB_SYNC_BUDGET,
  candidateRotationOffset,
  isIncludedUsScriptedSeries,
  isTargetNetworkSeries,
  networkDiscoveryParams,
  normalizeLifecycle,
  selectRoundRobinCandidates
} from "../src/tmdb.js";

const NOW = new Date("2026-08-24T12:00:00Z");

function series(overrides = {}) {
  return {
    first_air_date: "2024-01-01",
    last_air_date: "2026-05-15",
    last_episode_to_air: { air_date: "2026-05-15" },
    next_episode_to_air: null,
    status: "Returning Series",
    type: "Scripted",
    origin_country: ["US"],
    genres: [{ id: 18, name: "Drama" }],
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

test("non-scripted genres are excluded even when TMDB type says Scripted", () => {
  for (const [id, name] of [
    [16, "Animation"],
    [99, "Documentary"],
    [10762, "Kids"],
    [10763, "News"],
    [10764, "Reality"],
    [10767, "Talk"]
  ]) {
    assert.equal(
      isIncludedUsScriptedSeries(series({ genres: [{ id, name }] })),
      false,
      name
    );
  }

  assert.equal(isIncludedUsScriptedSeries(series()), true);
});

test("core network seeds include FX and remain within the Worker subrequest budget", () => {
  const names = CORE_NETWORK_SEEDS.map((seed) => seed.name);
  for (const required of ["Apple TV", "HBO", "Prime Video", "FOX", "FX", "Netflix"]) {
    assert.ok(names.includes(required), required);
  }

  assert.equal(TMDB_SYNC_BUDGET.networkDiscoveryRequests, 6);
  assert.equal(TMDB_SYNC_BUDGET.detailRequests, 40);
  assert.equal(TMDB_SYNC_BUDGET.totalExternalRequests, 48);
  assert.ok(TMDB_SYNC_BUDGET.totalExternalRequests <= 50);
});

test("FOX discovery uses a rolling three-year first-air window without changing request count", () => {
  const fox = CORE_NETWORK_SEEDS.find((seed) => seed.name === "FOX");
  assert.ok(fox);
  assert.equal(fox.recentFirstAirYears, 3);
  assert.deepEqual(networkDiscoveryParams(fox, NOW), {
    with_networks: 19,
    "first_air_date.gte": "2023-01-01"
  });
  assert.equal(TMDB_SYNC_BUDGET.networkDiscoveryRequests, CORE_NETWORK_SEEDS.length);
  assert.equal(TMDB_SYNC_BUDGET.totalExternalRequests, 48);
});

test("non-FOX network discovery remains unchanged and unbounded by first-air date", () => {
  for (const seed of CORE_NETWORK_SEEDS.filter((item) => item.name !== "FOX")) {
    assert.deepEqual(networkDiscoveryParams(seed, NOW), { with_networks: seed.tmdbNetworkId }, seed.name);
  }
});

test("FOX rolling window advances with the calendar year", () => {
  const fox = CORE_NETWORK_SEEDS.find((seed) => seed.name === "FOX");
  assert.equal(networkDiscoveryParams(fox, new Date("2027-01-01T00:00:00Z"))["first_air_date.gte"], "2024-01-01");
});

test("round-robin candidate selection gives every discovery feed early representation", () => {
  const feeds = [
    [{ id: 1 }, { id: 2 }, { id: 3 }],
    [{ id: 10 }, { id: 11 }, { id: 12 }],
    [{ id: 20 }, { id: 21 }, { id: 22 }]
  ];

  assert.deepEqual(
    selectRoundRobinCandidates(feeds, 6).map((item) => item.id),
    [1, 10, 20, 2, 11, 21]
  );
});

test("round-robin candidate selection de-duplicates IDs without starving later feeds", () => {
  const feeds = [
    [{ id: 1 }, { id: 2 }],
    [{ id: 1 }, { id: 3 }],
    [{ id: 4 }]
  ];

  assert.deepEqual(
    selectRoundRobinCandidates(feeds, 4).map((item) => item.id),
    [1, 3, 4, 2]
  );
});


test("candidate rotation advances page-one slices across six-hour sync slots", () => {
  const feeds = Array.from({ length: 8 }, (_, feedIndex) =>
    Array.from({ length: 20 }, (_, itemIndex) => ({ id: feedIndex * 100 + itemIndex }))
  );
  const offsets = [0, 6, 12, 18].map((hour) =>
    candidateRotationOffset(
      feeds,
      40,
      new Date(`2026-08-24T${String(hour).padStart(2, "0")}:00:00Z`)
    )
  );

  assert.equal(new Set(offsets).size, 4);
  assert.deepEqual([...offsets].sort((a, b) => a - b), [0, 5, 10, 15]);
});

test("round-robin rotation starts from the requested feed offset and wraps safely", () => {
  const feeds = [
    [{ id: 1 }, { id: 2 }, { id: 3 }],
    [{ id: 10 }, { id: 11 }, { id: 12 }],
    [{ id: 20 }, { id: 21 }, { id: 22 }]
  ];

  assert.deepEqual(
    selectRoundRobinCandidates(feeds, 6, 1).map((item) => item.id),
    [2, 11, 21, 3, 12, 22]
  );
});
