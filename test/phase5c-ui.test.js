import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../public/phase5c-ui.js", import.meta.url), "utf8");
const state = fs.readFileSync(new URL("../public/viewing-state.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../public/phase5c.css", import.meta.url), "utf8");

test("Phase 5C viewing-state assets remain loaded after later Phase 5 additions", () => {
  assert.match(html, /phase5c\.css/);
  assert.match(html, /phase5c-ui\.js/);
});

test("Phase 5C provides the four planned local viewing states", () => {
  for (const label of ["追看中", "等下一季", "已看完", "暫停"]) {
    assert.match(state, new RegExp(label));
  }
  assert.match(state, /series-hub-viewing-states-v1/);
});

test("Phase 5C state controls are limited to My Shows and support local filtering", () => {
  assert.match(ui, /myButton\.classList\.contains\("active"\)/);
  assert.match(ui, /id = "viewing-state-filter"/);
  assert.match(ui, /show-viewing-state-select/);
  assert.match(ui, /card\.hidden = !match/);
  assert.match(css, /\.show-viewing-state/);
});

test("Phase 5C layer itself does not add accounts, backend user state, or notification infrastructure", () => {
  assert.doesNotMatch(ui, /\/api\/tracking|\/api\/favorites|\/api\/viewing|method:\s*["']POST["']/);
  assert.doesNotMatch(state, /fetch\(|\/api\//);
  assert.doesNotMatch(ui, /serviceWorker|PushManager|push subscription/i);
  assert.doesNotMatch(state, /serviceWorker|PushManager|push subscription/i);
});
