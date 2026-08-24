import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";
const targets = ["The Last of Us", "ONE PIECE", "Murder in a Small Town"];

async function json(path) {
  const response = await fetch(`${PRODUCTION_URL}${path}`, {
    headers: { "cache-control": "no-cache" }
  });
  assert.equal(response.status, 200, `${path} should return 200`);
  return response.json();
}

const results = [];

for (const title of targets) {
  const catalog = await json(`/api/shows?q=${encodeURIComponent(title)}&limit=20&region=HK`);
  const candidates = Array.isArray(catalog.data) ? catalog.data : [];
  const normalizedTarget = title.toLowerCase();
  const show = candidates.find((item) =>
    String(item.english_title || item.original_title || "").toLowerCase() === normalizedTarget
  ) || null;

  if (!show) {
    results.push({ title, found: false });
    continue;
  }

  assert.ok(Number.isSafeInteger(Number(show.id)) && Number(show.id) > 0, `${title}: invalid Series Hub ID`);
  assert.ok(Number.isSafeInteger(Number(show.tmdb_id)) && Number(show.tmdb_id) > 0, `${title}: missing TMDB ID`);

  const lifecycle = await json(`/api/shows/${show.id}/lifecycle`);
  assert.equal(lifecycle.meta?.authoritativeFactsOnly, true, `${title}: lifecycle projection must be authoritative-only`);

  results.push({
    title,
    found: true,
    id: show.id,
    tmdb_id: show.tmdb_id,
    status: show.status,
    latest_season_number: show.latest_season_number,
    lifecycle_events: Array.isArray(lifecycle.data)
      ? lifecycle.data.map((event) => [event.id, event.season_number, event.event_type, event.source_key])
      : []
  });
}

console.log(JSON.stringify(results, null, 2));
