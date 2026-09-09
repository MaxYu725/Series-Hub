from pathlib import Path


def require_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing patch anchor: {label}")
    return text.replace(old, new, 1)


tmdb_path = Path("src/tmdb.js")
text = tmdb_path.read_text()

text = require_replace(
    text,
    'const NETWORK_DISCOVERY_PAGE_COUNT = 3;\n',
    'const NETWORK_DISCOVERY_PAGE_COUNT = 3;\nconst NETWORK_CANDIDATE_ROTATION_EPOCH = Date.parse("2026-09-09T00:00:00.000Z");\n',
    "rotation epoch",
)

seed_replacements = {
    '  { name: "Paramount+", tmdbNetworkId: 4330 },': '  { name: "Paramount+", tmdbNetworkId: 4330, recentFirstAirYears: 8 },',
    '  { name: "Peacock", tmdbNetworkId: 3353 },': '  { name: "Peacock", tmdbNetworkId: 3353, recentFirstAirYears: 8 },',
    '  { name: "Disney+", tmdbNetworkId: 2739 },': '  { name: "Disney+", tmdbNetworkId: 2739, recentFirstAirYears: 8 },',
    '  { name: "Hulu", tmdbNetworkId: 453 },': '  { name: "Hulu", tmdbNetworkId: 453, recentFirstAirYears: 10 },',
    '  { name: "AMC", tmdbNetworkId: 174 },': '  { name: "AMC", tmdbNetworkId: 174, recentFirstAirYears: 8 },',
    '  { name: "AMC+", tmdbNetworkId: 4661 }': '  { name: "AMC+", tmdbNetworkId: 4661, recentFirstAirYears: 8 }',
}
for old, new in seed_replacements.items():
    text = require_replace(text, old, new, old)

helper = '''function positiveGcd(left, right) {
  let a = Math.abs(Math.trunc(Number(left) || 0));
  let b = Math.abs(Math.trunc(Number(right) || 0));
  while (b) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a || 1;
}

function leastCommonMultiple(left, right) {
  const a = Math.max(1, Math.abs(Math.trunc(Number(left) || 1)));
  const b = Math.max(1, Math.abs(Math.trunc(Number(right) || 1)));
  return Math.abs((a / positiveGcd(a, b)) * b);
}

function seedSelectedAtSlot(seedIndex, slot, seedCount, limit) {
  if (seedIndex < 0 || seedCount <= 0 || limit <= 0) return false;
  const start = ((slot * limit) % seedCount + seedCount) % seedCount;
  for (let index = 0; index < limit; index += 1) {
    if ((start + index) % seedCount === seedIndex) return true;
  }
  return false;
}

function networkPageAtSlot(seed, slot) {
  const networkOffset = Math.abs(Math.trunc(Number(seed?.tmdbNetworkId) || 0)) % NETWORK_DISCOVERY_PAGE_COUNT;
  return 1 + (((slot + networkOffset) % NETWORK_DISCOVERY_PAGE_COUNT + NETWORK_DISCOVERY_PAGE_COUNT) % NETWORK_DISCOVERY_PAGE_COUNT);
}

export function networkCandidateRotationOffset(
  seed,
  page,
  feedLength,
  stride,
  now = new Date(),
  seeds = CORE_NETWORK_SEEDS,
  limit = TMDB_SYNC_BUDGET.networkDiscoveryRequests
) {
  const source = Array.isArray(seeds) ? seeds.filter(Boolean) : [];
  const safeLimit = Math.min(source.length, Math.max(0, Math.trunc(Number(limit) || 0)));
  const safeLength = Math.max(0, Math.trunc(Number(feedLength) || 0));
  const safeStride = Math.max(1, Math.trunc(Number(stride) || 1));
  const rotationSlots = Math.max(1, Math.ceil(safeLength / safeStride));
  if (source.length === 0 || safeLimit === 0 || rotationSlots <= 1) return 0;

  const seedIndex = source.findIndex(
    (item) => Number(item?.tmdbNetworkId) === Number(seed?.tmdbNetworkId)
  );
  if (seedIndex < 0) return 0;

  const timestamp = now instanceof Date && Number.isFinite(now.getTime())
    ? now.getTime()
    : Date.now();
  const currentSlot = Math.floor(timestamp / (6 * 60 * 60 * 1000));
  const epochSlot = Math.floor(NETWORK_CANDIDATE_ROTATION_EPOCH / (6 * 60 * 60 * 1000));
  if (currentSlot <= epochSlot) return 0;

  const requestedPage = Number.isInteger(Number(page))
    ? Math.min(NETWORK_DISCOVERY_PAGE_COUNT, Math.max(1, Number(page)))
    : networkPageAtSlot(seed, currentSlot);
  const selectionPeriod = Math.max(1, source.length / positiveGcd(source.length, safeLimit));
  const combinedPeriod = leastCommonMultiple(selectionPeriod, NETWORK_DISCOVERY_PAGE_COUNT);
  const matchesAtSlot = (slot) =>
    seedSelectedAtSlot(seedIndex, slot, source.length, safeLimit) &&
    networkPageAtSlot(seed, slot) === requestedPage;

  let matchesPerCycle = 0;
  for (let index = 0; index < combinedPeriod; index += 1) {
    if (matchesAtSlot(epochSlot + index)) matchesPerCycle += 1;
  }

  const elapsedSlots = currentSlot - epochSlot;
  const fullCycles = Math.floor(elapsedSlots / combinedPeriod);
  const remainderSlots = elapsedSlots % combinedPeriod;
  let visitsBefore = fullCycles * matchesPerCycle;
  for (let index = 0; index < remainderSlots; index += 1) {
    if (matchesAtSlot(epochSlot + index)) visitsBefore += 1;
  }

  return (visitsBefore % rotationSlots) * safeStride;
}

'''
text = require_replace(
    text,
    'export function tmdbImageUrl(path, size = "w500") {\n',
    helper + 'export function tmdbImageUrl(path, size = "w500") {\n',
    "network candidate helper insertion",
)

