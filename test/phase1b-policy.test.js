import test from "node:test";
import assert from "node:assert/strict";

import {
  CORE_NETWORK_SEEDS,
  TMDB_SYNC_BUDGET,
  candidateRotationOffset,
  isIncludedUsScriptedSeries,
  isTargetNetworkSeries,
  networkDiscoveryPage,
  networkDiscoveryParams,
  networkCandidateRotationOffset,
  normalizeLifecycle,
  selectNetworkSeedsForSync,
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

test("dedicated discovery covers major US groups while preserving the Worker request budget", () => {
  const seeds = new Map(CORE_NETWORK_SEEDS.map((seed) => [seed.name, seed.tmdbNetworkId]));
  const expected = new Map([
    ["Apple TV", 2552],
    ["HBO", 49],
    ["Prime Video", 1024],
    ["FOX", 19],
    ["FX", 88],
    ["Netflix", 213],
    ["Paramount+", 4330],
    ["CBS", 16],
    ["NBC", 6],
    ["Peacock", 3353],
    ["Disney+", 2739],
    ["Hulu", 453],
    ["AMC", 174],
    ["AMC+", 4661]
  ]);

  for (const [name, id] of expected) {
    assert.equal(seeds.get(name), id, name);
  }

  assert.equal(CORE_NETWORK_SEEDS.length, 14);
  assert.equal(TMDB_SYNC_BUDGET.networkDiscoveryRequests, 6);
  assert.equal(TMDB_SYNC_BUDGET.detailRequests, 40);
  assert.equal(TMDB_SYNC_BUDGET.totalExternalRequests, 48);
  assert.ok(TMDB_SYNC_BUDGET.totalExternalRequests <= 50);
});

test("rotating network discovery reaches every dedicated seed within three sync slots", () => {
  const slots = [0, 6, 12].map((hour) =>
    selectNetworkSeedsForSync(
      CORE_NETWORK_SEEDS,
      TMDB_SYNC_BUDGET.networkDiscoveryRequests,
      new Date(`2026-08-24T${String(hour).padStart(2, "0")}:00:00Z`)
    )
  );

  for (const slot of slots) {
    assert.equal(slot.length, 6);
  }

  const covered = new Set(slots.flat().map((seed) => seed.name));
  for (const seed of CORE_NETWORK_SEEDS) {
    assert.ok(covered.has(seed.name), seed.name);
  }
});

test("network discovery rotation is deterministic and wraps without duplicates inside one slot", () => {
  const first = selectNetworkSeedsForSync(CORE_NETWORK_SEEDS, 6, NOW);
  const second = selectNetworkSeedsForSync(CORE_NETWORK_SEEDS, 6, NOW);

  assert.deepEqual(first, second);
  assert.equal(new Set(first.map((seed) => seed.name)).size, first.length);
});

test("Phase 7A.1 rotates each network through TMDB pages one to three without adding requests", () => {
  const seed = CORE_NETWORK_SEEDS.find((item) => item.name === "Paramount+");
  assert.ok(seed);

  const pages = [0, 6, 12].map((hours) =>
    networkDiscoveryPage(seed, new Date(NOW.getTime() + hours * 60 * 60 * 1000))
  );

  assert.deepEqual([...new Set(pages)].sort((a, b) => a - b), [1, 2, 3]);
  assert.equal(TMDB_SYNC_BUDGET.networkDiscoveryRequests, 6);
  assert.equal(TMDB_SYNC_BUDGET.totalExternalRequests, 48);
});

test("Phase 7A.1 active seed rotation covers every dedicated network on all three pages within 21 slots", () => {
  const coverage = new Map(CORE_NETWORK_SEEDS.map((seed) => [seed.name, new Set()]));

  for (let slot = 0; slot < 21; slot += 1) {
    const now = new Date(NOW.getTime() + slot * 6 * 60 * 60 * 1000);
    const active = selectNetworkSeedsForSync(
      CORE_NETWORK_SEEDS,
      TMDB_SYNC_BUDGET.networkDiscoveryRequests,
      now
    );

    for (const seed of active) {
      coverage.get(seed.name).add(networkDiscoveryPage(seed, now));
    }
  }

  for (const seed of CORE_NETWORK_SEEDS) {
    assert.deepEqual([...coverage.get(seed.name)].sort((a, b) => a - b), [1, 2, 3], seed.name);
  }
});

test("FOX discovery uses a rolling three-year first-air window without changing request count", () => {
  const fox = CORE_NETWORK_SEEDS.find((seed) => seed.name === "FOX");
  assert.ok(fox);
  assert.equal(fox.recentFirstAirYears, 3);
  assert.deepEqual(networkDiscoveryParams(fox, NOW), {
    with_networks: 19,
    "first_air_date.gte": "2023-01-01"
  });
  assert.equal(TMDB_SYNC_BUDGET.networkDiscoveryRequests, 6);
  assert.equal(TMDB_SYNC_BUDGET.totalExternalRequests, 48);
});

test("Phase 7D recent-window discovery prioritizes current streamer and cable catalogs", () => {
  const expectedYears = new Map([
    ["FOX", 3],
    ["Paramount+", 8],
    ["Peacock", 8],
    ["Disney+", 8],
    ["Hulu", 10],
    ["AMC", 8],
    ["AMC+", 8]
  ]);

  for (const [name, years] of expectedYears) {
    const seed = CORE_NETWORK_SEEDS.find((item) => item.name === name);
    assert.equal(seed?.recentFirstAirYears, years, name);
    assert.equal(
      networkDiscoveryParams(seed, NOW)["first_air_date.gte"],
      `${NOW.getUTCFullYear() - years}-01-01`,
      name
    );
  }

  assert.equal(TMDB_SYNC_BUDGET.networkDiscoveryRequests, 6);
  assert.equal(TMDB_SYNC_BUDGET.totalExternalRequests, 48);
});

test("legacy network discovery stays unbounded so long-running active series are not excluded", () => {
  for (const name of ["Apple TV", "HBO", "Prime Video", "FX", "Netflix", "CBS", "NBC"]) {
    const seed = CORE_NETWORK_SEEDS.find((item) => item.name === name);
    assert.deepEqual(networkDiscoveryParams(seed, NOW), { with_networks: seed.tmdbNetworkId }, name);
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


test("Phase 7D gives each network page a fresh top-five slice at the rollout boundary", () => {
  const start = new Date("2026-09-09T00:00:00Z");
  const next = new Date("2026-09-09T06:00:00Z");
  const cases = [
    ["Paramount+", start, 1],
    ["Peacock", start, 2],
    ["Hulu", next, 1],
    ["AMC", next, 1]
  ];

  for (const [name, now, expectedPage] of cases) {
    const seed = CORE_NETWORK_SEEDS.find((item) => item.name === name);
    assert.equal(networkDiscoveryPage(seed, now), expectedPage, name);
    assert.equal(networkCandidateRotationOffset(seed, expectedPage, 20, 5, now), 0, name);
  }
  assert.equal(TMDB_SYNC_BUDGET.totalExternalRequests, 48);
});

test("Phase 7D rotates a repeated network page through all four five-item slices", () => {
  const seed = CORE_NETWORK_SEEDS.find((item) => item.name === "Hulu");
  const epoch = new Date("2026-09-09T00:00:00Z");
  const offsets = [];

  for (let slot = 0; slot < 80 && offsets.length < 4; slot += 1) {
    const now = new Date(epoch.getTime() + slot * 6 * 60 * 60 * 1000);
    const active = selectNetworkSeedsForSync(
      CORE_NETWORK_SEEDS,
      TMDB_SYNC_BUDGET.networkDiscoveryRequests,
      now
    );
    if (!active.some((item) => item.name === "Hulu")) continue;
    const page = networkDiscoveryPage(seed, now);
    if (page !== 1) continue;
    offsets.push(networkCandidateRotationOffset(seed, page, 20, 5, now));
  }

  assert.deepEqual(offsets, [0, 5, 10, 15]);
});

test("round-robin candidate selection accepts independent offsets per feed", () => {
  const feeds = [
    [{ id: 1 }, { id: 2 }, { id: 3 }],
    [{ id: 10 }, { id: 11 }, { id: 12 }]
  ];

  assert.deepEqual(
    selectRoundRobinCandidates(feeds, 4, [2, 1]).map((item) => item.id),
    [3, 11, 1, 12]
  );
});
