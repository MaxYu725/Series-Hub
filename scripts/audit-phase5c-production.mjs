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
let state = "";
for (let attempt = 1; attempt <= 20; attempt += 1) {
  html = await text("/");
  ui = await text("/phase5c-ui.js");
  state = await text("/viewing-state.js");
  if (
    html.includes("Phase 5C") &&
    html.includes("phase5c-ui.js") &&
    html.includes("phase5c.css") &&
    ui.includes("viewing-state-filter") &&
    state.includes("series-hub-viewing-states-v1")
  ) break;
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

assert.match(html, /Phase 5C/);
assert.match(html, /phase5c\.css/);
assert.match(html, /phase5c-ui\.js/);
assert.match(html, /phase5b-ui\.js/);

assert.match(ui, /viewing-state-filter/);
assert.match(ui, /show-viewing-state-select/);
assert.match(ui, /myButton\.classList\.contains\("active"\)/);
assert.match(ui, /saveViewingStates/);
assert.doesNotMatch(ui, /\/api\/tracking|\/api\/favorites|\/api\/viewing|method:\s*["']POST["']/);

assert.match(state, /series-hub-viewing-states-v1/);
for (const label of ["追看中", "等下一季", "已看完", "暫停"]) assert.match(state, new RegExp(label));
assert.doesNotMatch(state, /fetch\(|\/api\//);

const health = await json("/health");
assert.equal(health.ok, true);

console.log(JSON.stringify({
  phase5cAssets: true,
  phase5bStillLoaded: html.includes("phase5b-ui.js"),
  localViewingStateKey: "series-hub-viewing-states-v1",
  viewingStates: ["watching", "waiting", "completed", "paused"],
  health: health.ok,
  backendPersonalizationEndpoint: false
}, null, 2));
