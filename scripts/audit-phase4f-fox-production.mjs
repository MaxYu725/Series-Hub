import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";
const TARGET_TITLE = "Murder in a Small Town";
const TARGET_TMDB_ID = 241549;

async function json(path) {
  const response = await fetch(`${PRODUCTION_URL}${path}`, {
    headers: { "cache-control": "no-cache" }
  });
  assert.equal(response.status, 200, `${path} should return 200`);
  return response.json();
}

const catalog = await json(`/api/shows?q=${encodeURIComponent(TARGET_TITLE)}&limit=20&region=HK`);
const candidates = Array.isArray(catalog.data) ? catalog.data : [];
const show = candidates.find((item) =>
  String(item.english_title || item.original_title || "").toLowerCase() === TARGET_TITLE.toLowerCase()
);

assert.ok(show, `${TARGET_TITLE} must be present in production after the Phase 4F discovery repair`);
assert.ok(Number.isSafeInteger(Number(show.id)) && Number(show.id) > 0, "Series Hub ID must be a positive integer");
assert.equal(Number(show.tmdb_id), TARGET_TMDB_ID, "TMDB identity must remain stable");
assert.match(String(show.networks || ""), /(^| · )FOX( · |$)/, "current network projection must include FOX");
assert.ok(["airing", "upcoming", "planned"].includes(show.status), `unexpected catalog status: ${show.status}`);
assert.ok(Number(show.latest_season_number || 0) >= 2, "catalog should expose at least the two existing seasons");

const lifecycle = await json(`/api/shows/${show.id}/lifecycle`);
assert.equal(lifecycle.meta?.authoritativeFactsOnly, true, "lifecycle projection must remain authoritative-only");

console.log(JSON.stringify({
  id: show.id,
  tmdb_id: show.tmdb_id,
  english_title: show.english_title,
  chinese_title: show.chinese_title || null,
  status: show.status,
  tmdb_status: show.tmdb_status,
  latest_season_number: show.latest_season_number,
  networks: show.networks,
  lifecycle_events: Array.isArray(lifecycle.data)
    ? lifecycle.data.map((event) => [event.id, event.season_number, event.event_type, event.source_key])
    : []
}, null, 2));
