import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  KOREA_DISCOVERY_ACTIVE_STATUS_FILTER,
  KOREA_DISCOVERY_CANDIDATE_POOL_LIMIT,
  KOREA_DISCOVERY_PAGE_COUNT,
  KOREA_FICTION_GENRE_IDS,
  KOREA_SCHEDULE_GAP_PRIORITY_LIMIT,
  KOREA_SCHEDULE_LOOKAHEAD_DAYS,
  KOREA_TMDB_SYNC_BUDGET,
  koreanBroadDiscoveryParams,
  koreanDiscoveryPage,
  koreanNetworkDiscoveryParams,
  koreanScheduleDiscoveryParams,
  prioritizeKoreanCoverageCandidates
} from "../src/tmdb-korea.js";

test("Phase 10E keeps the Korean request ceiling while reserving only four gap slots", () => {
  assert.equal(KOREA_TMDB_SYNC_BUDGET.totalExternalRequests, 24);
  assert.equal(KOREA_TMDB_SYNC_BUDGET.detailRequests, 18);
  assert.equal(KOREA_SCHEDULE_GAP_PRIORITY_LIMIT, 4);
  assert.equal(KOREA_DISCOVERY_CANDIDATE_POOL_LIMIT, 60);
  assert.equal(KOREA_SCHEDULE_LOOKAHEAD_DAYS, 180);
  assert.equal(KOREA_DISCOVERY_PAGE_COUNT, 3);
});

test("Phase 10E rotates broad and schedule discovery across three pages", () => {
  const slots = [
    new Date("2026-09-15T00:00:00Z"),
    new Date("2026-09-15T06:00:00Z"),
    new Date("2026-09-15T12:00:00Z")
  ];
  const broad = slots.map((now) => koreanDiscoveryPage("broad", now));
  const schedule = slots.map((now) => koreanDiscoveryPage("schedule", now));
  assert.equal(new Set(broad).size, 3);
  assert.equal(new Set(schedule).size, 3);
  assert.ok(broad.every((page) => page >= 1 && page <= 3));
  assert.ok(schedule.every((page) => page >= 1 && page <= 3));
  assert.ok(broad.every((page, index) => page !== schedule[index]));
});

test("Phase 10E discovery filters mirror accepted quality policy without hiding future-dated stale statuses", () => {
  const now = new Date("2026-09-15T00:00:00Z");
  const broad = koreanBroadDiscoveryParams(now);
  const network = koreanNetworkDiscoveryParams({ tmdbNetworkId: 342, recentFirstAirYears: 6 }, now);
  const schedule = koreanScheduleDiscoveryParams(now);
  const expectedFuture = new Date(now.getTime());
  expectedFuture.setUTCDate(expectedFuture.getUTCDate() + KOREA_SCHEDULE_LOOKAHEAD_DAYS);

  assert.equal(KOREA_DISCOVERY_ACTIVE_STATUS_FILTER, "0|1|2|5");
  assert.equal(broad.with_status, KOREA_DISCOVERY_ACTIVE_STATUS_FILTER);
  assert.equal(network.with_status, KOREA_DISCOVERY_ACTIVE_STATUS_FILTER);
  assert.equal(network.with_networks, 342);
  assert.equal(schedule["air_date.gte"], "2026-09-15");
  assert.equal(schedule["air_date.lte"], expectedFuture.toISOString().slice(0, 10));
  assert.equal("with_status" in schedule, false);
  assert.deepEqual(KOREA_FICTION_GENRE_IDS, [18, 35, 37, 80, 9648, 10751, 10759, 10765, 10766, 10768]);
});

test("Phase 10E selects schedule gaps first, then new discoveries, then existing refreshes", () => {
  const result = prioritizeKoreanCoverageCandidates(
    [
      { id: 101, scheduleGapPriority: true },
      { id: 103, scheduleGapPriority: true }
    ],
    [
      { id: 101 },
      { id: 201 },
      { id: 202 },
      { id: 102 },
      { id: 203 }
    ],
    new Set([101, 102, 103]),
    6
  );

  assert.deepEqual(result.newDiscoveryCandidates.map((item) => item.id), [201, 202, 203]);
  assert.deepEqual(result.existingDiscoveryCandidates.map((item) => item.id), [101, 102]);
  assert.deepEqual(result.selectedCandidates.map((item) => item.id), [101, 103, 201, 202, 203, 102]);
});

test("Phase 10E implementation expands in-memory coverage rather than network budget", () => {
  const source = fs.readFileSync(new URL("../src/tmdb-korea.js", import.meta.url), "utf8");
  assert.match(source, /with_genres: KOREA_FICTION_DISCOVER_GENRES/);
  assert.match(source, /selectRoundRobinCandidates\(\s*candidateFeeds,\s*KOREA_DISCOVERY_CANDIDATE_POOL_LIMIT,/s);
  assert.match(source, /externalRequestBudget: candidateFeeds\.length \+ selectedCandidates\.length/);
  assert.match(source, /coveragePolicy: "bounded_gap_then_new_candidate_priority"/);
});
