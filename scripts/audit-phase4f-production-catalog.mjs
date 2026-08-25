import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";

async function json(path) {
  const response = await fetch(`${PRODUCTION_URL}${path}`, { headers: { "cache-control": "no-cache" } });
  assert.equal(response.status, 200, `${path} should return 200`);
  return response.json();
}

const catalog = await json("/api/shows?q=Murder%20in%20a%20Small%20Town&limit=20&region=HK");
const rows = Array.isArray(catalog.data) ? catalog.data : [];
const show = rows.find((item) => Number(item.tmdb_id) === 241549) || null;

assert.ok(show, "Murder in a Small Town (TMDB 241549) must enter production catalog after Phase 4F sync");
assert.equal(String(show.english_title || show.original_title), "Murder in a Small Town");
assert.match(String(show.networks || ""), /FOX/);
assert.ok(["airing", "upcoming", "planned"].includes(show.status), `unexpected catalog status: ${show.status}`);
assert.ok(Number.isSafeInteger(Number(show.id)) && Number(show.id) > 0, "Series Hub ID must be stable");

const lifecycle = await json(`/api/shows/${show.id}/lifecycle`);
assert.equal(lifecycle.meta?.authoritativeFactsOnly, true);

console.log(JSON.stringify({
  id: show.id,
  tmdb_id: show.tmdb_id,
  title: show.english_title || show.original_title,
  status: show.status,
  latest_season_number: show.latest_season_number,
  networks: show.networks,
  lifecycle_events: Array.isArray(lifecycle.data)
    ? lifecycle.data.map((event) => [event.id, event.season_number, event.event_type, event.source_key])
    : []
}, null, 2));
