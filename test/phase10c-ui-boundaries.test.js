import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Phase 10C keeps My Shows outside the market filter", () => {
  const myShows = source("public/phase5-ui.js");
  assert.match(myShows, /const marketSelect = document\.querySelector\("#market-select"\)/);
  assert.match(myShows, /marketSelect\.disabled = true/);
  assert.match(myShows, /marketSelect\.disabled = false/);
  assert.doesNotMatch(myShows, /new URLSearchParams\(\{ status, limit: "100", region: titleRegion\(\), market:/);
});

test("Phase 10C personal discovery retains selected-market context after ranking", () => {
  const discoveryUi = source("public/phase8-ui.js");
  assert.match(discoveryUi, /function renderPersonalPool\(\) \{\s*const marketLabel = MARKET_LABELS\[currentMarket\(\)\]/s);
  assert.match(discoveryUi, /目前顯示\$\{marketLabel\}劇集；只在這個瀏覽器用/);
  assert.match(discoveryUi, /目前顯示\$\{marketLabel\}劇集；尚未有本機追蹤偏好/);
});
