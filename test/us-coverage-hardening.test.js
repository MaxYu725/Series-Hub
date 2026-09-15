import test from "node:test";
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
  assert.ok(source.includes("const networkCandidatePoolLimit = Math.max(0, US_DISCOVERY_CANDIDATE_POOL_LIMIT - 40);"));
  assert.ok(source.includes("externalRequestBudget: candidateFeeds.length + selectedCandidates.length"));
  assert.ok(source.includes('coveragePolicy: "bounded_new_candidate_priority_with_refresh_reserve"'));
  assert.ok(source.includes("scheduleLookaheadDays: US_SCHEDULE_LOOKAHEAD_DAYS"));
});
