import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";
const SHOW_ID = 431;
const TMDB_ID = 241549;
const EVIDENCE_KEY = "6f187c02de32779b755a304d305c671575390d77aea0df6c30157a830cd36be0";

async function json(path) {
  const response = await fetch(`${PRODUCTION_URL}${path}`, {
    headers: { "cache-control": "no-cache" }
  });
  assert.equal(response.status, 200, `${path} should return 200`);
  return response.json();
}

const catalog = await json(`/api/shows?q=${encodeURIComponent("Murder in a Small Town")}&limit=20&region=HK`);
const show = (catalog.data || []).find((item) => Number(item.id) === SHOW_ID);
assert.ok(show, "Murder in a Small Town must remain in production catalog");
assert.equal(Number(show.tmdb_id), TMDB_ID);
assert.equal(show.status, "planned", "official evidence must not overwrite catalog lifecycle");
assert.equal(Number(show.latest_season_number), 2, "future renewal must not fabricate a catalog season row");
assert.match(String(show.networks || ""), /(^| · )FOX( · |$)/);

const lifecycle = await json(`/api/shows/${SHOW_ID}/lifecycle`);
assert.equal(lifecycle.meta?.authoritativeFactsOnly, true);
const events = Array.isArray(lifecycle.data) ? lifecycle.data : [];
const event = events.find((item) => item.evidence_key === EVIDENCE_KEY);

assert.ok(event, "Phase 4F FOX evidence must be live in production");
assert.equal(Number(event.show_id), SHOW_ID);
assert.equal(Number(event.season_number), 3);
assert.equal(event.season_id, null, "season_id should remain null until season 3 exists naturally");
assert.equal(event.event_type, "renewed");
assert.equal(event.source_key, "fox_flash");
assert.equal(event.trust_level, "official");
assert.equal(event.confidence, "official");
assert.equal(event.source_published_at, "2026-05-07");
assert.equal(Number(event.is_retracted), 0);
assert.equal(lifecycle.summary?.bySeason?.["3"]?.decision?.evidence_key, EVIDENCE_KEY);

console.log(JSON.stringify({
  catalog: {
    id: show.id,
    tmdb_id: show.tmdb_id,
    status: show.status,
    latest_season_number: show.latest_season_number,
    networks: show.networks
  },
  officialEvidence: {
    id: event.id,
    evidence_key: event.evidence_key,
    season_number: event.season_number,
    season_id: event.season_id,
    event_type: event.event_type,
    source_key: event.source_key,
    trust_level: event.trust_level,
    confidence: event.confidence,
    source_published_at: event.source_published_at
  }
}, null, 2));
