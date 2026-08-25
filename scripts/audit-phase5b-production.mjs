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
  ui = await text("/phase5b-ui.js");
  if (html.includes("Phase 5B") && html.includes("phase5b-ui.js") && ui.includes("tracked-schedule-filter")) break;
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

assert.match(html, /Phase 5B/);
assert.match(html, /phase5b-ui\.js/);
assert.match(ui, /tracked-schedule-filter/);
assert.match(ui, /只看追蹤/);
assert.match(ui, /\/api\/schedule/);
assert.doesNotMatch(ui, /\/api\/tracking|\/api\/favorites/);

const today = new Date().toISOString().slice(0, 10);
const schedule = await json(`/api/schedule?from=${today}&days=7&region=HK`);
assert.ok(Array.isArray(schedule.data));
for (const episode of schedule.data.slice(0, 10)) {
  assert.ok(Number.isSafeInteger(Number(episode.show_id)) && Number(episode.show_id) > 0, "schedule rows must expose stable show_id");
}

const health = await json("/health");
assert.equal(health.ok, true);

console.log(JSON.stringify({
  phase5bAssets: true,
  health: health.ok,
  scheduleRows: schedule.data.length,
  sampledStableShowIds: schedule.data.slice(0, 10).map((episode) => Number(episode.show_id))
}, null, 2));
