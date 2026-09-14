import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  KOREA_TMDB_SYNC_BUDGET,
  mergePriorityCandidates,
  selectKoreanScheduleGapCandidates
} from "../src/tmdb-korea.js";

function fakeGapDb(results) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const call = { sql, binds: [] };
      calls.push(call);
      return {
        bind(...values) {
          call.binds = values;
          return this;
        },
        async all() {
          return { results };
        }
      };
    }
  };
}

test("Phase 10B.1 selects active KR rows without future TVmaze schedule inside detail budget", async () => {
  const db = fakeGapDb([
    { id: 243761 },
    { id: "293610" },
    { id: null },
    { id: 0 }
  ]);

  const selected = await selectKoreanScheduleGapCandidates(
    db,
    99,
    new Date("2026-09-14T00:00:00Z")
  );

  assert.deepEqual(selected, [
    { id: 243761, scheduleGapPriority: true },
    { id: 293610, scheduleGapPriority: true }
  ]);

  assert.equal(db.calls.length, 1);
  assert.deepEqual(db.calls[0].binds, [
    "2026-09-14",
    KOREA_TMDB_SYNC_BUDGET.detailRequests
  ]);
  assert.match(db.calls[0].sql, /origin_country.*KR/s);
  assert.match(db.calls[0].sql, /status IN \('airing', 'upcoming', 'planned'\)/);
  assert.match(db.calls[0].sql, /e\.tvmaze_id IS NOT NULL/);
  assert.match(db.calls[0].sql, /e\.air_date >= \?1/);
  assert.match(db.calls[0].sql, /LIMIT \?2/);
});

test("Phase 10B.1 priority candidates lead while duplicate discovery candidates are removed", () => {
  const selected = mergePriorityCandidates(
    [
      { id: 243761, scheduleGapPriority: true },
      { id: 293610, scheduleGapPriority: true }
    ],
    [
      { id: 293610, name: "duplicate" },
      { id: 111111 },
      { id: 222222 }
    ],
    3
  );

  assert.deepEqual(selected.map((item) => item.id), [243761, 293610, 111111]);
  assert.equal(selected.length, 3);
});

test("Phase 10B.1 never expands the Korean external request ceiling", () => {
  const source = fs.readFileSync(new URL("../src/tmdb-korea.js", import.meta.url), "utf8");

  assert.equal(KOREA_TMDB_SYNC_BUDGET.totalExternalRequests, 24);
  assert.equal(KOREA_TMDB_SYNC_BUDGET.detailRequests, 18);
  assert.match(source, /selectKoreanScheduleGapCandidates\(env\.DB, detailLimit, now\)/);
  assert.match(source, /mergePriorityCandidates\(\s*scheduleGapCandidates,\s*discoveredCandidates,\s*detailLimit\s*\)/s);
  assert.match(source, /externalRequestBudget: candidateFeeds\.length \+ selectedCandidates\.length/);
  assert.match(source, /scheduleGapCandidates: scheduleGapCandidates\.length/);
});