old_selection = '''export function selectRoundRobinCandidates(
  feeds,
  limit = TMDB_SYNC_BUDGET.detailRequests,
  offset = 0
) {
  const safeOffset = Math.max(0, Math.trunc(Number(offset) || 0));
  const sourceLists = (feeds || []).map((feed) => {
    if (!Array.isArray(feed) || feed.length === 0) return [];
    const start = safeOffset % feed.length;
    return start === 0 ? [...feed] : [...feed.slice(start), ...feed.slice(0, start)];
  });'''
new_selection = '''export function selectRoundRobinCandidates(
  feeds,
  limit = TMDB_SYNC_BUDGET.detailRequests,
  offset = 0
) {
  const offsetList = Array.isArray(offset) ? offset : null;
  const fallbackOffset = Math.max(0, Math.trunc(Number(offset) || 0));
  const sourceLists = (feeds || []).map((feed, sourceIndex) => {
    if (!Array.isArray(feed) || feed.length === 0) return [];
    const requestedOffset = offsetList && offsetList[sourceIndex] !== undefined
      ? offsetList[sourceIndex]
      : fallbackOffset;
    const safeOffset = Math.max(0, Math.trunc(Number(requestedOffset) || 0));
    const start = safeOffset % feed.length;
    return start === 0 ? [...feed] : [...feed.slice(start), ...feed.slice(0, start)];
  });'''
text = require_replace(text, old_selection, new_selection, "per-feed round robin offsets")

old_sync = '''    const candidateFeeds = [...networkFeeds, ...scheduleFeeds, ...broadFeeds];
    recordsSeen = uniqueCandidateCount(candidateFeeds);
    const candidateOffset = candidateRotationOffset(candidateFeeds, detailLimit, now);
    const selectedCandidates = selectRoundRobinCandidates(
      candidateFeeds,
      detailLimit,
      candidateOffset
    );'''
new_sync = '''    const candidateFeeds = [...networkFeeds, ...scheduleFeeds, ...broadFeeds];
    recordsSeen = uniqueCandidateCount(candidateFeeds);
    const candidateOffset = candidateRotationOffset(candidateFeeds, detailLimit, now);
    const activeFeedCount = Math.max(
      1,
      candidateFeeds.filter((feed) => Array.isArray(feed) && feed.length > 0).length
    );
    const candidateStride = Math.max(1, Math.floor(detailLimit / activeFeedCount));
    const networkCandidateOffsets = networkFeeds.map((feed, index) =>
      networkCandidateRotationOffset(
        networkDiscoveries[index].seed,
        networkDiscoveries[index].page,
        feed.length,
        candidateStride,
        now
      )
    );
    const candidateOffsets = [
      ...networkCandidateOffsets,
      ...scheduleFeeds.map(() => candidateOffset),
      ...broadFeeds.map(() => candidateOffset)
    ];
    const selectedCandidates = selectRoundRobinCandidates(
      candidateFeeds,
      detailLimit,
      candidateOffsets
    );'''
