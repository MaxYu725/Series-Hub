const fs = require('fs');

const sourcePath = 'src/tmdb.js';
let source = fs.readFileSync(sourcePath, 'utf8');

function replaceOnce(haystack, needle, replacement, label) {
  const first = haystack.indexOf(needle);
  if (first < 0) throw new Error(`Missing anchor: ${label}`);
  if (haystack.indexOf(needle, first + needle.length) >= 0) throw new Error(`Anchor not unique: ${label}`);
  return haystack.slice(0, first) + replacement + haystack.slice(first + needle.length);
}

source = replaceOnce(
  source,
  'const NETWORK_DISCOVERY_PAGE_COUNT = 3;\n',
  'const NETWORK_DISCOVERY_PAGE_COUNT = 3;\n' +
  'export const US_DISCOVERY_PAGE_COUNT = 3;\n' +
  'export const US_SCHEDULE_LOOKAHEAD_DAYS = 180;\n' +
  'export const US_DISCOVERY_CANDIDATE_POOL_LIMIT = 120;\n' +
  'export const US_NEW_CANDIDATE_PRIORITY_LIMIT = 32;\n' +
  'export const US_SCHEDULE_NEW_PRIORITY_LIMIT = 12;\n' +
  'export const US_NETWORK_NEW_PRIORITY_LIMIT = 16;\n' +
  'export const US_BROAD_NEW_PRIORITY_LIMIT = 4;\n' +
  'export const US_DISCOVERY_ACTIVE_STATUS_FILTER = "0|1|2|5";\n',
  'US coverage constants'
);

const networkParamsAnchor = `export function networkDiscoveryParams(seed, now = new Date()) {
  const params = { with_networks: seed.tmdbNetworkId };
  const recentFirstAirYears = Number(seed.recentFirstAirYears);

  if (Number.isInteger(recentFirstAirYears) && recentFirstAirYears > 0) {
    params["first_air_date.gte"] = \`${'${now.getUTCFullYear() - recentFirstAirYears}'}-01-01\`;
  }

  return params;
}
`;
const networkParamsReplacement = networkParamsAnchor + `
export function usDiscoveryPage(kind = "broad", now = new Date()) {
  const timestamp = now instanceof Date && Number.isFinite(now.getTime())
    ? now.getTime()
    : Date.now();
  const sixHourSlot = Math.floor(timestamp / (6 * 60 * 60 * 1000));
  const offset = kind === "schedule" ? 1 : 0;
  return 1 + ((sixHourSlot + offset) % US_DISCOVERY_PAGE_COUNT);
}

export function usBroadDiscoveryParams() {
  return { with_status: US_DISCOVERY_ACTIVE_STATUS_FILTER };
}

export function usScheduleDiscoveryParams(now = new Date()) {
  return {
    "air_date.gte": todayUtc(now),
    "air_date.lte": daysAheadDate(US_SCHEDULE_LOOKAHEAD_DAYS, now)
  };
}

export function usNetworkDiscoveryParams(seed, now = new Date()) {
  return {
    ...networkDiscoveryParams(seed, now),
    with_status: US_DISCOVERY_ACTIVE_STATUS_FILTER
  };
}
`;
source = replaceOnce(source, networkParamsAnchor, networkParamsReplacement, 'US discovery helpers');

