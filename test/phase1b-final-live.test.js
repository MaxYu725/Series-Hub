import test from "node:test";
import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";
const EXCLUDED_GENRES = new Set(["Animation", "Documentary", "Kids", "News", "Reality", "Talk"]);

async function getJson(path) {
  const response = await fetch(`${PRODUCTION_URL}${path}`);
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return response.json();
}

async function waitForFinalSync() {
  let last = null;

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const payload = await getJson("/api/sync-status");
    last = payload?.data || null;

    if (
      last &&
      ["success", "success_with_warnings"].includes(last.status) &&
      Number(last.records_seen) > 47
    ) {
      return last;
    }

    await new Promise((resolve) => setTimeout(resolve, 4000));
  }

  throw new Error(`Final Phase 1B production sync did not become ready: ${JSON.stringify(last)}`);
}

function showTitle(show) {
  return show.english_title || show.original_title || `TMDB ${show.tmdb_id}`;
}

function networkText(show) {
  return String(show.networks || "");
}

function genreNames(show) {
  return String(show.genres || "")
    .split(/[·,|]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function chineseTitle(show) {
  return show.title_zh_hk || show.title_zh_tw || show.title_zh_cn || null;
}

test("final Phase 1B production catalog is clean, active and network-balanced", async () => {
  const health = await getJson("/health");
  assert.equal(health.ok, true);
  assert.equal(health.tmdbConfigured, true);

  const sync = await waitForFinalSync();
  const showsPayload = await getJson("/api/shows?limit=100");
  const shows = showsPayload?.data;

  assert.ok(Array.isArray(shows));
  assert.ok(shows.length > 0);

  for (const show of shows) {
    const title = showTitle(show);
    assert.ok(["airing", "upcoming", "planned"].includes(show.status), `${title}: ${show.status}`);

    for (const genre of genreNames(show)) {
      assert.equal(EXCLUDED_GENRES.has(genre), false, `${title}: ${genre}`);
    }
  }

  const titles = new Set(shows.map(showTitle));
  assert.equal(titles.has("Raw"), false, "WWE Raw must not remain in the scripted catalog");
  assert.equal(titles.has("Sesame Street"), false, "Kids programming must not remain in the scripted catalog");

  const fxShows = shows.filter((show) => /(^| · |, )(FX|FXX)( · |, |$)/.test(networkText(show)));
  assert.ok(fxShows.length >= 1, "Expected at least one active FX/FXX series after network-seeded discovery");

  const chineseCoverage = shows.filter((show) => chineseTitle(show)).length;
  const posterCoverage = shows.filter((show) => show.poster_url).length;
  assert.ok(chineseCoverage / shows.length >= 0.8, `Chinese title coverage ${chineseCoverage}/${shows.length}`);
  assert.ok(posterCoverage / shows.length >= 0.9, `Poster coverage ${posterCoverage}/${shows.length}`);

  const statusCounts = {};
  const networkCounts = {};
  for (const show of shows) {
    statusCounts[show.status] = (statusCounts[show.status] || 0) + 1;
    for (const name of networkText(show).split(" · ").map((value) => value.trim()).filter(Boolean)) {
      networkCounts[name] = (networkCounts[name] || 0) + 1;
    }
  }

  console.log("SERIES_HUB_PHASE1B_FINAL_AUDIT");
  console.log(JSON.stringify({
    catalog_count: shows.length,
    sync,
    status_counts: statusCounts,
    chinese_title_coverage: `${chineseCoverage}/${shows.length}`,
    poster_coverage: `${posterCoverage}/${shows.length}`,
    fx_titles: fxShows.map((show) => ({
      title: showTitle(show),
      title_zh_hk: show.title_zh_hk,
      status: show.status,
      next_air_date: show.next_air_date,
      networks: networkText(show)
    })),
    network_counts: networkCounts,
    sample: shows.slice(0, 30).map((show) => ({
      title: showTitle(show),
      title_zh_hk: show.title_zh_hk,
      status: show.status,
      season: show.latest_season_number,
      next_air_date: show.next_air_date,
      networks: networkText(show),
      genres: show.genres
    }))
  }, null, 2));
});
