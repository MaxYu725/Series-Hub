import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";
const targets = ["The Last of Us", "ONE PIECE", "Murder in a Small Town"];
const sourceNetworkPatterns = [/HBO/i, /Max/i, /Netflix/i, /FOX/i];

async function json(path) {
  const response = await fetch(`${PRODUCTION_URL}${path}`, {
    headers: { "cache-control": "no-cache" }
  });
  assert.equal(response.status, 200, `${path} should return 200`);
  return response.json();
}

const directResults = [];

for (const title of targets) {
  const catalog = await json(`/api/shows?q=${encodeURIComponent(title)}&limit=20&region=HK`);
  const candidates = Array.isArray(catalog.data) ? catalog.data : [];
  const normalizedTarget = title.toLowerCase();
  const show = candidates.find((item) =>
    String(item.english_title || item.original_title || "").toLowerCase() === normalizedTarget
  ) || null;

  if (!show) {
    directResults.push({ title, found: false });
    continue;
  }

  directResults.push({
    title,
    found: true,
    id: show.id,
    tmdb_id: show.tmdb_id,
    status: show.status,
    latest_season_number: show.latest_season_number,
    networks: show.networks
  });
}

const fullCatalog = await json("/api/shows?limit=100&region=HK");
const rows = Array.isArray(fullCatalog.data) ? fullCatalog.data : [];
const sourceCandidates = rows
  .filter((show) => sourceNetworkPatterns.some((pattern) => pattern.test(String(show.networks || ""))))
  .map((show) => ({
    id: show.id,
    tmdb_id: show.tmdb_id,
    title: show.english_title || show.original_title,
    status: show.status,
    latest_season_number: show.latest_season_number,
    networks: show.networks
  }));

console.log(JSON.stringify({
  directResults,
  catalogCount: rows.length,
  sourceCandidates
}, null, 2));
