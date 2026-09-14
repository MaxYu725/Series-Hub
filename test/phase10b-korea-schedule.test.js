import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  normalizeKoreanTmdbNextEpisode,
  syncKoreanTmdbNextEpisodeFallback
} from "../src/tmdb-korea-schedule.js";

function details(overrides = {}) {
  return {
    id: 243761,
    next_episode_to_air: {
      id: 777001,
      season_number: 2,
      episode_number: 1,
      name: "Episode 1",
      overview: "Season premiere",
      air_date: "2026-12-04",
      runtime: 60,
      still_path: "/next.jpg"
    },
    ...overrides
  };
}

function fakeDb({ tvmazeFuture = false, seasonId = 42, pruneChanges = 0, insertChanges = 1 } = {}) {
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
        async first() {
          if (sql.includes("e.tvmaze_id IS NOT NULL")) {
            return tvmazeFuture ? { id: 901 } : null;
          }
          if (sql.includes("SELECT id FROM seasons")) {
            return seasonId ? { id: seasonId } : null;
          }
          return null;
        },
        async run() {
          if (sql.startsWith("DELETE FROM episodes")) {
            return { meta: { changes: pruneChanges } };
          }
          if (sql.startsWith("INSERT INTO episodes")) {
            return { meta: { changes: insertChanges } };
          }
          return { meta: { changes: 0 } };
        }
      };
    }
  };
}

test("Phase 10B normalizes a future TMDB next episode without inventing schedule fields", () => {
  const now = new Date("2026-09-14T00:00:00Z");
  const normalized = normalizeKoreanTmdbNextEpisode(details(), now);

  assert.deepEqual(normalized, {
    tmdbId: 777001,
    seasonNumber: 2,
    episodeNumber: 1,
    name: "Episode 1",
    overview: "Season premiere",
    airDate: "2026-12-04",
    runtimeMinutes: 60,
    imageUrl: "https://image.tmdb.org/t/p/original/next.jpg",
    sourceUrl: "https://www.themoviedb.org/tv/243761/season/2/episode/1"
  });

  assert.equal(
    normalizeKoreanTmdbNextEpisode(
      details({ next_episode_to_air: { ...details().next_episode_to_air, air_date: "2026-09-13" } }),
      now
    ),
    null
  );
  assert.equal(normalizeKoreanTmdbNextEpisode({ id: 1 }, now), null);
  assert.equal(
    normalizeKoreanTmdbNextEpisode(
      details({ next_episode_to_air: { ...details().next_episode_to_air, runtime: null } }),
      now
    ).runtimeMinutes,
    null
  );
});

test("Phase 10B inserts one TMDB fallback only when no future TVmaze schedule exists", async () => {
  const db = fakeDb();
  const result = await syncKoreanTmdbNextEpisodeFallback(db, {
    showId: 3177,
    details: details(),
    now: new Date("2026-09-14T00:00:00Z")
  });

  assert.deepEqual(result, { applied: 1, pruned: 0, reason: "tmdb_next_episode" });

  const insert = db.calls.find((call) => call.sql.startsWith("INSERT INTO episodes"));
  assert.ok(insert, "TMDB fallback episode should be persisted");
  assert.deepEqual(insert.binds, [
    42,
    1,
    "Episode 1",
    "Season premiere",
    "2026-12-04",
    60,
    777001,
    "https://image.tmdb.org/t/p/original/next.jpg",
    "https://www.themoviedb.org/tv/243761/season/2/episode/1"
  ]);
  assert.match(insert.sql, /WHERE episodes\.tvmaze_id IS NULL/);
  assert.match(insert.sql, /air_date = excluded\.air_date/);
});

test("Phase 10B keeps TVmaze primary and removes stale future TMDB fallbacks", async () => {
  const db = fakeDb({ tvmazeFuture: true, pruneChanges: 1 });
  const result = await syncKoreanTmdbNextEpisodeFallback(db, {
    showId: 3177,
    details: details(),
    now: new Date("2026-09-14T00:00:00Z")
  });

  assert.deepEqual(result, { applied: 0, pruned: 1, reason: "tvmaze_future_present" });
  assert.equal(db.calls.some((call) => call.sql.startsWith("INSERT INTO episodes")), false);
  const prune = db.calls.find((call) => call.sql.startsWith("DELETE FROM episodes"));
  assert.deepEqual(prune.binds, [3177, "2026-09-14", null]);
});

test("Phase 10B clears a withdrawn TMDB fallback instead of fabricating a future episode", async () => {
  const db = fakeDb({ pruneChanges: 1 });
  const result = await syncKoreanTmdbNextEpisodeFallback(db, {
    showId: 3233,
    details: { id: 99966, next_episode_to_air: null },
    now: new Date("2026-09-14T00:00:00Z")
  });

  assert.deepEqual(result, { applied: 0, pruned: 1, reason: "tmdb_next_episode_unavailable" });
  assert.equal(db.calls.some((call) => call.sql.startsWith("INSERT INTO episodes")), false);
});

test("Phase 10B integration stays inside the existing KR request budget and lets TVmaze take over", () => {
  const korea = fs.readFileSync(new URL("../src/tmdb-korea.js", import.meta.url), "utf8");
  const quality = fs.readFileSync(new URL("../src/tmdb-korea-quality.js", import.meta.url), "utf8");
  const schedule = fs.readFileSync(new URL("../src/tmdb-korea-schedule.js", import.meta.url), "utf8");
  const tvmaze = fs.readFileSync(new URL("../src/tvmaze.js", import.meta.url), "utf8");
  const worker = fs.readFileSync(new URL("../src/phase10-worker.js", import.meta.url), "utf8");

  const persistIndex = korea.indexOf("const showId = await persistSeries(env.DB, normalized)");
  const acceptedHookIndex = korea.indexOf("await onAcceptedDetails(details, env.DB, { showId, normalized, now })");
  const successIndex = korea.indexOf('const status = warnings.length ? "success_with_warnings" : "success"');
  assert.ok(persistIndex > 0 && acceptedHookIndex > persistIndex && successIndex > acceptedHookIndex);

  assert.match(quality, /schedulePolicy: "tvmaze_primary_tmdb_next_episode_fallback"/);
  assert.match(quality, /scheduleFallbacksApplied/);
  assert.match(quality, /scheduleFallbacksPruned/);
  assert.doesNotMatch(schedule, /fetch\s*\(/, "fallback reuses TMDB details already fetched by catalog sync");

  assert.match(tvmaze, /hasFutureTvmazeSchedule/);
  assert.match(tvmaze, /source_url LIKE 'https:\/\/www\.themoviedb\.org\/tv\/%'/);
  assert.match(tvmaze, /selectRelevantEpisodes\(episodes, now\)/);
  assert.match(worker, /phase: "10b-korea-schedule"/);
});