text = require_replace(text, old_sync, new_sync, "network-specific candidate offsets")

old_return = '''      networkPages: networkDiscoveries.map(({ seed, page }) => ({ name: seed.name, page })),
      externalRequestBudget: candidateFeeds.length + selectedCandidates.length,'''
new_return = '''      networkPages: networkDiscoveries.map(({ seed, page }) => ({ name: seed.name, page })),
      networkCandidateOffsets: networkDiscoveries.map(({ seed, page }, index) => ({
        name: seed.name,
        page,
        offset: networkCandidateOffsets[index]
      })),
      externalRequestBudget: candidateFeeds.length + selectedCandidates.length,'''
text = require_replace(text, old_return, new_return, "sync offset observability")
tmdb_path.write_text(text)


test_path = Path("test/phase1b-policy.test.js")
tests = test_path.read_text()
tests = require_replace(
    tests,
    '  networkDiscoveryParams,\n  normalizeLifecycle,',
    '  networkDiscoveryParams,\n  networkCandidateRotationOffset,\n  normalizeLifecycle,',
    "test import",
)

old_test = '''test("non-FOX network discovery remains unchanged and unbounded by first-air date", () => {
  for (const seed of CORE_NETWORK_SEEDS.filter((item) => item.name !== "FOX")) {
    assert.deepEqual(networkDiscoveryParams(seed, NOW), { with_networks: seed.tmdbNetworkId }, seed.name);
  }
});'''
new_test = '''test("Phase 7D recent-window discovery prioritizes current streamer and cable catalogs", () => {
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
});'''
tests = require_replace(tests, old_test, new_test, "recent-window tests")

tests += '''\n\ntest("Phase 7D gives each network page a fresh top-five slice at the rollout boundary", () => {
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
});\n'''
test_path.write_text(tests)

Path("docs/PHASE7D_CATALOG_CONVERGENCE.md").write_text(
    """# Phase 7D — Catalog Convergence

Phase 7D repairs the remaining Phase 7A/7A.1 catalog blind spot without increasing the TMDB request budget or inserting synthetic show identities.

## Production diagnostic baseline

A read-only production probe on 2026-09-09 confirmed that `MobLand`, `The Five Star Weekend`, `The Bear` and `Dark Winds` were still absent from Series Hub. A separate TMDB probe then showed that bounded discovery could see them once stale historical inventory was reduced:

- `MobLand`: Paramount+ popularity rank 5 on page 1.
- `The Five Star Weekend`: Peacock popularity rank 23, page 2 position 3; recency rank 4 on page 1.
- `The Bear`: Hulu popularity rank 5 on page 1.
- `Dark Winds`: AMC popularity rank 3 on page 1.

The remaining delay came from correlation between the three-page network rotation and one global five-item candidate offset shared by all feeds. Some page/slice combinations could take roughly 10–15 days to meet.

## Phase 7D changes

1. Recent first-air windows are applied only where they improve current-catalog convergence without excluding credible long-running broadcast series: Paramount+ 8 years, Peacock 8, Disney+ 8, Hulu 10, AMC 8 and AMC+ 8. FOX keeps its existing 3-year repair.
2. Apple TV, HBO, Prime Video, FX, Netflix, CBS and NBC remain unbounded by first-air date.
3. Network candidate slices now rotate independently per network and per TMDB page from the Phase 7D rollout boundary. Each repeated 20-item page receives offsets 0, 5, 10 and 15 on successive visits rather than inheriting one globally correlated offset.
4. Schedule and broad discovery keep the existing global candidate rotation.
5. The request ceiling is unchanged: 6 network discovery + 1 schedule + 1 broad + at most 40 detail requests = 48 external requests.

No D1 migration is required. Existing identity, US-scripted, target-network and active-lifecycle gates remain authoritative.
"""
)

Path(".github/workflows/phase7d-tmdb-probe.yml").unlink(missing_ok=True)
Path(".github/workflows/phase7d-author.yml").unlink(missing_ok=True)
Path("tools/phase7d-author.py").unlink(missing_ok=True)
