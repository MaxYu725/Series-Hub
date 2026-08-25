import assert from "node:assert/strict";

const BASE = "https://series-hub.max-yu-jp.workers.dev";

async function text(path) {
  const response = await fetch(`${BASE}${path}`, { headers: { "cache-control": "no-cache" } });
  assert.equal(response.status, 200, `${path} should return 200`);
  return response.text();
}

async function json(path) {
  const response = await fetch(`${BASE}${path}`, { headers: { "cache-control": "no-cache" } });
  assert.equal(response.status, 200, `${path} should return 200`);
  return response.json();
}

let html = "";
let ui = "";
for (let attempt = 1; attempt <= 20; attempt += 1) {
  html = await text("/");
  ui = await text("/phase5-ui.js");
  if (html.includes("my-shows-filter") && html.includes("Phase 5A") && ui.includes("series-hub-tracked-shows-v1") === false) {
    // storage key lives in tracking.js; UI marker is enough here.
  }
  if (html.includes("my-shows-filter") && html.includes("phase5-ui.js") && ui.includes("我的劇集")) break;
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

assert.match(html, /id="my-shows-filter"/);
assert.match(html, /Phase 5A/);
assert.match(html, /phase5\.css/);
assert.match(html, /phase5-ui\.js/);
assert.match(ui, /我的劇集/);
assert.match(ui, /\/api\/shows/);

const tracking = await text("/tracking.js");
assert.match(tracking, /series-hub-tracked-shows-v1/);
assert.doesNotMatch(ui, /\/api\/tracking|\/api\/favorites/);

const health = await json("/health");
const shows = await json("/api/shows?status=airing&limit=5&region=HK");
assert.equal(health.ok, true);
assert.ok(Array.isArray(shows.data));

console.log(JSON.stringify({
  phase5Assets: true,
  health: health.ok,
  sampleShows: shows.data.length
}, null, 2));