const selectionInsertAnchor = `  return selected;
}

export async function syncTmdbCatalog(env, options = {}) {`;
const selectionHelpers = `  return selected;
}

export async function loadExistingActiveUsTmdbIds(db) {
  const result = await db
    .prepare(
      \`SELECT tmdb_id
       FROM shows
       WHERE tmdb_id IS NOT NULL
         AND (',' || COALESCE(origin_country, '') || ',') LIKE '%,US,%'
         AND status IN ('airing', 'upcoming', 'planned')\`
    )
    .all();

  return new Set(
    (result.results || [])
      .map((row) => Number(row.tmdb_id))
      .filter((id) => Number.isInteger(id) && id > 0)
  );
}

export function prioritizeUsCoverageCandidates(
  networkCandidates,
  scheduleCandidates,
  broadCandidates,
  existingTmdbIds,
  limit = TMDB_SYNC_BUDGET.detailRequests,
  newPriorityLimit = US_NEW_CANDIDATE_PRIORITY_LIMIT
) {
  const existing = existingTmdbIds instanceof Set
    ? existingTmdbIds
    : new Set(existingTmdbIds || []);
  const boundedLimit = Math.max(0, Math.trunc(Number(limit) || 0));
  const boundedNewLimit = Math.min(
    boundedLimit,
    Math.max(0, Math.trunc(Number(newPriorityLimit) || 0))
  );
  const buckets = [
    { name: "schedule", candidates: scheduleCandidates || [], quota: US_SCHEDULE_NEW_PRIORITY_LIMIT },
    { name: "network", candidates: networkCandidates || [], quota: US_NETWORK_NEW_PRIORITY_LIMIT },
    { name: "broad", candidates: broadCandidates || [], quota: US_BROAD_NEW_PRIORITY_LIMIT }
  ];
  const seen = new Set();
  const newBuckets = new Map(buckets.map((bucket) => [bucket.name, []]));
  const existingDiscoveryCandidates = [];

  for (const bucket of buckets) {
    for (const candidate of bucket.candidates) {
      const id = Number(candidate?.id);
      if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      if (existing.has(id)) existingDiscoveryCandidates.push(candidate);
      else newBuckets.get(bucket.name).push(candidate);
    }
  }

  const newDiscoveryCandidates = buckets.flatMap((bucket) => newBuckets.get(bucket.name));
  const selectedCandidates = [];
  const selectedIds = new Set();
  const pushCandidate = (candidate) => {
    const id = Number(candidate?.id);
    if (!Number.isInteger(id) || id <= 0 || selectedIds.has(id) || selectedCandidates.length >= boundedLimit) return false;
    selectedIds.add(id);
    selectedCandidates.push(candidate);
    return true;
  };

  let newSelected = 0;
  for (const bucket of buckets) {
    let bucketSelected = 0;
    for (const candidate of newBuckets.get(bucket.name)) {
      if (newSelected >= boundedNewLimit || bucketSelected >= bucket.quota) break;
      if (pushCandidate(candidate)) {
        newSelected += 1;
        bucketSelected += 1;
      }
    }
  }

  for (const candidate of newDiscoveryCandidates) {
    if (newSelected >= boundedNewLimit) break;
    if (pushCandidate(candidate)) newSelected += 1;
  }

  for (const candidate of existingDiscoveryCandidates) pushCandidate(candidate);
  for (const candidate of newDiscoveryCandidates) pushCandidate(candidate);

  return {
    selectedCandidates,
    newDiscoveryCandidates,
    existingDiscoveryCandidates,
    newCandidatesSelected: selectedCandidates.filter((candidate) => !existing.has(Number(candidate.id))).length,
    existingCandidatesSelected: selectedCandidates.filter((candidate) => existing.has(Number(candidate.id))).length
  };
}

export async function syncTmdbCatalog(env, options = {}) {`;
source = replaceOnce(source, selectionInsertAnchor, selectionHelpers, 'US priority selection helpers');

source = replaceOnce(
  source,
  `  const broadPages = Math.min(Math.max(Number(options.pages) || 1, 1), 1);
  const schedulePages = Math.min(Math.max(Number(options.schedulePages) || 1, 1), 1);
  const detailLimit = Math.min(`,
  `  const detailLimit = Math.min(`,
  'remove fixed page-one option clamps'
);

source = replaceOnce(
  source,
  `  try {
    const now = new Date();
    const activeNetworkSeeds = selectNetworkSeedsForSync(`,
  `  try {
    const now = options.now instanceof Date && Number.isFinite(options.now.getTime())
      ? options.now
      : new Date();
    const activeNetworkSeeds = selectNetworkSeedsForSync(`,
  'deterministic US sync clock'
);

source = replaceOnce(
  source,
  '      const networkResult = await discoverCandidates(env, page, networkDiscoveryParams(seed, now));',
  '      const networkResult = await discoverCandidates(env, page, usNetworkDiscoveryParams(seed, now));',
  'active-status network discovery'
);

source = replaceOnce(
  source,
  `    const scheduleFeeds = [];
    for (let page = 1; page <= schedulePages; page += 1) {
      const scheduled = await discoverCandidates(env, page, {
        "air_date.gte": todayUtc(now),
        "air_date.lte": daysAheadDate(90, now)
      });
      scheduleFeeds.push(scheduled.results || []);
    }

    const broadFeeds = [];
    for (let page = 1; page <= broadPages; page += 1) {
      const discovered = await discoverCandidates(env, page);
      broadFeeds.push(discovered.results || []);
    }
`,
  `    const schedulePage = usDiscoveryPage("schedule", now);
    const scheduled = await discoverCandidates(env, schedulePage, usScheduleDiscoveryParams(now));
    const scheduleFeeds = [scheduled.results || []];

    const broadPage = usDiscoveryPage("broad", now);
    const discovered = await discoverCandidates(env, broadPage, usBroadDiscoveryParams(now));
    const broadFeeds = [discovered.results || []];
`,
  'rotating broad and schedule discovery'
);

