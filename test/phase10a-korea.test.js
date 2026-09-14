import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import phase10Worker from "../src/phase10-worker.js";
import {
  KOREA_NETWORK_SEEDS,
  KOREA_TMDB_SYNC_BUDGET,
  isIncludedKoreanScriptedSeries
} from "../src/tmdb-korea.js";
import {
  KOREA_FICTION_GENRE_IDS,
  hasKoreanFictionGenre,
  isEligibleForUsCatalog,
  isIncludedKoreanCatalogSeries
} from "../src/tmdb-korea-quality.js";
import {
  TMDB_SYNC_BUDGET,
  selectNetworkSeedsForSync
} from "../src/tmdb.js";

function koreanSeries(overrides = {}) {
  return {
    type: "Scripted",
    origin_country: ["KR"],
    genres: [{ id: 18, name: "Drama" }],
    ...overrides
  };
}

test("Phase 10A uses verified Korean network seeds and a separate 24-request ceiling", () => {
  const seeds = new Map(KOREA_NETWORK_SEEDS.map((seed) => [seed.name, seed.tmdbNetworkId]));
  const expected = new Map([
    ["KBS2", 342],
    ["MBC", 97],
    ["SBS", 156],
    ["tvN", 866],
    ["JTBC", 885],
    ["ENA", 5841],
    ["TVING", 3897],
    ["Netflix", 213],
    ["Disney+", 2739]
  ]);

  for (const [name, id] of expected) assert.equal(seeds.get(name), id, name);
  assert.equal(KOREA_TMDB_SYNC_BUDGET.networkDiscoveryRequests, 4);
  assert.equal(KOREA_TMDB_SYNC_BUDGET.detailRequests, 18);
  assert.equal(KOREA_TMDB_SYNC_BUDGET.totalExternalRequests, 24);
  assert.equal(TMDB_SYNC_BUDGET.totalExternalRequests, 48);
});

test("Phase 10A defines Korean drama by KR origin rather than Korean language alone", () => {
  assert.equal(isIncludedKoreanScriptedSeries(koreanSeries()), true);
  assert.equal(
    isIncludedKoreanScriptedSeries(koreanSeries({ origin_country: ["KR", "US"], original_language: "en" })),
    true
  );
  assert.equal(
    isIncludedKoreanScriptedSeries(koreanSeries({ origin_country: ["US"], original_language: "ko" })),
    false
  );
  assert.equal(isIncludedKoreanScriptedSeries(koreanSeries({ type: "Reality" })), false);
  assert.equal(
    isIncludedKoreanScriptedSeries(koreanSeries({ genres: [{ id: 16, name: "Animation" }] })),
    false
  );
});

test("Phase 10A.1 requires a real fiction genre instead of trusting Scripted alone", () => {
  assert.equal(hasKoreanFictionGenre(koreanSeries()), true);
  assert.equal(isIncludedKoreanCatalogSeries(koreanSeries()), true);
  assert.equal(isIncludedKoreanCatalogSeries(koreanSeries({ genres: [] })), false);
  assert.equal(isIncludedKoreanCatalogSeries(koreanSeries({ genres: null })), false);
  assert.equal(
    isIncludedKoreanCatalogSeries(koreanSeries({
      genres: [
        { id: 10765, name: "Sci-Fi & Fantasy" },
        { id: 35, name: "Comedy" }
      ]
    })),
    true
  );
  assert.ok(KOREA_FICTION_GENRE_IDS.includes(10766), "Korean daily/soap fiction remains allowed");
});

test("Phase 10A.1 preserves shared KR/US rows that remain eligible for the US catalog", () => {
  const now = new Date("2026-09-14T00:00:00Z");
  const sharedUsSeries = koreanSeries({
    id: 999001,
    origin_country: ["KR", "US"],
    genres: [],
    networks: [{ name: "Netflix" }],
    status: "Returning Series",
    first_air_date: "2026-01-01",
    last_episode_to_air: { air_date: "2026-09-10" },
    seasons: []
  });

  assert.equal(isIncludedKoreanCatalogSeries(sharedUsSeries), false);
  assert.equal(isEligibleForUsCatalog(sharedUsSeries, now), true);
  assert.equal(
    isEligibleForUsCatalog({ ...sharedUsSeries, networks: [{ name: "tvN" }] }, now),
    false
  );
});

