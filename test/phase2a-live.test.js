import test from "node:test";
import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";

async function getJson(path) {
  const response = await fetch(`${PRODUCTION_URL}${path}`);
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return response.json();
}

async function waitForPhase2() {
  let snapshot = null;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const health = await getJson("/health");
    const sync = await getJson("/api/sync-status?source=tvmaze");
    snapshot = { health, sync };
    if (
      health.phase === "2-tvmaze-schedule" &&
      health.tmdbConfigured === true &&
      health.tvmazeEnabled === true &&
      sync.data &&
      ["success", "success_with_warnings"].includes(sync.data.status) &&
      Number(sync.data.records_changed || 0) > 0
    ) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw new Error(`Phase 2A production did not become ready: ${JSON.stringify(snapshot)}`);
}

test("Phase 2A production has exact TVmaze mappings and real schedule data", async () => {
  const { health, sync } = await waitForPhase2();
  assert.equal(health.databaseReachable, true);

  const showsPayload = await getJson("/api/shows?limit=100");
  const shows = showsPayload.data || [];
  assert.ok(shows.length >= 20, `catalog ${shows.length}`);

  const mapped = shows.filter((show) => Number(show.tvmaze_id) > 0);
  assert.ok(mapped.length >= Math.ceil(shows.length * 0.65), `TVmaze mapped ${mapped.length}/${shows.length}`);

  const schedulePayload = await getJson("/api/schedule?from=2026-08-24&days=14");
  const schedule = schedulePayload.data || [];
  assert.equal(schedulePayload.meta?.source, "TVmaze");
  assert.equal(schedulePayload.meta?.attribution_url, "https://www.tvmaze.com");
  assert.ok(schedule.length >= 1, "Expected at least one episode in the next 14-day audit window");

  const sampleShow = mapped.find((show) => ["Reacher", "Silo", "Ted Lasso", "Lioness"].includes(show.english_title)) || mapped[0];
  assert.ok(sampleShow?.id);
  const episodesPayload = await getJson(`/api/shows/${sampleShow.id}/episodes?limit=100`);
  assert.equal(episodesPayload.meta?.source, "TVmaze");
  assert.ok((episodesPayload.data || []).length >= 1, `${sampleShow.english_title} has no normalized TVmaze episodes`);

  const withNextEpisode = shows.filter((show) => show.tvmaze_next_episode_date).length;
  const withLastEpisode = shows.filter((show) => show.tvmaze_last_episode_date).length;

  console.log("SERIES_HUB_PHASE2A_LIVE_AUDIT");
  console.log(JSON.stringify({
    catalog_count: shows.length,
    mapped_count: mapped.length,
    mapping_coverage: `${mapped.length}/${shows.length}`,
    schedule_14d_count: schedule.length,
    shows_with_tvmaze_next_episode: withNextEpisode,
    shows_with_tvmaze_last_episode: withLastEpisode,
    tvmaze_sync: sync.data,
    mapped_focus: mapped
      .filter((show) => ["Reacher", "Silo", "Ted Lasso", "Lioness", "Grey's Anatomy", "The Rookie", "Fargo"].includes(show.english_title))
      .map((show) => ({
        title: show.english_title,
        tvmaze_id: show.tvmaze_id,
        tmdb_next: show.next_air_date,
        tvmaze_next: show.tvmaze_next_episode_date,
        tvmaze_last: show.tvmaze_last_episode_date
      })),
    schedule_sample: schedule.slice(0, 20).map((episode) => ({
      show: episode.english_title,
      season: episode.season_number,
      episode: episode.episode_number,
      name: episode.episode_name,
      air_date: episode.air_date,
      air_time: episode.air_time,
      networks: episode.networks,
      source_url: episode.source_url
    }))
  }, null, 2));
});