source = replaceOnce(
  source,
  `    const candidateOffsets = [
      ...networkCandidateOffsets,
      ...scheduleFeeds.map(() => candidateOffset),
      ...broadFeeds.map(() => candidateOffset)
    ];
    const selectedCandidates = selectRoundRobinCandidates(
      candidateFeeds,
      detailLimit,
      candidateOffsets
    );
    const detailsResults = await fetchDetailsInBatches(env, selectedCandidates);
`,
  `    const networkCandidatePoolLimit = Math.max(0, US_DISCOVERY_CANDIDATE_POOL_LIMIT - 40);
    const networkCandidatePool = selectRoundRobinCandidates(
      networkFeeds,
      networkCandidatePoolLimit,
      networkCandidateOffsets
    );
    const scheduleCandidatePool = selectRoundRobinCandidates(
      scheduleFeeds,
      20,
      [candidateOffset]
    );
    const broadCandidatePool = selectRoundRobinCandidates(
      broadFeeds,
      20,
      [candidateOffset]
    );
    const discoveredCandidatePool = uniqueCandidateCount([
      networkCandidatePool,
      scheduleCandidatePool,
      broadCandidatePool
    ]);
    const existingActiveUsTmdbIds = await loadExistingActiveUsTmdbIds(env.DB);
    const coverageSelection = prioritizeUsCoverageCandidates(
      networkCandidatePool,
      scheduleCandidatePool,
      broadCandidatePool,
      existingActiveUsTmdbIds,
      detailLimit
    );
    const {
      selectedCandidates,
      newDiscoveryCandidates,
      existingDiscoveryCandidates,
      newCandidatesSelected,
      existingCandidatesSelected
    } = coverageSelection;
    const detailsResults = await fetchDetailsInBatches(env, selectedCandidates);
`,
  'new-candidate priority selection'
);

source = replaceOnce(
  source,
  '      const normalized = normalizeTmdbSeries(details);',
  '      const normalized = normalizeTmdbSeries(details, now);',
  'normalize against sync clock'
);

source = replaceOnce(
  source,
  `      recordsSelected: selectedCandidates.length,
      candidateOffset,
      recordsChanged,`,
  `      recordsSelected: selectedCandidates.length,
      candidateOffset,
      discoveredCandidatePool,
      newDiscoveryCandidates: newDiscoveryCandidates.length,
      existingDiscoveryCandidates: existingDiscoveryCandidates.length,
      newCandidatesSelected,
      existingCandidatesSelected,
      newCandidatePriorityLimit: US_NEW_CANDIDATE_PRIORITY_LIMIT,
      broadPage,
      schedulePage,
      scheduleLookaheadDays: US_SCHEDULE_LOOKAHEAD_DAYS,
      coveragePolicy: "bounded_new_candidate_priority_with_refresh_reserve",
      recordsChanged,`,
  'US coverage metrics'
);

fs.writeFileSync(sourcePath, source);