test("Phase 10A.1 rejects new sparse rows before persistence and cleans stale rows inside tracked sync", () => {
  const quality = fs.readFileSync(new URL("../src/tmdb-korea-quality.js", import.meta.url), "utf8");
  const source = fs.readFileSync(new URL("../src/tmdb-korea.js", import.meta.url), "utf8");
  const migration = fs.readFileSync(
    new URL("../migrations/0020_phase10a1_korea_catalog_quality.sql", import.meta.url),
    "utf8"
  );
  const wrapper = fs.readFileSync(new URL("../src/phase10-worker.js", import.meta.url), "utf8");

  assert.match(source, /typeof options\.includeDetails === "function"/);
  assert.match(source, /typeof options\.onRejectedDetails === "function"/);
  assert.match(source, /recordsRejected \+= 1/);
  assert.match(source, /await onRejectedDetails\(details, env\.DB\)/);
  const qualityGateIndex = source.indexOf("includeDetails && !includeDetails(details)");
  const cleanupHookIndex = source.indexOf("await onRejectedDetails(details, env.DB)");
  const persistIndex = source.indexOf("await persistSeries(env.DB, normalized)");
  const successIndex = source.indexOf('const status = warnings.length ? "success_with_warnings" : "success"');
  assert.ok(qualityGateIndex > 0 && persistIndex > qualityGateIndex, "quality gate must run before D1 persistence");
  assert.ok(cleanupHookIndex > qualityGateIndex && successIndex > cleanupHookIndex, "cleanup must finish before sync success is recorded");

  assert.match(quality, /isEligibleForUsCatalog/);
  assert.match(quality, /isIncludedUsScriptedSeries/);
  assert.match(quality, /isTargetNetworkSeries/);
  assert.match(quality, /onRejectedDetails/);
  assert.match(quality, /DELETE FROM shows/);
  assert.match(quality, /tmdb_id = \?1/);
  assert.match(quality, /recordsPruned/);
  assert.match(quality, /recordsAccepted: Number\(result\.recordsChanged/);
  assert.doesNotMatch(quality, /204448|123844|219260|219956/);
  assert.doesNotMatch(quality, /Good Partner|Shinbyung|낭만닥터|외식하는 날/);

  assert.match(migration, /NOT EXISTS/);
  assert.match(migration, /show_genres/);
  assert.match(migration, /tmdb_genre_id IN/);
  assert.doesNotMatch(migration, /204448|123844|219260|219956/);
  assert.doesNotMatch(migration, /Good Partner|Shinbyung|낭만닥터|외식하는 날/);
  assert.match(wrapper, /from "\.\/tmdb-korea-quality\.js"/);
});

test("Korean network rotation reaches every seed without stealing US discovery requests", () => {
  const seen = new Set();
  const start = Date.parse("2026-09-12T00:00:00Z");

  for (let slot = 0; slot < 3; slot += 1) {
    const active = selectNetworkSeedsForSync(
      KOREA_NETWORK_SEEDS,
      KOREA_TMDB_SYNC_BUDGET.networkDiscoveryRequests,
      new Date(start + slot * 6 * 60 * 60 * 1000)
    );
    assert.equal(active.length, 4);
    for (const seed of active) seen.add(seed.name);
  }

  assert.deepEqual([...seen].sort(), KOREA_NETWORK_SEEDS.map((seed) => seed.name).sort());
});

test("Korean discovery is isolated to KR and keeps source health separate", () => {
  const source = fs.readFileSync(new URL("../src/tmdb-korea.js", import.meta.url), "utf8");
  const migration = fs.readFileSync(
    new URL("../migrations/0019_phase10a_tmdb_korea_source.sql", import.meta.url),
    "utf8"
  );

  assert.match(source, /with_origin_country:\s*"KR"/);
  assert.match(source, /with_type:\s*"2\|4"/);
  assert.match(source, /source:\s*"tmdb_kr"/);
  assert.match(source, /market:\s*"KR"/);
  assert.match(migration, /'tmdb_kr'/);
  assert.match(migration, /'TMDB · Korea'/);
});

test("Phase 10 wrapper preserves Phase 8 delegation and isolates Korean sync cadence", async () => {
  const wrapper = fs.readFileSync(new URL("../src/phase10-worker.js", import.meta.url), "utf8");
  const wrangler = JSON.parse(fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));

  assert.match(wrapper, /phase8Worker\.fetch/);
  assert.match(wrapper, /return phase8Worker\.scheduled\(controller, env, ctx\);/);
  assert.match(wrapper, /KOREA_SYNC_CRON = "37 \*\/6 \* \* \*"/);
  assert.match(wrapper, /controller\.cron === KOREA_SYNC_CRON/);
  assert.equal(wrangler.main, "./src/phase10-worker.js");
  assert.ok(wrangler.triggers.crons.includes("17 */6 * * *"));
  assert.ok(wrangler.triggers.crons.includes("37 */6 * * *"));
  assert.ok(wrangler.triggers.crons.includes("47 * * * *"));

  const missingToken = await phase10Worker.fetch(
    new Request("https://series-hub.test/api/internal/tmdb-sync-kr", { method: "POST" }),
    {},
    {}
  );
  assert.equal(missingToken.status, 503);

  const unauthorized = await phase10Worker.fetch(
    new Request("https://series-hub.test/api/internal/tmdb-sync-kr", { method: "POST" }),
    { TMDB_API_TOKEN: "test-token" },
    {}
  );
  assert.equal(unauthorized.status, 401);
});

test("tmdb_kr sync status is readable without changing the legacy tmdb status contract", async () => {
  const response = await phase10Worker.fetch(
    new Request("https://series-hub.test/api/sync-status?source=tmdb_kr"),
    {},
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data, null);
  assert.equal(payload.meta.source, "tmdb_kr");
  assert.equal(payload.meta.market, "KR");
});
