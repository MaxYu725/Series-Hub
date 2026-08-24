import test from "node:test";
import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";
const SUCCESS_STATUSES = new Set(["success", "success_with_warnings"]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(path) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${PRODUCTION_URL}${path}${separator}audit=${Date.now()}`, {
    headers: { "cache-control": "no-cache" }
  });
  assert.equal(response.ok, true, `${path} returned ${response.status}`);
  return response.text();
}

async function fetchJson(path) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${PRODUCTION_URL}${path}${separator}audit=${Date.now()}`, {
    headers: { accept: "application/json", "cache-control": "no-cache" }
  });
  assert.equal(response.ok, true, `${path} returned ${response.status}`);
  return response.json();
}

async function waitForPhase2bAssets() {
  let lastHome = "";
  let lastApp = "";

  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      [lastHome, lastApp] = await Promise.all([
        fetchText("/"),
        fetchText("/app.js")
      ]);

      const ready =
        lastHome.includes("Phase 2") &&
        lastHome.includes('data-view="today"') &&
        lastHome.includes('data-view="week"') &&
        lastApp.includes('./schedule-utils.js') &&
        lastApp.includes('/api/schedule');

      if (ready) return { home: lastHome, app: lastApp, attempt };
    } catch (error) {
      console.log(`Phase 2B production assets not ready (${attempt}/40): ${error.message}`);
    }

    await sleep(3000);
  }

  assert.fail("Production did not expose Phase 2B assets within the audit window");
}

async function waitForTvmazeSync() {
  let latest = null;

  for (let attempt = 1; attempt <= 40; attempt += 1) {
    latest = await fetchJson("/api/sync-status?source=tvmaze");
    const status = latest?.data?.status;

    if (SUCCESS_STATUSES.has(status)) return { payload: latest, attempt };
    if (status && status !== "running") {
      assert.fail(`TVmaze sync reached terminal failure state: ${status}`);
    }

    console.log(`TVmaze production bootstrap still ${status || "unavailable"} (${attempt}/40)`);
    await sleep(3000);
  }

  assert.fail(`TVmaze sync did not finish successfully; latest status: ${latest?.data?.status || "missing"}`);
}

test("Phase 2B production UI and live schedule contract are complete", { timeout: 240000 }, async () => {
  if (!process.env.CI) return;

  const { home, app, attempt: assetsAttempt } = await waitForPhase2bAssets();
  const { payload: tvmazeSync, attempt: syncAttempt } = await waitForTvmazeSync();
  const [utils, health, catalog, schedule] = await Promise.all([
    fetchText("/schedule-utils.js"),
    fetchJson("/health"),
    fetchJson("/api/shows?limit=60"),
    fetchJson("/api/schedule?days=14")
  ]);

  assert.match(home, /Phase 2/);
  assert.match(home, /data-view="today"/);
  assert.match(home, /data-view="week"/);
  assert.match(home, /TVmaze/);
  assert.match(home, /schedule-list/);

  assert.match(app, /\.\/schedule-utils\.js/);
  assert.match(app, /today:\s*\{/);
  assert.match(app, /week:\s*\{/);
  assert.match(app, /\/api\/schedule/);
  assert.match(app, /resolvedOptions\(\)\.timeZone/);
  assert.match(app, /TVmaze 來源日期/);
  assert.match(app, /air_timestamp/);

  assert.match(utils, /dateKeyInTimeZone/);
  assert.match(utils, /episodeLocalDateKey/);
  assert.match(utils, /scheduleWindow/);
  assert.match(utils, /episodeCode/);

  assert.equal(health.ok, true);
  assert.equal(health.phase, "2-tvmaze-schedule");
  assert.equal(health.databaseConfigured, true);
  assert.equal(health.databaseReachable, true);
  assert.equal(health.tmdbConfigured, true);
  assert.equal(health.tvmazeEnabled, true);

  assert.ok(Array.isArray(catalog.data));
  assert.ok(catalog.data.length >= 20, `catalog unexpectedly small: ${catalog.data.length}`);
  assert.equal(catalog.meta?.phase, "2-tvmaze-schedule");

  assert.ok(Array.isArray(schedule.data));
  assert.ok(schedule.data.length >= 1, "14-day production schedule is empty");
  assert.equal(schedule.meta?.phase, "2-tvmaze-schedule");
  assert.equal(schedule.meta?.source, "TVmaze");
  assert.equal(schedule.meta?.attribution_url, "https://www.tvmaze.com");

  const sample = schedule.data.slice(0, 20);
  for (const episode of sample) {
    assert.ok(Number(episode.show_id) > 0, "schedule row is missing show_id");
    assert.ok(String(episode.english_title || "").trim(), "schedule row is missing English title");
    assert.ok(Number(episode.season_number) >= 1, "schedule row has invalid season number");
    assert.ok(Number(episode.episode_number) >= 1, "schedule row has invalid episode number");
    assert.match(String(episode.air_date || ""), /^\d{4}-\d{2}-\d{2}$/);
    assert.match(String(episode.source_url || ""), /^https:\/\/(?:www\.)?tvmaze\.com\//);
  }

  const chineseTitleCount = schedule.data.filter((episode) =>
    episode.title_zh_hk || episode.title_zh_tw || episode.title_zh_cn
  ).length;
  assert.ok(chineseTitleCount >= Math.ceil(schedule.data.length * 0.5),
    `Chinese title coverage too low: ${chineseTitleCount}/${schedule.data.length}`);

  assert.ok(tvmazeSync.data, "TVmaze sync record missing");
  assert.ok(SUCCESS_STATUSES.has(tvmazeSync.data.status), `TVmaze sync is ${tvmazeSync.data.status}`);
  assert.equal(tvmazeSync.meta?.source, "tvmaze");

  const exactTimestampCount = schedule.data.filter((episode) => episode.air_timestamp).length;
  const sourceDateOnlyCount = schedule.data.length - exactTimestampCount;

  console.log("SERIES_HUB_PHASE2B_LIVE_AUDIT");
  console.log(JSON.stringify({
    assets_ready_attempt: assetsAttempt,
    tvmaze_sync_ready_attempt: syncAttempt,
    catalog_count: catalog.data.length,
    schedule_14d_count: schedule.data.length,
    chinese_title_coverage: `${chineseTitleCount}/${schedule.data.length}`,
    exact_timestamp_count: exactTimestampCount,
    source_date_only_count: sourceDateOnlyCount,
    tvmaze_sync: tvmazeSync.data,
    sample: sample.slice(0, 12).map((episode) => ({
      show: episode.english_title,
      title_zh: episode.title_zh_hk || episode.title_zh_tw || episode.title_zh_cn || null,
      episode: `S${String(episode.season_number).padStart(2, "0")}E${String(episode.episode_number).padStart(2, "0")}`,
      episode_name: episode.episode_name,
      air_date: episode.air_date,
      air_time: episode.air_time,
      air_timestamp: episode.air_timestamp,
      networks: episode.networks
    }))
  }, null, 2));
});