const test = `import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  TMDB_SYNC_BUDGET,
  US_BROAD_NEW_PRIORITY_LIMIT,
  US_DISCOVERY_ACTIVE_STATUS_FILTER,
  US_DISCOVERY_CANDIDATE_POOL_LIMIT,
  US_DISCOVERY_PAGE_COUNT,
  US_NETWORK_NEW_PRIORITY_LIMIT,
  US_NEW_CANDIDATE_PRIORITY_LIMIT,
  US_SCHEDULE_LOOKAHEAD_DAYS,
  US_SCHEDULE_NEW_PRIORITY_LIMIT,
  prioritizeUsCoverageCandidates,
  usBroadDiscoveryParams,
  usDiscoveryPage,
  usNetworkDiscoveryParams,
  usScheduleDiscoveryParams
} from "../src/tmdb.js";

const NOW = new Date("2026-09-15T00:00:00Z");

test("US coverage hardening keeps the accepted 48-request ceiling", () => {
  assert.equal(TMDB_SYNC_BUDGET.totalExternalRequests, 48);
  assert.equal(TMDB_SYNC_BUDGET.detailRequests, 40);
  assert.equal(US_DISCOVERY_CANDIDATE_POOL_LIMIT, 120);
  assert.equal(US_NEW_CANDIDATE_PRIORITY_LIMIT, 32);
  assert.equal(US_SCHEDULE_NEW_PRIORITY_LIMIT, 12);
  assert.equal(US_NETWORK_NEW_PRIORITY_LIMIT, 16);
  assert.equal(US_BROAD_NEW_PRIORITY_LIMIT, 4);
});

test("US broad and schedule discovery rotate across three pages without adding requests", () => {
  const slots = [0, 6, 12].map((hours) => new Date(NOW.getTime() + hours * 60 * 60 * 1000));
  const broad = slots.map((now) => usDiscoveryPage("broad", now));
  const schedule = slots.map((now) => usDiscoveryPage("schedule", now));
  assert.deepEqual([...new Set(broad)].sort((a, b) => a - b), [1, 2, 3]);
  assert.deepEqual([...new Set(schedule)].sort((a, b) => a - b), [1, 2, 3]);
  assert.ok(broad.every((page, index) => page !== schedule[index]));
  assert.equal(US_DISCOVERY_PAGE_COUNT, 3);
});

test("US discovery filters terminal noise but schedule discovery preserves future-date rescue", () => {
  assert.equal(US_DISCOVERY_ACTIVE_STATUS_FILTER, "0|1|2|5");
  assert.deepEqual(usBroadDiscoveryParams(), { with_status: "0|1|2|5" });
  assert.deepEqual(usNetworkDiscoveryParams({ tmdbNetworkId: 16 }, NOW), {
    with_networks: 16,
    with_status: "0|1|2|5"
  });
  const schedule = usScheduleDiscoveryParams(NOW);
  assert.equal(schedule["air_date.gte"], "2026-09-15");
  assert.equal(schedule["air_date.lte"], "2027-03-14");
  assert.equal("with_status" in schedule, false);
  assert.equal(US_SCHEDULE_LOOKAHEAD_DAYS, 180);
});

test("US coverage prioritizes unseen schedule/network/broad candidates while reserving refresh capacity", () => {
  const result = prioritizeUsCoverageCandidates(
    [{ id: 201 }, { id: 101 }, { id: 202 }],
    [{ id: 301 }, { id: 102 }, { id: 302 }],
    [{ id: 401 }, { id: 103 }],
    new Set([101, 102, 103]),
    6,
    4
  );

  assert.deepEqual(result.selectedCandidates.map((item) => item.id), [301, 302, 201, 202, 102, 101]);
  assert.equal(result.newCandidatesSelected, 4);
  assert.equal(result.existingCandidatesSelected, 2);
  assert.equal(result.newDiscoveryCandidates.length, 5);
  assert.equal(result.existingDiscoveryCandidates.length, 3);
});

test("US hardening expands in-memory coverage rather than the network budget", () => {
  const source = fs.readFileSync(new URL("../src/tmdb.js", import.meta.url), "utf8");
  assert.match(source, /networkCandidatePoolLimit = Math\.max\(0, US_DISCOVERY_CANDIDATE_POOL_LIMIT - 40\)/);
  assert.match(source, /externalRequestBudget: candidateFeeds\.length \+ selectedCandidates\.length/);
  assert.match(source, /coveragePolicy: "bounded_new_candidate_priority_with_refresh_reserve"/);
  assert.match(source, /scheduleLookaheadDays: US_SCHEDULE_LOOKAHEAD_DAYS/);
});
`;
fs.writeFileSync('test/us-coverage-hardening.test.js', test);

const doc = `# US Coverage Hardening\n\nStatus: implementation candidate after the 2026-09-15 read-only production audit.\n\n## Baseline\n\nThe production US catalog contained 150 active rows: 21 airing, 39 upcoming and 90 planned. A read-only audit sampled 719 TMDB discovery candidates and detail-audited the 120 highest-priority candidates not already active in production. Three rows already passed the existing US admission policy but were absent from D1: High Potential (ABC), Tracker (CBS) and Naughty Business (Prime Video). High Potential and Tracker were visible on future-schedule page 2 while the production broad/schedule discovery path was fixed to page 1.\n\n## Policy\n\nThis hardening does not relax the accepted US scripted/network admission gate and does not increase the TMDB request ceiling. Each run remains bounded to 6 dedicated network discovery requests, 1 future-schedule discovery request, 1 broad discovery request and at most 40 detail requests: 48 external requests total.\n\nThe change improves selection efficiency by rotating broad and schedule discovery across pages 1-3, expanding the schedule look-ahead from 90 to 180 days, filtering terminal statuses from broad/network discovery, building a bounded 120-candidate in-memory pool, and prioritizing at most 32 unseen candidates while preserving refresh capacity for existing active shows. Future-date schedule discovery deliberately remains unfiltered by TMDB status so stale terminal metadata cannot hide a real future episode date.\n\nNo provider, schema, migration, market selector or US admission rule changes are included.\n`;
fs.writeFileSync('docs/US_COVERAGE_HARDENING.md', doc);

console.log('US coverage hardening patch applied');
